import { useEffect, useState, type ReactNode } from "react";
import {
  Activity, ArrowDownToLine, Bell, Bot, ChevronDown, FileClock, FileText, GitBranch, Layers3,
  Menu, MessageSquareText, Microscope, PanelLeftClose, PanelLeftOpen, Radio,
  Settings2, ShieldCheck, Sparkles, User, X,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { Assistant, ThreadSummary } from "../../types";
import { getStoredSession, type UserProfile } from "../../services/auth";

type RuntimeHealth = "checking" | "online" | "offline";

const navigation = [
  { label: "Overview", to: "/app/dashboard", icon: Layers3 },
  { label: "Command center", to: "/app/command", icon: MessageSquareText },
  { label: "Agents", to: "/app/agents", icon: Bot },
  { label: "Workflows", to: "/app/workflows", icon: GitBranch },
  { label: "Research", to: "/app/research", icon: Microscope },
  { label: "Documents", to: "/app/documents", icon: FileText },
  { label: "Memory & skills", to: "/app/memory", icon: Sparkles },
  { label: "Approvals", to: "/app/approvals", icon: ShieldCheck },
  { label: "Execution history", to: "/app/history", icon: FileClock },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/" aria-label="NEXORA AI home">
      <span className="brand-mark">N</span>
      <span className="brand-copy"><strong>NEXORA <em>AI</em></strong>{!compact && <small>INTELLIGENCE IN MOTION</small>}</span>
    </Link>
  );
}

function Sidebar({ health, collapsed, onCollapse, open, onClose, user }: {
  health: RuntimeHealth;
  collapsed: boolean;
  onCollapse: () => void;
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
}) {
  return (
    <>
      {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand compact />
          <button className="icon-button collapse-button" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onCollapse}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <div className="workspace-label">WORKSPACE <ChevronDown size={12} /></div>
        <nav className="side-nav" aria-label="Workspace navigation">
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`} title={collapsed ? label : undefined}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "Approvals" && <span className="nav-indicator" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="runtime-mini"><span className={`runtime-dot runtime-${health}`} /><span>{health === "online" ? "Runtime connected" : health === "checking" ? "Connecting…" : "Runtime offline"}</span></div>
          <NavLink to="/app/exports" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}><ArrowDownToLine size={17} /><span>Export center</span></NavLink>
          <NavLink to="/app/settings" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}><Settings2 size={17} /><span>Settings</span></NavLink>
          <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}><User size={17} /><span>{user ? user.name.split(" ")[0] : "Sign in / Account"}</span></NavLink>
          <div className="sidebar-tagline"><span className="brand-mark brand-mark-small">N</span><span>NEXORA AI<small>INTELLIGENCE IN MOTION</small></span></div>
        </div>
      </aside>
    </>
  );
}

function NotificationPanel({ health, threads, assistants }: {
  health: RuntimeHealth;
  threads: ThreadSummary[];
  assistants: Assistant[];
}) {
  const [open, setOpen] = useState(false);
  const paused = threads.filter((thread) => thread.status === "interrupted");
  return (
    <div className="notification-wrap">
      <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Bell size={16} />{paused.length > 0 && <span className="notification-count">{paused.length > 9 ? "9+" : paused.length}</span>}
      </button>
      {open && <>
        <button className="notification-dismiss" aria-label="Close notifications" onClick={() => setOpen(false)} />
        <section className="notification-panel" aria-label="Runtime notifications">
          <div className="notification-heading"><strong>Runtime updates</strong><button className="icon-button" aria-label="Close notifications" onClick={() => setOpen(false)}><X size={14} /></button></div>
          <div className="notification-item"><span className={`runtime-dot runtime-${health}`} /><div><strong>{health === "online" ? "LangGraph connected" : health === "checking" ? "Checking connection" : "LangGraph is offline"}</strong><small>Runtime health reported by the API</small></div></div>
          {paused.slice(0, 5).map((thread) => {
            const assistantId = thread.metadata?.assistant_id;
            const assistant = assistants.find((item) => item.assistant_id === assistantId || item.graph_id === assistantId);
            return <Link key={thread.thread_id} className="notification-item" to="/app/approvals" onClick={() => setOpen(false)}><span className="timeline-dot dot-paused" /><div><strong>Approval may be required</strong><small>{assistant?.name || "LangGraph thread"} · {thread.thread_id.slice(0, 16)}…</small></div></Link>;
          })}
          {paused.length === 0 && <p className="notification-empty">No interrupted threads are reported.</p>}
        </section>
      </>}
    </div>
  );
}

function TopNavigation({ pageName, health, refresh, threads, assistants, onOpenSidebar, user }: {
  pageName: string;
  health: RuntimeHealth;
  refresh: () => void;
  threads: ThreadSummary[];
  assistants: Assistant[];
  onOpenSidebar: () => void;
  user: UserProfile | null;
}) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onOpenSidebar}><Menu size={19} /></button>
      <div className="breadcrumb"><span>Workspace</span><i>/</i><strong>{pageName}</strong></div>
      <div className="topbar-actions">
        <div className={`connection-pill connection-${health}`}><span className="runtime-dot" />{health === "online" ? "Connected" : health === "checking" ? "Connecting" : "Offline"}</div>
        <button className="icon-button refresh-button" title="Refresh runtime data" aria-label="Refresh runtime data" onClick={refresh}><Activity size={17} /></button>
        <NotificationPanel health={health} threads={threads} assistants={assistants} />
        <Link to="/login" className="avatar-link" title={user ? `Signed in as ${user.name}` : "Sign in / Account"} aria-label="Account profile">
          {user ? (
            <div className="avatar" style={{ background: "linear-gradient(135deg, #7955e9, #75dce8)", color: "#fff" }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div className="avatar" aria-label="NEXORA workspace">N</div>
          )}
        </Link>
      </div>
    </header>
  );
}

export function AppLayout({ children, health, refresh, threads, assistants }: {
  children: ReactNode;
  health: RuntimeHealth;
  refresh: () => void;
  threads: ThreadSummary[];
  assistants: Assistant[];
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const pageName = navigation.find((item) => location.pathname === item.to)?.label || "Workspace";

  useEffect(() => {
    setUser(getStoredSession().user);
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`workspace ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar health={health} collapsed={collapsed} onCollapse={() => setCollapsed((value) => !value)} open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />
      <div className="workspace-main">
        <TopNavigation pageName={pageName} health={health} refresh={() => void refresh()} threads={threads} assistants={assistants} onOpenSidebar={() => setSidebarOpen(true)} user={user} />
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
