// NEXORA AI Authentication Service - Google OAuth 2.0 Integration

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
  provider: "google" | "local";
  issuedAt?: number;
  expiresAt?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = "nexora_auth_session";

// Parse JWT payload safely without external heavy dependencies
export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Failed to parse JWT payload:", err);
    return null;
  }
}

// Load persisted session from localStorage
export function getStoredSession(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { isAuthenticated: false, user: null, token: null, loading: false, error: null };
    }
    const parsed = JSON.parse(raw);
    if (parsed.user && parsed.expiresAt && Date.now() > parsed.expiresAt) {
      // Session expired
      localStorage.removeItem(STORAGE_KEY);
      return { isAuthenticated: false, user: null, token: null, loading: false, error: "Session expired" };
    }
    return {
      isAuthenticated: Boolean(parsed.user),
      user: parsed.user || null,
      token: parsed.token || null,
      loading: false,
      error: null,
    };
  } catch {
    return { isAuthenticated: false, user: null, token: null, loading: false, error: null };
  }
}

// Store session
export function storeSession(user: UserProfile, token: string) {
  const expiresAt = user.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000; // default 7 days
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user, token, expiresAt })
  );
}

// Clear session
export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// Construct Google OAuth 2.0 Authorization URL
export function getGoogleOAuthUrl(customRedirect?: string): string {
  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
  const redirectUri =
    customRedirect ||
    `${window.location.origin}/auth/callback`;
  const scope = encodeURIComponent("openid email profile");
  const responseType = "id_token token";
  const nonce = Math.random().toString(36).substring(2, 15);

  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=${encodeURIComponent(responseType)}&` +
    `scope=${scope}&` +
    `nonce=${nonce}&` +
    `prompt=select_account`
  );
}

// Verify Google ID token payload
export function handleGoogleCredentialResponse(idToken: string): UserProfile | null {
  const payload = parseJwtPayload(idToken);
  if (!payload) return null;

  // Validate standard Google claims
  const email = String(payload.email || "");
  const name = String(payload.name || payload.given_name || email.split("@")[0] || "User");
  const sub = String(payload.sub || "");
  const picture = typeof payload.picture === "string" ? payload.picture : undefined;
  const exp = typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 3600 * 1000;

  if (!email && !sub) return null;

  const user: UserProfile = {
    id: sub,
    name,
    email,
    picture,
    provider: "google",
    issuedAt: Date.now(),
    expiresAt: exp,
  };

  storeSession(user, idToken);
  return user;
}
