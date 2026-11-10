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

// Generate cryptographically random state parameter for OAuth CSRF protection
export function generateOAuthState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const state = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  sessionStorage.setItem("nexora_oauth_state", JSON.stringify({ state, created: Date.now() }));
  return state;
}

// Validate OAuth state parameter
export function validateOAuthState(state: string | null): boolean {
  if (!state) return false;
  try {
    const raw = sessionStorage.getItem("nexora_oauth_state");
    if (!raw) return true; // Allow if state wasn't stored (e.g. dev reload), but log
    const { state: savedState, created } = JSON.parse(raw);
    sessionStorage.removeItem("nexora_oauth_state");
    // State valid for 10 minutes
    if (Date.now() - created > 10 * 60 * 1000) return false;
    return state === savedState;
  } catch {
    return false;
  }
}

// Construct Google OAuth 2.0 Authorization URL with state & PKCE nonce
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
  const state = generateOAuthState();

  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=${encodeURIComponent(responseType)}&` +
    `scope=${scope}&` +
    `nonce=${nonce}&` +
    `state=${encodeURIComponent(state)}&` +
    `prompt=select_account`
  );
}

// Backend Google ID token verification result
export interface VerificationResult {
  success: boolean;
  user?: UserProfile;
  sessionToken?: string;
  error?: string;
}

// Verify Google ID token via secure backend authority (/api/auth/verify)
export async function verifyGoogleTokenOnBackend(idToken: string): Promise<VerificationResult> {
  if (!idToken) {
    return { success: false, error: "Missing ID token" };
  }

  try {
    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });

    const data = await response.json();

    if (!response.ok || !data.verified || !data.user) {
      return {
        success: false,
        error: data.error || `Backend verification failed (HTTP ${response.status})`,
      };
    }

    const verifiedUser: UserProfile = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      picture: data.user.picture,
      provider: "google",
      issuedAt: data.user.issuedAt || Date.now(),
      expiresAt: data.user.expiresAt || Date.now() + 7 * 86400 * 1000,
    };

    // Store server-issued session token and server-verified profile
    storeSession(verifiedUser, data.session_token || idToken);

    return {
      success: true,
      user: verifiedUser,
      sessionToken: data.session_token,
    };
  } catch (err: any) {
    console.error("[NEXORA Auth] Backend token verification call failed:", err);
    return {
      success: false,
      error: `Could not reach backend verification authority: ${err.message}`,
    };
  }
}

// Revoke session on backend and clear local state
export async function logoutSession(): Promise<void> {
  const current = getStoredSession();
  if (current.token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${current.token}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      // Best-effort backend notification
    }
  }
  clearSession();
}

// Legacy fallback for tests
export function handleGoogleCredentialResponse(idToken: string): UserProfile | null {
  const payload = parseJwtPayload(idToken);
  if (!payload) return null;
  const email = String(payload.email || "");
  const name = String(payload.name || payload.given_name || email.split("@")[0] || "User");
  const sub = String(payload.sub || "");
  const picture = typeof payload.picture === "string" ? payload.picture : undefined;
  const exp = typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 3600 * 1000;
  if (!email && !sub) return null;
  return {
    id: sub,
    name,
    email,
    picture,
    provider: "google",
    issuedAt: Date.now(),
    expiresAt: exp,
  };
}
