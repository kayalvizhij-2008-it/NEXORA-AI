import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes } from "react-router-dom";
import {
  Activity, ArrowRight, Bot, GitBranch, Radio, ShieldCheck,
} from "lucide-react";
import { GlimmerValeBackground } from "./components/background/GlimmerValeBackground";
import { AppLayout } from "./components/layout/AppLayout";
import { CorollaGleam } from "./components/3d/CorollaGleam";
import { Nexora3DEnvironment } from "./components/3d/Nexora3DEnvironment";
import {
  getAssistants, getHealth, getThreads, LangGraphApiError,
} from "./services/langgraph";
import type { Assistant, ThreadSummary } from "./types";
import {
  AgentsPage, ApprovalsPage, CommandPage, DashboardPage, DocumentsPage, ExportsPage, HistoryPage,
  MemoryPage, ResearchPage, SettingsPage, WorkflowsPage,
} from "./pages/WorkspacePages";
import { LoginPage } from "./pages/LoginPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";

type AppContextValue = {
  assistants: Assistant[];
  threads: ThreadSummary[];
  health: "checking" | "online" | "offline";
  error: string | null;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within the application shell.");
  return context;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/" aria-label="NEXORA AI home">
      <span className="brand-mark">N</span>
      <span className="brand-copy"><strong>NEXORA <em>AI</em></strong>{!compact && <small>INTELLIGENCE IN MOTION</small>}</span>
    </Link>
  );
}

function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#capabilities">Platform</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/app/dashboard">Workspace</Link>
          <Link to="/login">Sign in</Link>
        </nav>
        <Link className="button button-quiet landing-signin" to="/login">Sign in <ArrowRight size={15} /></Link>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> AUTONOMOUS MULTI-AGENT OPERATIONS</div>
          <h1>Intelligence in motion.<br /><span>Agents in action.</span></h1>
          <p>NEXORA AI brings your LangGraph agents into one considered workspace. Delegate research, coordinate workflows, and follow every run with clarity.</p>
          <div className="hero-actions">
            <Link to="/app/dashboard" className="button button-primary">Enter the workspace <ArrowRight size={16} /></Link>
            <a href="#capabilities" className="button button-quiet">Explore the platform</a>
          </div>
          <div className="hero-note"><Radio size={14} /> Connected to your own LangGraph runtime</div>
        </div>
        <div className="hero-art" aria-label="Abstract NEXORA AI brand illustration with 3D CorollaGleam core">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="corolla-hero-cluster">
            <CorollaGleam size={380} intensity={1.25} speed={1.05} className="hero-corolla-3d" />
            <div className="orb-core"><span>N</span><i /></div>
          </div>
          <div className="floating-chip chip-one"><Activity size={15} /> Agent orchestration</div>
          <div className="floating-chip chip-two"><GitBranch size={15} /> Live graph runs</div>
          <div className="art-caption"><span className="status-pulse" /> 3D COROLLA CORE · SYSTEM READY</div>
        </div>
      </section>
      <section id="capabilities" className="landing-capabilities">
        <div className="section-kicker">BUILT AROUND YOUR GRAPHS</div>
        <h2>One clear view of complex work.</h2>
        <div className="capability-grid">
          <article><span className="capability-icon"><Bot size={19} /></span><h3>Your agents, connected</h3><p>Discover and launch the assistants already registered in your LangGraph project.</p></article>
          <article><span className="capability-icon"><Activity size={19} /></span><h3>Runs, not illusions</h3><p>Follow streaming model output and graph-node updates from real executions.</p></article>
          <article><span className="capability-icon"><ShieldCheck size={19} /></span><h3>Human in the loop</h3><p>Review and resume graph interrupts where the underlying workflow supports approval.</p></article>
        </div>
      </section>
      <section id="how-it-works" className="landing-foot">
        <div className="landing-foot-brand">
          <CorollaGleam size={48} intensity={1.1} speed={0.85} className="landing-foot-corolla" />
          <div><span className="section-kicker">NEXORA AI</span><p>Intelligence in Motion. Agents in Action.</p></div>
        </div>
        <Link to="/app/dashboard" className="button button-primary">Launch NEXORA <ArrowRight size={15} /></Link>
      </section>
    </main>
  );
}

function WorkspaceLayout() {
  const { assistants, threads, health, refresh } = useAppContext();
  return <AppLayout assistants={assistants} threads={threads} health={health} refresh={refresh}><Outlet /></AppLayout>;
}

function RuntimeUnavailable() {
  const { health, error } = useAppContext();
  if (!error) return null;
  const guidance = health === "online"
    ? "Some live data may be unavailable."
    : "Workspace views will show live data when the API is available.";
  return <div className="runtime-banner"><Radio size={16} /><span>{error} {guidance}</span></div>;
}

export default function App() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [health, setHealth] = useState<AppContextValue["health"]>("checking");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [healthResult, assistantResult, threadResult] = await Promise.allSettled([getHealth(), getAssistants(), getThreads()]);
    setHealth(healthResult.status === "fulfilled" ? "online" : "offline");
    if (assistantResult.status === "fulfilled") setAssistants(assistantResult.value);
    if (threadResult.status === "fulfilled") setThreads(threadResult.value);
    const failure = [healthResult, assistantResult, threadResult].find((result) => result.status === "rejected");
    setError(failure?.status === "rejected"
      ? failure.reason instanceof LangGraphApiError ? failure.reason.message : String(failure.reason)
      : null);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const context = useMemo(() => ({ assistants, threads, health, error, refresh }), [assistants, threads, health, error, refresh]);
  return (
    <AppContext.Provider value={context}>
      <GlimmerValeBackground scene={<Nexora3DEnvironment />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/app" element={<WorkspaceLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<><RuntimeUnavailable /><DashboardPage /></>} />
            <Route path="command" element={<><RuntimeUnavailable /><CommandPage /></>} />
            <Route path="agents" element={<><RuntimeUnavailable /><AgentsPage /></>} />
            <Route path="workflows" element={<><RuntimeUnavailable /><WorkflowsPage /></>} />
            <Route path="research" element={<><RuntimeUnavailable /><ResearchPage /></>} />
            <Route path="documents" element={<><RuntimeUnavailable /><DocumentsPage /></>} />
            <Route path="memory" element={<><RuntimeUnavailable /><MemoryPage /></>} />
            <Route path="approvals" element={<><RuntimeUnavailable /><ApprovalsPage /></>} />
            <Route path="history" element={<><RuntimeUnavailable /><HistoryPage /></>} />
            <Route path="exports" element={<><RuntimeUnavailable /><ExportsPage /></>} />
            <Route path="settings" element={<><RuntimeUnavailable /><SettingsPage /></>} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GlimmerValeBackground>
    </AppContext.Provider>
  );
}
