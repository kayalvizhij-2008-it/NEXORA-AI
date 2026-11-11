import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import crypto from "crypto";
import fs from "fs";
import path from "path";

function nexoraAuthPlugin() {
  const secretKey = process.env.AUTH_SECRET_KEY || "nexora-ai-secure-hmac-session-secret-2026";
  const dataDir = path.resolve(process.cwd(), "..", "data");
  const dataFile = path.join(dataDir, "users.json");
  const revokedSessions = new Set<string>();

  function getUsers(): Record<string, any> {
    try {
      if (!fs.existsSync(dataFile)) return {};
      return JSON.parse(fs.readFileSync(dataFile, "utf-8"));
    } catch {
      return {};
    }
  }

  function saveUsers(users: Record<string, any>) {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(dataFile, JSON.stringify(users, null, 2), "utf-8");
    } catch (e) {
      console.warn("Could not write users.json in dev:", e);
    }
  }

  function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const chosenSalt = salt || crypto.randomBytes(32).toString("hex");
    const key = crypto.pbkdf2Sync(password, chosenSalt, 100000, 64, "sha256");
    return { hash: key.toString("hex"), salt: chosenSalt };
  }

  function verifyPassword(password: string, storedHash: string, salt: string): boolean {
    const key = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha256");
    const storedBuffer = Buffer.from(storedHash, "hex");
    if (key.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(key, storedBuffer);
  }

  function createSessionToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "operator",
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

        // Helper to read JSON request body
        const readBody = () =>
          new Promise<any>((resolve) => {
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", () => {
              try {
                resolve(JSON.parse(body || "{}"));
              } catch {
                resolve({});
              }
            });
          });

        if (url === "/api/auth/register" && req.method === "POST") {
          const { email, password, name } = await readBody();
          if (!email || !password) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Email and password are required." }));
            return;
          }
          const cleanEmail = String(email).trim().toLowerCase();
          const cleanName = String(name || cleanEmail.split("@")[0]).trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Invalid email address format." }));
            return;
          }
          if (String(password).length < 8) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Password must be at least 8 characters long." }));
            return;
          }
          const users = getUsers();
          if (users[cleanEmail]) {
            res.statusCode = 409;
            res.end(JSON.stringify({ success: false, error: "An account with this email already exists." }));
            return;
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

          const safeUser = { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role };
          const sessionToken = createSessionToken(safeUser);
          res.statusCode = 201;
          res.end(JSON.stringify({ success: true, session_token: sessionToken, user: safeUser }));
          return;
        }

        if (url === "/api/auth/login" && req.method === "POST") {
          const { email, password } = await readBody();
          if (!email || !password) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Email and password are required." }));
            return;
          }
          const cleanEmail = String(email).trim().toLowerCase();
          const users = getUsers();
          const user = users[cleanEmail];
          if (!user) {
            crypto.pbkdf2Sync(password, "00".repeat(32), 100000, 64, "sha256");
            res.statusCode = 401;
            res.end(JSON.stringify({ success: false, error: "Invalid email or password." }));
            return;
          }
          const isValid = verifyPassword(password, user.password_hash, user.salt);
          if (!isValid) {
            res.statusCode = 401;
            res.end(JSON.stringify({ success: false, error: "Invalid email or password." }));
            return;
          }
          const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role || "operator" };
          const sessionToken = createSessionToken(safeUser);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, session_token: sessionToken, user: safeUser }));
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
    plugins: [react(), nexoraAuthPlugin()],
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
