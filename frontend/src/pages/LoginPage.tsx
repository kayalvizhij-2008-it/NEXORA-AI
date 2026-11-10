import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, UserCheck, LogOut, Radio } from "lucide-react";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton";
import { getStoredSession, logoutSession, type UserProfile } from "../services/auth";
import { CorollaGleam } from "../components/3d/CorollaGleam";

export function LoginPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (session.user) {
      setUser(session.user);
    }
  }, []);

  const handleLogout = async () => {
    await logoutSession();
    setUser(null);
  };

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const isGoogleConfigured = Boolean(clientId && !clientId.includes("YOUR_GOOGLE_CLIENT_ID"));

  return (
    <div
      className="login-page"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
      }}
    >
      <div
        className="panel login-card"
        style={{
          width: "min(100%, 440px)",
          padding: "36px 30px",
          display: "grid",
          gap: "22px",
          textAlign: "center",
          placeItems: "center",
        }}
      >
        <Link to="/" style={{ display: "inline-block" }}>
          <CorollaGleam size={76} intensity={1.25} speed={0.9} />
        </Link>

        <div>
          <div className="section-kicker" style={{ marginBottom: "6px" }}>
            SECURITY GATEWAY
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "22px", color: "#f8f7fc" }}>
            {user ? "Authenticated Session" : "Access NEXORA AI"}
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#a5a3b5", lineHeight: 1.6 }}>
            {user
              ? "You are authenticated and authorized to operate connected LangGraph agents."
              : "Sign in with your enterprise Google account or continue as workspace operator."}
          </p>
        </div>

        {user ? (
          <div
            className="user-profile-badge"
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              background: "rgba(25, 27, 56, 0.7)",
              border: "1px solid rgba(167, 139, 250, 0.25)",
              display: "grid",
              gap: "12px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  style={{ width: "42px", height: "42px", borderRadius: "50%", border: "2px solid #a78bfa" }}
                />
              ) : (
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #7955e9, #75dce8)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {user.name.charAt(0)}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ color: "#f8f7fc", fontSize: "14px", display: "block" }}>{user.name}</strong>
                <small style={{ color: "#8e8da8", fontSize: "12px", display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.email}
                </small>
              </div>
              <span className="status-tag status-idle">
                <UserCheck size={13} /> Active
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                className="button button-primary"
                style={{ flex: 1 }}
                onClick={() => navigate("/app/dashboard")}
              >
                Go to Workspace <ArrowRight size={15} />
              </button>
              <button
                className="button button-quiet"
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", display: "grid", gap: "12px" }}>
            <GoogleSignInButton text="Continue with Google" />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                margin: "4px 0",
                color: "#6b6a82",
                fontSize: "11px",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
              <span>OR</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
            </div>

            <Link
              to="/app/dashboard"
              className="button button-quiet"
              style={{ width: "100%", minHeight: "40px" }}
            >
              <Radio size={14} style={{ color: "#75dce8" }} />
              Continue as Local Operator <ArrowRight size={14} />
            </Link>
          </div>
        )}

        <div
          style={{
            fontSize: "11px",
            color: "#74738c",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ShieldCheck size={14} style={{ color: "#a78bfa" }} />
          <span>OAuth 2.0 Identity Protocol · Connected to LangGraph</span>
        </div>

        {!isGoogleConfigured && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              background: "rgba(10, 11, 26, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: "11px",
              color: "#9a99b2",
              textAlign: "left",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#d9d6e8", display: "block", marginBottom: "3px" }}>
              Google Cloud Console Configuration:
            </strong>
            1. Create OAuth 2.0 Client ID in Google Cloud Console.<br />
            2. Add Authorized JavaScript origin: <code>{window.location.origin}</code><br />
            3. Add Authorized redirect URI: <code>{window.location.origin}/auth/callback</code><br />
            4. Provide <code>VITE_GOOGLE_CLIENT_ID</code> in environment.
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
