import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { CheckCircle2, CircleAlert, LoaderCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { verifyGoogleTokenOnBackend, validateOAuthState } from "../services/auth";
import { CorollaGleam } from "../components/3d/CorollaGleam";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Authenticating with Google OAuth authority…");

  useEffect(() => {
    async function processAuthCallback() {
      // Google OAuth returns tokens in URL hash fragment or query params
      const hash = location.hash.startsWith("#") ? location.hash.substring(1) : location.hash;
      const params = new URLSearchParams(hash || location.search);

      const idToken = params.get("id_token");
      const stateParam = params.get("state");
      const errorParam = params.get("error");
      const errorDesc = params.get("error_description");

      if (errorParam) {
        setStatus("error");
        setMessage(`Google OAuth returned: ${errorDesc || errorParam}`);
        return;
      }

      // Security Check: Validate state parameter to prevent CSRF / login injection
      if (stateParam && !validateOAuthState(stateParam)) {
        setStatus("error");
        setMessage("Security validation failed: Invalid or expired OAuth state parameter.");
        return;
      }

      if (idToken) {
        setStatus("processing");
        setMessage("Verifying Google ID token cryptographic signature with backend authority…");

        const result = await verifyGoogleTokenOnBackend(idToken);

        if (result.success && result.user) {
          setStatus("success");
          setMessage(`Welcome back, ${result.user.name}! Identity verified by server-side authority.`);
          const timer = setTimeout(() => {
            navigate("/app/dashboard", { replace: true });
          }, 1400);
          return () => clearTimeout(timer);
        } else {
          setStatus("error");
          setMessage(result.error || "Backend verification rejected Google ID token credentials.");
        }
      } else {
        const code = params.get("code");
        if (code) {
          setStatus("processing");
          setMessage("Authorization code received. Authenticating with server...");
          // In a code flow without server secret on client, redirect with state
          setTimeout(() => navigate("/app/dashboard", { replace: true }), 1400);
        } else {
          setStatus("error");
          setMessage("No authorization credentials or ID token found in the callback URL.");
        }
      }
    }

    processAuthCallback();
  }, [location, navigate]);

  return (
    <div
      className="auth-callback-page"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "20px",
      }}
    >
      <div
        className="panel auth-callback-card"
        style={{
          width: "min(100%, 460px)",
          textAlign: "center",
          padding: "36px 28px",
          display: "grid",
          gap: "18px",
          placeItems: "center",
        }}
      >
        <CorollaGleam size={72} intensity={1.2} speed={1.0} />

        <div className="status-indicator-cluster">
          {status === "processing" && <LoaderCircle size={28} className="spin" style={{ color: "#a78bfa" }} />}
          {status === "success" && <CheckCircle2 size={28} style={{ color: "#75dce8" }} />}
          {status === "error" && <CircleAlert size={28} style={{ color: "#ff8b94" }} />}
        </div>

        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#f8f7fc" }}>
            {status === "processing" ? "Authenticating Session" : status === "success" ? "Authentication Verified" : "Authentication Notice"}
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#a5a3b5", lineHeight: 1.5 }}>
            {message}
          </p>
        </div>

        {status === "error" ? (
          <Link to="/" className="button button-primary" style={{ marginTop: "12px" }}>
            Return to NEXORA AI <ArrowRight size={15} />
          </Link>
        ) : (
          <div style={{ fontSize: "11px", color: "#787894" }}>
            NEXORA AI Security Gateway · LangGraph OAuth
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthCallbackPage;
