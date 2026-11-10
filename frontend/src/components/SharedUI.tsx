import type { ReactNode } from "react";
import { Activity, Bot, GitBranch } from "lucide-react";
import type { Assistant, ThreadSummary } from "../types";

export function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function StatusIndicator({ status }: { status?: string }) {
  const normalized = status || "unknown";
  const tone = ["busy", "running"].includes(normalized) ? "running"
    : ["interrupted", "paused"].includes(normalized) ? "paused"
      : ["error", "failed"].includes(normalized) ? "error" : "idle";
  return <span className={`status-tag status-${tone}`}><i className={`runtime-dot runtime-${tone}`} />{normalized.replaceAll("_", " ")}</span>;
}

export function AgentCard({ assistant, onOpen }: { assistant: Assistant; onOpen?: (assistant: Assistant) => void }) {
  const content = (
    <>
      <span className="agent-avatar">{assistant.name.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("")}</span>
      <span className="agent-card-copy"><strong>{assistant.name}</strong><small>{assistant.graph_id}</small></span>
    </>
  );
  return onOpen
    ? <button className="mini-agent agent-card-button" onClick={() => onOpen(assistant)}>{content}<Bot size={14} className="agent-available" /></button>
    : <div className="mini-agent">{content}</div>;
}

export function TaskCard({ thread, assistantName }: { thread: ThreadSummary; assistantName: string }) {
  return (
    <div className="thread-row">
      <span className="thread-icon"><GitBranch size={15} /></span>
      <div className="thread-main"><strong>{assistantName}</strong><small>{thread.thread_id}</small></div>
      <StatusIndicator status={thread.status} />
    </div>
  );
}

export function ActivityTimeline({ threads, assistants }: { threads: ThreadSummary[]; assistants: Assistant[] }) {
  if (!threads.length) return <div className="empty-state"><Activity size={20} /><strong>No activity reported</strong><p>New threads will appear here when the connected runtime reports them.</p></div>;
  return (
    <div className="activity-timeline">
      {threads.map((thread) => {
        const assistant = assistants.find((item) =>
          item.assistant_id === thread.metadata?.assistant_id || item.graph_id === thread.metadata?.assistant_id,
        );
        return (
          <div className="activity-timeline-item" key={thread.thread_id}>
            <span className={`timeline-dot dot-${thread.status === "busy" ? "running" : thread.status === "interrupted" ? "paused" : "idle"}`} />
            <div><strong>{assistant?.name || "LangGraph thread"}</strong><small>{thread.thread_id} · {thread.updated_at || "Timestamp unavailable"}</small></div>
            <StatusIndicator status={thread.status} />
          </div>
        );
      })}
    </div>
  );
}
