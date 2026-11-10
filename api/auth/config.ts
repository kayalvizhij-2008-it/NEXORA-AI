// Vercel Serverless Function: GET /api/auth/config
// Returns public non-sensitive Google OAuth configuration

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const clientId =
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    "";

  return res.status(200).json({
    client_id: clientId,
    is_configured: Boolean(clientId && !clientId.startsWith("<")),
    callback_url: process.env.GOOGLE_CALLBACK_URL || "/auth/callback",
    mode: "production",
  });
}
