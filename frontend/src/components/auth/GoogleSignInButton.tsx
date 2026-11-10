import React, { useState } from "react";
import { LoaderCircle, AlertCircle } from "lucide-react";
import { getGoogleOAuthUrl } from "../../services/auth";

export interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  className?: string;
  style?: React.CSSProperties;
  text?: string;
}

export function GoogleSignInButton({
  className = "",
  style = {},
  text = "Continue with Google",
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const isConfigured = Boolean(clientId && !clientId.includes("YOUR_GOOGLE_CLIENT_ID"));

  const handleClick = () => {
    if (!isConfigured) {
      setNotice(
        "Google Client ID is not configured yet. Add VITE_GOOGLE_CLIENT_ID to your environment variables to enable live Google Sign-In."
      );
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const url = getGoogleOAuthUrl();
      window.location.href = url;
    } catch (err) {
      console.error("Google OAuth redirection error:", err);
      setNotice("Failed to initiate Google OAuth. Please check your network connection.");
      setLoading(false);
    }
  };

  return (
    <div className="google-signin-wrapper" style={{ display: "inline-grid", gap: "8px", width: "100%", ...style }}>
      <button
        type="button"
        className={`button button-google ${className}`}
        onClick={handleClick}
        disabled={loading}
        style={{
          width: "100%",
          minHeight: "42px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "0 18px",
          borderRadius: "11px",
          border: "1px solid rgba(255, 255, 255, 0.16)",
          background: "linear-gradient(145deg, rgba(28, 29, 56, 0.95), rgba(18, 19, 40, 0.9))",
          color: "#f8f7fc",
          fontWeight: 600,
          fontSize: "13px",
          boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
          cursor: loading ? "wait" : "pointer",
          transition: "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        {loading ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{text}</span>
      </button>

      {notice && (
        <div
          className="google-auth-notice"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "9px 12px",
            borderRadius: "8px",
            background: "rgba(84, 39, 168, 0.2)",
            border: "1px solid rgba(167, 139, 250, 0.3)",
            color: "#d9d6e8",
            fontSize: "11px",
            lineHeight: 1.45,
          }}
        >
          <AlertCircle size={15} style={{ color: "#a78bfa", flexShrink: 0, marginTop: "2px" }} />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}

export default GoogleSignInButton;
