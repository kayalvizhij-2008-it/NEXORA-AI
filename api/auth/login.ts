// Vercel Serverless Function: POST /api/auth/login
// Production Email & Password Authentication with Constant-Time PBKDF2 Verification

import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const AUTH_SECRET_KEY =
  process.env.AUTH_SECRET_KEY || "nexora-ai-secure-hmac-session-secret-2026";
const REPO_DATA_FILE = path.join(process.cwd(), "data", "users.json");
const TMP_DATA_FILE = path.join(os.tmpdir(), "nexora_users.json");

function getUsers(): Record<string, any> {
  const users: Record<string, any> = {};

  try {
    if (fs.existsSync(REPO_DATA_FILE)) {
      Object.assign(users, JSON.parse(fs.readFileSync(REPO_DATA_FILE, "utf-8")));
    }
  } catch {}

  try {
    if (fs.existsSync(TMP_DATA_FILE)) {
      Object.assign(users, JSON.parse(fs.readFileSync(TMP_DATA_FILE, "utf-8")));
    }
  } catch {}

  return users;
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const key = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha256");
  const storedBuffer = Buffer.from(storedHash, "hex");
  if (key.length !== storedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(key, storedBuffer);
}

function createSessionToken(user: { id: string; email: string; name: string; role: string }) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "operator",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 86400,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET_KEY)
    .update(encoded)
    .digest("hex");
  return `${encoded}.${signature}`;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { email, password } = body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const users = getUsers();
    const user = users[cleanEmail];

    if (!user) {
      // Fake computation to mitigate timing attacks
      crypto.pbkdf2Sync(password, "00".repeat(32), 100000, 64, "sha256");
      return res.status(401).json({ success: false, error: "Invalid email or password." });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ success: false, error: "Invalid email or password." });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "operator",
    };

    const sessionToken = createSessionToken(safeUser);

    return res.status(200).json({
      success: true,
      session_token: sessionToken,
      user: safeUser,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Server authentication error" });
  }
}
