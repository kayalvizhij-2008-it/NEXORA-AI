// NEXORA AI Authentication Service - Secure Email & Password Architecture
// Server-side PBKDF2 password verification, HMAC session tokens, and route protection.

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  expiresAt?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  session_token?: string;
  error?: string;
}

const STORAGE_KEY = "nexora_auth_session";

// Load persisted session from localStorage
export function getStoredSession(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { isAuthenticated: false, user: null, token: null, loading: false, error: null };
    }
    const parsed = JSON.parse(raw);
    if (parsed.user && parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return { isAuthenticated: false, user: null, token: null, loading: false, error: "Session expired" };
    }
    return {
      isAuthenticated: Boolean(parsed.user && parsed.token),
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
  const expiresAt = user.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user, token, expiresAt })
  );
}

// Clear session
export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// Register with Email and Password
export async function registerWithEmail(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.user) {
      return {
        success: false,
        error: data.error || `Registration failed (HTTP ${response.status})`,
      };
    }

    const verifiedUser: UserProfile = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role || "operator",
      expiresAt: Date.now() + 7 * 86400 * 1000,
    };

    storeSession(verifiedUser, data.session_token);

    return {
      success: true,
      user: verifiedUser,
      session_token: data.session_token,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Could not reach authentication server: ${err.message}`,
    };
  }
}

// Login with Email and Password
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.user) {
      return {
        success: false,
        error: data.error || `Authentication failed (HTTP ${response.status})`,
      };
    }

    const verifiedUser: UserProfile = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role || "operator",
      expiresAt: Date.now() + 7 * 86400 * 1000,
    };

    storeSession(verifiedUser, data.session_token);

    return {
      success: true,
      user: verifiedUser,
      session_token: data.session_token,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Could not reach authentication server: ${err.message}`,
    };
  }
}

// Verify Session with Backend (/api/auth/me)
export async function checkSessionWithBackend(): Promise<UserProfile | null> {
  const session = getStoredSession();
  if (!session.token) return null;

  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data = await res.json();
    if (data.authenticated && data.user) {
      return data.user;
    }
    clearSession();
    return null;
  } catch {
    // If backend unreachable, return locally cached session if not expired
    return session.user;
  }
}

// Logout and revoke session
export async function logoutSession(): Promise<void> {
  const current = getStoredSession();
  if (current.token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${current.token}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      // Best-effort backend notification
    }
  }
  clearSession();
}
