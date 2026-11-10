"""
NEXORA AI - Google OAuth Authentication & Verification Utility
Secure server-side token validation, claims verification, and user session management.
"""

import os
import time
import json
import urllib.request
from typing import Optional, Dict, Any

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_CALLBACK_URL = os.environ.get("GOOGLE_CALLBACK_URL", "http://127.0.0.1:5173/auth/callback")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5173")

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token="


def verify_google_id_token(id_token: str, expected_client_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Validates a Google ID token via Google's tokeninfo endpoint or JWKS verification.
    Verifies:
      - Token signature via Google's certificate endpoints
      - Issuer matches 'accounts.google.com' or 'https://accounts.google.com'
      - Audience (aud) matches the registered GOOGLE_CLIENT_ID
      - Token is not expired (exp > now)
    """
    client_id = expected_client_id or GOOGLE_CLIENT_ID
    if not id_token:
        return None

    try:
        req = urllib.request.Request(
            f"{GOOGLE_TOKEN_INFO_URL}{id_token}",
            headers={"User-Agent": "NEXORA-AI-Backend/1.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            if response.status != 200:
                return None
            data = json.loads(response.read().decode("utf-8"))

        # Verify issuer
        iss = data.get("iss")
        if iss not in ("accounts.google.com", "https://accounts.google.com"):
            return None

        # Verify audience if configured
        if client_id and data.get("aud") != client_id:
            # If client_id is set in env, it must strictly match
            return None

        # Verify expiration
        exp = int(data.get("exp", 0))
        if exp < time.time():
            return None

        return {
            "id": data.get("sub"),
            "email": data.get("email"),
            "email_verified": data.get("email_verified") in (True, "true"),
            "name": data.get("name"),
            "picture": data.get("picture"),
            "locale": data.get("locale"),
        }
    except Exception as e:
        print(f"[NEXORA Auth] Google token verification error: {e}")
        return None


def get_oauth_config() -> Dict[str, str]:
    """Returns the non-sensitive public OAuth configuration for frontend handshakes."""
    return {
        "client_id": GOOGLE_CLIENT_ID,
        "callback_url": GOOGLE_CALLBACK_URL,
        "frontend_url": FRONTEND_URL,
        "is_configured": bool(GOOGLE_CLIENT_ID and not GOOGLE_CLIENT_ID.startswith("<")),
    }
