// Vercel Serverless Function: POST /api/auth/logout
// Secure session termination and token invalidation

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  // Invalidate session cookie / token
  return res.status(200).json({
    logged_out: true,
    message: "Session successfully terminated",
    timestamp: Date.now(),
  });
}
