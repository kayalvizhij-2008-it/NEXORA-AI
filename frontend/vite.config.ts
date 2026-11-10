import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import crypto from "crypto";
import https from "https";

function nexoraAuthPlugin(env: Record<string, string>) {
  const secretKey = process.env.AUTH_SECRET_KEY || "nexora-ai-secure-hmac-session-secret-2026";
  const revokedSessions = new Set<string>();

  function createSessionToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 86400,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secretKey).update(encoded).digest("hex");
    return `${encoded}.${sig}`;
  }

  function verifySessionToken(token: string) {
    if (!token || revokedSessions.has(token)) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac("sha256", secretKey).update(encoded).digest("hex");
    if (sig !== expectedSig) return null;
    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
      if (payload.exp && payload.exp * 1000 < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  return {
    name: "nexora-auth-plugin",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url?.split("?")[0];
        if (!url?.startsWith("/api/auth/")) {
          return next();
        }

        res.setHeader("Content-Type", "application/json");

        if (url === "/api/auth/config" && req.method === "GET") {
          const clientId = env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
          res.end(
            JSON.stringify({
              client_id: clientId,
              is_configured: Boolean(clientId && !clientId.startsWith("<")),
              callback_url: "/auth/callback",
              mode: "development",
            })
          );
          return;
        }

        if (url === "/api/auth/verify" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const { id_token } = JSON.parse(body || "{}");
              if (!id_token) {
                res.statusCode = 400;
                res.end(JSON.stringify({ verified: false, error: "Missing id_token parameter" }));
                return;
              }

              // Verify with Google tokeninfo
              const googleRes = await new Promise<any>((resolve, reject) => {
                https
                  .get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`, (gRes) => {
                    let gData = "";
                    gRes.on("data", (c) => (gData += c));
                    gRes.on("end", () => {
                      try {
                        resolve({ status: gRes.statusCode, data: JSON.parse(gData) });
                      } catch (e) {
                        reject(e);
                      }
                    });
                  })
                  .on("error", reject);
              });

              if (googleRes.status !== 200 || !googleRes.data?.sub) {
                res.statusCode = 401;
                res.end(
                  JSON.stringify({
                    verified: false,
                    error: googleRes.data?.error_description || "Google token verification failed",
                  })
                );
                return;
              }

              const data = googleRes.data;
              const expectedClientId = env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

              if (expectedClientId && !expectedClientId.startsWith("<") && data.aud !== expectedClientId) {
                res.statusCode = 401;
                res.end(JSON.stringify({ verified: false, error: "Token audience does not match configured Google Client ID" }));
                return;
              }

              if (!["accounts.google.com", "https://accounts.google.com"].includes(data.iss)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ verified: false, error: "Invalid token issuer" }));
                return;
              }

              if (Number(data.exp) * 1000 < Date.now()) {
                res.statusCode = 401;
                res.end(JSON.stringify({ verified: false, error: "Google token has expired" }));
                return;
              }

              const user = {
                id: data.sub,
                email: data.email,
                name: data.name || data.given_name || data.email?.split("@")[0] || "User",
                picture: data.picture,
                provider: "google",
                issuedAt: Date.now(),
                expiresAt: Number(data.exp) * 1000,
              };

              const sessionToken = createSessionToken(user);
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  verified: true,
                  session_token: sessionToken,
                  user,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ verified: false, error: err.message || "Server error verifying token" }));
            }
          });
          return;
        }

        if (url === "/api/auth/logout" && req.method === "POST") {
          const authHeader = req.headers["authorization"] || "";
          const token = authHeader.replace(/^Bearer\s+/, "");
          if (token) {
            revokedSessions.add(token);
          }
          res.end(JSON.stringify({ logged_out: true }));
          return;
        }

        if (url === "/api/auth/me" && req.method === "GET") {
          const authHeader = req.headers["authorization"] || "";
          const token = authHeader.replace(/^Bearer\s+/, "");
          const session = verifySessionToken(token);
          if (!session) {
            res.statusCode = 401;
            res.end(JSON.stringify({ authenticated: false, error: "Invalid or expired session" }));
            return;
          }
          res.end(JSON.stringify({ authenticated: true, user: session }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), nexoraAuthPlugin(env)],
    server: {
      proxy: {
        "/langgraph-api": {
          target: env.VITE_LANGGRAPH_API_URL || "http://127.0.0.1:2024",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/langgraph-api/, ""),
        },
      },
    },
  };
});
