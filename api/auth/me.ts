// Vercel Serverless Function: GET /api/auth/me
// Returns current authenticated user claims from verified session token

import crypto from "crypto";

const AUTH_SECRET_KEY =
  process.env.AUTH_SECRET_KEY || "nexora-ai-secure-hmac-session-secret-2026";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return res.status(401).json({ authenticated: false, error: "Missing authorization token" });
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return res.status(401).json({ authenticated: false, error: "Malformed session token" });
  }

  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", AUTH_SECRET_KEY).update(encoded).digest("hex");

  if (sig !== expectedSig) {
    return res.status(401).json({ authenticated: false, error: "Invalid session signature" });
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return res.status(401).json({ authenticated: false, error: "Session has expired" });
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        provider: "google",
        expiresAt: payload.exp * 1000,
      },
    });
  } catch {
    return res.status(401).json({ authenticated: false, error: "Invalid session payload" });
  }
}
