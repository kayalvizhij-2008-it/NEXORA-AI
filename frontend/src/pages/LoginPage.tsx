import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  ArrowRight,
  UserCheck,
  LogOut,
  Radio,
  Lock,
  Mail,
  User,
  LoaderCircle,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import {
  getStoredSession,
  loginWithEmail,
  registerWithEmail,
  logoutSession,
  type UserProfile,
} from "../services/auth";
import { CorollaGleam } from "../components/3d/CorollaGleam";

export function LoginPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<"signin" | "register">("signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (session.user) {
      setUser(session.user);
    }
  }, []);

  const handleLogout = async () => {
    await logoutSession();
    setUser(null);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);

    try {
      if (tab === "signin") {
        const result = await loginWithEmail(email, password);
        if (result.success && result.user) {
          setUser(result.user);
          setSuccessMsg(`Welcome back, ${result.user.name}! Redirecting…`);
          setTimeout(() => navigate("/app/dashboard"), 900);
        } else {
          setError(result.error || "Invalid email or password.");
        }
      } else {
        if (!name.trim()) {
          setError("Please enter your name.");
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError("Password must be at least 8 characters long.");
          setLoading(false);
          return;
        }

        const result = await registerWithEmail(email, password, name);
        if (result.success && result.user) {
          setUser(result.user);
          setSuccessMsg(`Account created for ${result.user.name}! Redirecting…`);
          setTimeout(() => navigate("/app/dashboard"), 900);
        } else {
          setError(result.error || "Registration failed.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Quick fill demo credentials for fast testing
  const handleDemoFill = () => {
    setEmail("operator@nexora.ai");
    setPassword("SuperSecret123!");
    setError(null);
  };

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
          width: "min(100%, 460px)",
          padding: "36px 32px",
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
            {user
              ? "Authenticated Session"
              : tab === "signin"
              ? "Sign In to NEXORA AI"
              : "Create Operator Account"}
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#a5a3b5", lineHeight: 1.6 }}>
            {user
              ? "You are authenticated and authorized to operate connected LangGraph agents."
              : tab === "signin"
              ? "Enter your verified operator email and password to access the workspace."
              : "Create a new operator profile with cryptographic PBKDF2 authentication."}
          </p>
        </div>

        {user ? (
          <div
            className="user-profile-badge"
            style={{
              width: "100%",
              padding: "18px",
              borderRadius: "12px",
              background: "rgba(25, 27, 56, 0.7)",
              border: "1px solid rgba(167, 139, 250, 0.25)",
              display: "grid",
              gap: "14px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #7955e9, #75dce8)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: "16px",
                  color: "#fff",
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ color: "#f8f7fc", fontSize: "14px", display: "block" }}>
                  {user.name}
                </strong>
                <small
                  style={{
                    color: "#8e8da8",
                    fontSize: "12px",
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
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
          <div style={{ width: "100%", display: "grid", gap: "16px" }}>
            {/* Tab selector */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                padding: "4px",
                borderRadius: "10px",
                background: "rgba(10, 11, 26, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                gap: "4px",
              }}
            >
              <button
                type="button"
                className={`button ${tab === "signin" ? "button-primary" : "button-quiet"}`}
                style={{ minHeight: "34px", fontSize: "12px" }}
                onClick={() => {
                  setTab("signin");
                  setError(null);
                  setSuccessMsg(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`button ${tab === "register" ? "button-primary" : "button-quiet"}`}
                style={{ minHeight: "34px", fontSize: "12px" }}
                onClick={() => {
                  setTab("register");
                  setError(null);
                  setSuccessMsg(null);
                }}
              >
                Register
              </button>
            </div>

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#6ee7b7",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <UserCheck size={15} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px", textAlign: "left" }}>
              {tab === "register" && (
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a5a3b5", marginBottom: "6px" }}>
                    Full Name
                  </label>
                  <div style={{ position: "relative" }}>
                    <User
                      size={15}
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#787894",
                      }}
                    />
                    <input
                      type="text"
                      className="text-input"
                      style={{ width: "100%", paddingLeft: "36px" }}
                      placeholder="Jane Operator"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a5a3b5", marginBottom: "6px" }}>
                  Work Email
                </label>
                <div style={{ position: "relative" }}>
                  <Mail
                    size={15}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#787894",
                    }}
                  />
                  <input
                    type="email"
                    className="text-input"
                    style={{ width: "100%", paddingLeft: "36px" }}
                    placeholder="operator@nexora.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a5a3b5", marginBottom: "6px" }}>
                  Password {tab === "register" && "(min. 8 characters)"}
                </label>
                <div style={{ position: "relative" }}>
                  <Lock
                    size={15}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#787894",
                    }}
                  />
                  <input
                    type="password"
                    className="text-input"
                    style={{ width: "100%", paddingLeft: "36px" }}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="button button-primary"
                style={{ width: "100%", minHeight: "42px", marginTop: "4px" }}
                disabled={loading}
              >
                {loading ? (
                  <LoaderCircle size={16} className="spin" />
                ) : tab === "signin" ? (
                  <>
                    Sign In <ArrowRight size={15} />
                  </>
                ) : (
                  <>
                    Create Account <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {tab === "signin" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                  color: "#8e8da8",
                  padding: "0 2px",
                }}
              >
                <button
                  type="button"
                  onClick={handleDemoFill}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#75dce8",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <KeyRound size={12} /> Auto-fill Lead Operator
                </button>
                <span>PBKDF2 SHA-256</span>
              </div>
            )}

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
          <span>PBKDF2 100k-iteration Hash · HMAC Session Token · LangGraph Protected</span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
