// Vercel Serverless Function: POST /api/auth/verify
// Secure backend Google ID Token verification, audience validation, and session generation

import crypto from "crypto";
import https from "https";

const AUTH_SECRET_KEY =
  process.env.AUTH_SECRET_KEY || "nexora-ai-secure-hmac-session-secret-2026";

function createSessionToken(user: { id: string; email: string; name: string; picture?: string }) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 86400, // 7 days
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
    return res.status(405).json({ verified: false, error: "Method not allowed. Use POST." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { id_token } = body;

    if (!id_token) {
      return res.status(400).json({ verified: false, error: "Missing required id_token parameter" });
    }

    // Securely query Google tokeninfo endpoint
    const googleRes = await new Promise<{ status: number; data: any }>((resolve, reject) => {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`;
      https
        .get(url, (gRes) => {
          let chunk = "";
          gRes.on("data", (d) => (chunk += d));
          gRes.on("end", () => {
            try {
              resolve({ status: gRes.statusCode || 500, data: JSON.parse(chunk) });
            } catch (err) {
              reject(err);
            }
          });
        })
        .on("error", reject);
    });

    if (googleRes.status !== 200 || !googleRes.data?.sub) {
      return res.status(401).json({
        verified: false,
        error: googleRes.data?.error_description || "Google token verification failed",
      });
    }

    const data = googleRes.data;
    const expectedClientId =
      process.env.VITE_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      "";

    // 1. Audience verification
    if (expectedClientId && !expectedClientId.startsWith("<") && data.aud !== expectedClientId) {
      return res.status(401).json({
        verified: false,
        error: "Google ID token audience does not match configured client ID",
      });
    }

    // 2. Issuer verification
    if (!["accounts.google.com", "https://accounts.google.com"].includes(data.iss)) {
      return res.status(401).json({
        verified: false,
        error: "Invalid Google ID token issuer",
      });
    }

    // 3. Expiration verification
    if (Number(data.exp) * 1000 < Date.now()) {
      return res.status(401).json({
        verified: false,
        error: "Google ID token has expired",
      });
    }

    // Verified claims
    const verifiedUser = {
      id: String(data.sub),
      email: String(data.email),
      name: String(data.name || data.given_name || data.email?.split("@")[0] || "User"),
      picture: typeof data.picture === "string" ? data.picture : undefined,
      provider: "google" as const,
      issuedAt: Date.now(),
      expiresAt: Number(data.exp) * 1000,
    };

    const sessionToken = createSessionToken(verifiedUser);

    return res.status(200).json({
      verified: true,
      session_token: sessionToken,
      user: verifiedUser,
    });
  } catch (err: any) {
    console.error("[NEXORA Serverless Auth] Verification error:", err);
    return res.status(500).json({
      verified: false,
      error: err.message || "Internal server error during authentication verification",
    });
  }
}
