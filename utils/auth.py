"""
NEXORA AI - Production Email & Password Authentication Engine
Cryptographic PBKDF2 password hashing, salt generation, session tokens, and SQLite storage.
No external OAuth dependencies.
"""

import os
import time
import json
import sqlite3
import hashlib
import hmac
import base64
import re
from pathlib import Path
from typing import Optional, Dict, Any, Tuple

# Configuration
AUTH_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "nexora-ai-secure-hmac-session-secret-2026")
DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DB_DIR / "nexora_auth.db"

# In-memory revocation set for revoked sessions
_REVOKED_SESSIONS = set()


def _get_db() -> sqlite3.Connection:
    """Initializes and returns the SQLite database connection with proper schema."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'operator',
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS revoked_tokens (
                token TEXT PRIMARY KEY,
                revoked_at INTEGER NOT NULL
            )
        """)
    return conn


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations.
    Returns (hex_hash, hex_salt).
    """
    if salt is None:
        salt = os.urandom(32).hex()
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
        dklen=64
    )
    return key.hex(), salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verifies a password against the stored PBKDF2 hash using constant-time comparison."""
    derived_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(derived_hash, stored_hash)


def validate_email(email: str) -> bool:
    """Validates email format."""
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email.strip()))


def create_session_token(user_data: Dict[str, Any], ttl_seconds: int = 7 * 86400) -> str:
    """
    Creates an authenticated, cryptographically-signed HMAC-SHA256 session token.
    Never exposes passwords or sensitive keys.
    """
    payload = {
        "sub": user_data.get("id"),
        "email": user_data.get("email"),
        "name": user_data.get("name"),
        "role": user_data.get("role", "operator"),
        "iat": int(time.time()),
        "exp": int(time.time()) + ttl_seconds,
    }
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    signature = hmac.new(
        AUTH_SECRET_KEY.encode("utf-8"),
        encoded_payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return f"{encoded_payload}.{signature}"


def verify_session_token(session_token: str) -> Optional[Dict[str, Any]]:
    """
    Validates signature, expiration, and revocation status of an application session token.
    """
    if not session_token or session_token in _REVOKED_SESSIONS:
        return None

    try:
        parts = session_token.split(".")
        if len(parts) != 2:
            return None
        encoded_payload, signature = parts

        # Verify signature
        expected_sig = hmac.new(
            AUTH_SECRET_KEY.encode("utf-8"),
            encoded_payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            return None

        # Check database revocation list
        conn = _get_db()
        with conn:
            cur = conn.execute("SELECT 1 FROM revoked_tokens WHERE token = ?", (session_token,))
            if cur.fetchone():
                _REVOKED_SESSIONS.add(session_token)
                return None

        # Decode payload
        padding = 4 - (len(encoded_payload) % 4)
        if padding != 4:
            encoded_payload += "=" * padding
        payload_bytes = base64.urlsafe_b64decode(encoded_payload.encode("utf-8"))
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Verify expiration
        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception as e:
        print(f"[NEXORA Auth] Session token verification error: {e}")
        return None


def invalidate_session_token(session_token: str) -> bool:
    """Marks a session token as revoked upon logout."""
    if not session_token:
        return False
    _REVOKED_SESSIONS.add(session_token)
    try:
        conn = _get_db()
        with conn:
            conn.execute(
                "INSERT OR IGNORE INTO revoked_tokens (token, revoked_at) VALUES (?, ?)",
                (session_token, int(time.time()))
            )
        return True
    except Exception as e:
        print(f"[NEXORA Auth] Invalidation error: {e}")
        return False


def register_user(email: str, password: str, name: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Registers a new user with email and password.
    Returns (success, user_dict_or_none, error_message_or_none).
    """
    email = email.strip().lower()
    name = name.strip()

    if not validate_email(email):
        return False, None, "Invalid email address format."
    if len(password) < 8:
        return False, None, "Password must be at least 8 characters long."
    if not name:
        name = email.split("@")[0]

    password_hash, salt = hash_password(password)
    user_id = "usr_" + os.urandom(12).hex()
    now = int(time.time())

    try:
        conn = _get_db()
        with conn:
            conn.execute("""
                INSERT INTO users (id, email, name, password_hash, salt, role, created_at)
                VALUES (?, ?, ?, ?, ?, 'operator', ?)
            """, (user_id, email, name, password_hash, salt, now))

        user_info = {
            "id": user_id,
            "email": email,
            "name": name,
            "role": "operator",
            "created_at": now
        }
        return True, user_info, None
    except sqlite3.IntegrityError:
        return False, None, "An account with this email already exists."
    except Exception as e:
        return False, None, f"Database error: {str(e)}"


def authenticate_user(email: str, password: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Authenticates a user with email and password.
    Returns (success, user_dict_or_none, error_message_or_none).
    """
    email = email.strip().lower()
    if not email or not password:
        return False, None, "Email and password are required."

    try:
        conn = _get_db()
        with conn:
            cur = conn.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cur.fetchone()

        if not row:
            # Constant time decoy calculation to prevent user enumeration via timing
            hash_password(password, "00" * 32)
            return False, None, "Invalid email or password."

        if not verify_password(password, row["password_hash"], row["salt"]):
            return False, None, "Invalid email or password."

        user_info = {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "created_at": row["created_at"]
        }
        return True, user_info, None
    except Exception as e:
        return False, None, f"Authentication error: {str(e)}"
