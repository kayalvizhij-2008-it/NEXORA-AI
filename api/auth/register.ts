// Vercel Serverless Function: POST /api/auth/register
// Production Email & Password User Registration with PBKDF2 Password Hashing

import crypto from "crypto";
import fs from "fs";
import path from "path";

const AUTH_SECRET_KEY =
  process.env.AUTH_SECRET_KEY || "nexora-ai-secure-hmac-session-secret-2026";
const DATA_FILE = path.join(process.cwd(), "data", "users.json");

function getUsers(): Record<string, any> {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, any>) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not persist users file on read-only serverless environment:", e);
  }
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const chosenSalt = salt || crypto.randomBytes(32).toString("hex");
  const key = crypto.pbkdf2Sync(password, chosenSalt, 100000, 64, "sha256");
  return { hash: key.toString("hex"), salt: chosenSalt };
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
    const { email, password, name } = body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name || cleanEmail.split("@")[0]).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "Invalid email address format." });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters long." });
    }

    const users = getUsers();
    if (users[cleanEmail]) {
      return res.status(409).json({ success: false, error: "An account with this email already exists." });
    }

    const { hash, salt } = hashPassword(password);
    const userId = "usr_" + crypto.randomBytes(12).toString("hex");

    const newUser = {
      id: userId,
      email: cleanEmail,
      name: cleanName,
      password_hash: hash,
      salt,
      role: "operator",
      created_at: Date.now(),
    };

    users[cleanEmail] = newUser;
    saveUsers(users);

    const safeUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    };

    const sessionToken = createSessionToken(safeUser);

    return res.status(201).json({
      success: true,
      session_token: sessionToken,
      user: safeUser,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Server registration error" });
  }
}
