import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowRight, BadgeCheck, Bot, Check,
  CircleAlert, Clock3, ExternalLink, FileJson2, FileText, GitBranch, LoaderCircle,
  MessageSquareText, Microscope, Play, Plus, Radio, RefreshCw, Search, ShieldCheck,
  Sparkles, TerminalSquare, UploadCloud, X, Copy, CheckCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ChatInterface } from "../components/ChatInterface";
import { PromptComposer } from "../components/PromptComposer";
import { ActivityTimeline, AgentCard, TaskCard } from "../components/SharedUI";
import { WorkflowCanvas } from "../components/WorkflowCanvas";
import { CorollaGleam } from "../components/3d/CorollaGleam";
import { useAppContext } from "../App";
import { createThread, getAssistantGraph, getThreadState, resumeThread, streamRun } from "../services/langgraph";
import type { Assistant, AssistantGraph, Approval, ChatEntry, ThreadSummary } from "../types";

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="section-kicker">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function PanelTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="panel-title"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function RuntimeEmpty({ message = "Start the LangGraph API to see live project data." }: { message?: string }) {
  return (
    <div className="empty-state">
      <CorollaGleam size={64} intensity={0.9} speed={0.7} className="empty-corolla-gleam" />
      <span className="empty-icon"><Radio size={18} /></span>
      <strong>Waiting for your runtime</strong>
      <p>{message}</p>
      <code>langgraph dev</code>
    </div>
  );
}

function initials(name: string) {
  return name.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function statusLabel(status?: string) {
  if (!status) return "Status unavailable";
  return status.replaceAll("_", " ");
}

function statusTone(status?: string) {
  if (status === "busy" || status === "running") return "running";
  if (status === "interrupted" || status === "paused") return "paused";
  if (status === "error" || status === "failed") return "error";
  return "idle";
}

function relativeTime(value?: string) {
  if (!value) return "Time not reported";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function graphName(thread: ThreadSummary, assistants: Assistant[]) {
  const fromMetadata = thread.metadata?.assistant_id;
  const assistant = assistants.find((item) => item.assistant_id === fromMetadata || item.graph_id === fromMetadata);
  return assistant?.name || "LangGraph thread";
}

export function DashboardPage() {
  const { assistants, threads, health, refresh } = useAppContext();
  const active = threads.filter((thread) => thread.status === "busy").length;
  const paused = threads.filter((thread) => thread.status === "interrupted").length;
  const stats = [
    { label: "Tracked threads", value: threads.length, detail: "Live from LangGraph", icon: MessageSquareText, tone: "violet" },
    { label: "Registered graphs", value: assistants.length, detail: "Available assistants", icon: Bot, tone: "cyan" },
    { label: "Active runs", value: active, detail: "Reported as busy", icon: Activity, tone: "green" },
    { label: "Paused threads", value: paused, detail: "May require review", icon: ShieldCheck, tone: "amber" },
  ];

  return <div className="page">
    <PageHeading eyebrow="OPERATIONS OVERVIEW" title="Good to see you." description="A clear view of your agents, live runs, and the work moving through your LangGraph runtime." action={<button className="button button-quiet" onClick={() => void refresh()}><RefreshCw size={15} /> Refresh data</button>} />
    <div className="stat-grid">{stats.map(({ label, value, detail, icon: Icon, tone }) => <article className="stat-card" key={label}><div className={`stat-icon icon-${tone}`}><Icon size={18} /></div><div className="stat-label">{label}</div><strong>{health === "online" ? value : "—"}</strong><small>{detail}</small></article>)}</div>
    <div className="dashboard-grid">
      <section className="panel activity-panel">
        <PanelTitle title="Runtime activity" detail="Current status reported by LangGraph" />
        <div className="runtime-summary">
          <div className="runtime-emblem-cluster">
            <CorollaGleam size={64} intensity={1.15} speed={0.85} className="runtime-corolla-gleam" />
            <div className={`runtime-emblem ${health === "online" ? "emblem-online" : ""}`}>
              <Activity size={24} />
            </div>
          </div>
          <div>
            <strong>{health === "online" ? "Your runtime is reachable" : health === "checking" ? "Checking connection" : "Runtime unavailable"}</strong>
            <p>{health === "online" ? `${assistants.length} registered graphs · ${threads.length} recent threads` : "Configure the API endpoint and start LangGraph to load live activity."}</p>
          </div>
        </div>
        <div className="health-line"><span><i className={`runtime-dot runtime-${health}`} /> API health</span><strong>{health === "online" ? "Online" : health === "checking" ? "Checking" : "Offline"}</strong></div>
        <div className="health-line"><span><Bot size={14} /> Graph registry</span><strong>{health === "online" ? `${assistants.length} found` : "—"}</strong></div>
        <div className="health-line"><span><GitBranch size={14} /> Active threads</span><strong>{health === "online" ? active : "—"}</strong></div>
      </section>
      <section className="panel"><PanelTitle title="Recent threads" detail="Most recently updated in this runtime" action={<Link className="text-link" to="/app/history">View history <ArrowRight size={14} /></Link>} />
        {threads.length ? <div className="thread-list">{threads.slice(0, 5).map((thread) => <TaskCard key={thread.thread_id} thread={thread} assistantName={graphName(thread, assistants)} />)}</div> : <RuntimeEmpty />}</section>
    </div>
    <section className="panel graph-panel"><PanelTitle title="Your agent registry" detail="Assistants discovered from the connected LangGraph deployment" action={<Link className="text-link" to="/app/agents">Explore agents <ArrowRight size={14} /></Link>} />
      {assistants.length ? <div className="mini-agent-grid">{assistants.slice(0, 6).map((assistant) => <AgentCard key={assistant.assistant_id} assistant={assistant} />)}</div> : <RuntimeEmpty message="Registered graphs will appear here when the runtime is online." />}
    </section>
    <div className="dashboard-lower-grid"><section className="panel"><PanelTitle title="Agent activity" detail="Recent thread updates returned by LangGraph" /><ActivityTimeline threads={threads.slice(0, 6)} assistants={assistants} /></section><div className="quick-actions"><div><span className="section-kicker">READY WHEN YOU ARE</span><h2>Put your agents to work.</h2><p>Choose a registered graph and send it a real task.</p></div><Link className="button button-primary" to="/app/command">Open command center <ArrowRight size={15} /></Link></div></div>
  </div>;
}

const templates = [
  { title: "Deep research", description: "Investigate a topic and synthesize findings.", match: "research", prompt: "Research the latest developments in " },
  { title: "Research brief", description: "Ask the research graph to prepare a focused report.", match: "research", prompt: "Prepare a concise, sourced research brief about " },
  { title: "Email triage", description: "Use the registered email workflow.", match: "email", prompt: "Review and help me triage the following email context: " },
  { title: "Explore a workflow", description: "Send a request to one of your available assistants.", match: "", prompt: "Help me with " },
];

function roleFromMessage(message: Record<string, unknown>): "user" | "assistant" | "system" {
  const type = String(message.type || message.role || "").toLowerCase();
  return type.includes("human") || type === "user" ? "user" : type.includes("system") ? "system" : "assistant";
}

function contentFromStateMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const content = (value as Record<string, unknown>).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && typeof (item as Record<string, unknown>).text === "string") return String((item as Record<string, unknown>).text);
    return "";
  }).join("");
  return "";
}

export function CommandPage() {
  const { assistants, threads, refresh } = useAppContext();
  const [assistantId, setAssistantId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assistants.some((assistant) => assistant.assistant_id === assistantId)) setAssistantId(assistants[0]?.assistant_id || "");
  }, [assistants, assistantId]);

  const selectedAssistant = assistants.find((assistant) => assistant.assistant_id === assistantId);

  async function loadThread(id: string) {
    setThreadId(id);
    setMessages([]);
    setError(null);
    if (!id) return;
    try {
      const state = await getThreadState(id);
      const values = state.values && typeof state.values === "object" ? state.values as Record<string, unknown> : {};
      const history = Array.isArray(values.messages) ? values.messages : [];
      setMessages(history.map((message, index) => {
        const record = message && typeof message === "object" ? message as Record<string, unknown> : {};
        return { id: String(record.id || index), role: roleFromMessage(record), content: contentFromStateMessage(message), createdAt: "", status: "complete" as const };
      }).filter((message) => message.content));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || !selectedAssistant || busy) return;
    setBusy(true);
    setError(null);
    setProgress("Creating a LangGraph thread");
    const userMessage: ChatEntry = { id: crypto.randomUUID(), role: "user", content: text, createdAt: new Date().toISOString() };
    const replyId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: replyId, role: "assistant", content: "", createdAt: new Date().toISOString(), assistant: selectedAssistant.name, status: "running" }]);
    setPrompt("");
    try {
      const thread = threadId ? { thread_id: threadId } : await createThread(selectedAssistant.assistant_id);
      setThreadId(thread.thread_id);
      setProgress("Running the selected graph");
      await streamRun(thread.thread_id, selectedAssistant.assistant_id, { messages: [{ role: "user", content: text }] }, {
        onToken: (token) => setMessages((current) => current.map((message) => message.id === replyId ? { ...message, content: message.content + token } : message)),
        onProgress: setProgress,
      });
      setMessages((current) => current.map((message) => message.id === replyId ? { ...message, status: "complete" } : message));
      setProgress("");
      void refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      setMessages((current) => current.map((item) => item.id === replyId ? { ...item, content: item.content || "The run ended before returning a text response.", status: "error" } : item));
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  return <div className="page">
    <PageHeading eyebrow="NEXORA COMMAND" title="Command center" description="Give a real LangGraph assistant a task and follow its streamed response." action={<span className="live-label"><i className="runtime-dot runtime-online" /> LIVE API</span>} />
    <div className="command-layout">
      <section className="panel command-panel">
        <div className="command-toolbar"><div><div className="section-kicker">ACTIVE SESSION</div><strong>{threadId ? `Thread ${threadId.slice(0, 12)}…` : "New agent run"}</strong></div><select aria-label="Continue a previous thread" value={threadId} onChange={(event) => void loadThread(event.target.value)}><option value="">New thread</option>{threads.map((thread) => <option key={thread.thread_id} value={thread.thread_id}>{thread.thread_id.slice(0, 18)} · {statusLabel(thread.status)}</option>)}</select></div>
        <ChatInterface messages={messages} assistant={selectedAssistant} progress={progress} />
        {error && <div className="inline-error"><CircleAlert size={16} /><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError(null)}><X size={14} /></button></div>}
        <PromptComposer value={prompt} onChange={setPrompt} onSubmit={(event) => void submit(event)} assistants={assistants} assistantId={assistantId} onAssistantChange={setAssistantId} busy={busy} />
      </section>
      <aside className="command-aside">
        <section className="panel agent-context">
          <PanelTitle title="Agent context" />
          <div className="agent-context-body">
            {selectedAssistant ? (
              <>
                <div className="agent-context-header-visual">
                  <CorollaGleam size={64} intensity={1.15} speed={0.9} className="agent-context-corolla" />
                  <div className="agent-avatar agent-avatar-large">{initials(selectedAssistant.name)}</div>
                </div>
                <h3>{selectedAssistant.name}</h3>
                <span className="graph-id">{selectedAssistant.graph_id}</span>
                <p>{selectedAssistant.description || "Registered LangGraph assistant, available to run tasks through this workspace."}</p>
                <div className="context-divider" />
                <div className="context-fact"><span>Runtime</span><strong>LangGraph</strong></div>
                <div className="context-fact"><span>Streaming</span><strong>Enabled by API</strong></div>
              </>
            ) : <RuntimeEmpty message="Connect LangGraph to choose an assistant." />}
          </div>
        </section>
        <section className="panel template-panel"><PanelTitle title="Quick starts" detail="Templates call registered graphs." /><div className="template-list">{templates.map((template) => <button key={template.title} className="template-button" onClick={() => { const match = assistants.find((assistant) => assistant.graph_id.toLowerCase().includes(template.match)); if (match) setAssistantId(match.assistant_id); setPrompt(template.prompt); }}><span className="template-icon"><Sparkles size={15} /></span><span><strong>{template.title}</strong><small>{template.description}</small></span><ArrowRight size={14} /></button>)}</div></section>
      </aside>
    </div>
  </div>;
}

export function AgentsPage() {
  const { assistants, threads, health } = useAppContext();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Assistant | null>(null);
  const [graph, setGraph] = useState<AssistantGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState("");
  const filtered = assistants.filter((assistant) => `${assistant.name} ${assistant.graph_id}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    let active = true;
    setGraph(null);
    setGraphError("");
    if (!selected) return () => { active = false; };
    setGraphLoading(true);
    void getAssistantGraph(selected.assistant_id).then((value) => {
      if (active) setGraph(value);
    }).catch((reason) => {
      if (active) setGraphError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (active) setGraphLoading(false);
    });
    return () => { active = false; };
  }, [selected]);
  return <div className="page"><PageHeading eyebrow="AGENT DIRECTORY" title="Meet your agents." description="The registry below is fetched from your LangGraph deployment—only registered assistants are shown." action={<label className="search-field"><Search size={15} /><input placeholder="Find an agent" value={query} onChange={(event) => setQuery(event.target.value)} /></label>} />
    {health !== "online" ? <RuntimeEmpty /> : filtered.length ? <div className={`agent-directory-layout ${selected ? "agent-directory-selected" : ""}`}><div className="agent-grid">{filtered.map((assistant) => <article className={`agent-card ${selected?.assistant_id === assistant.assistant_id ? "agent-card-selected" : ""}`} key={assistant.assistant_id}><button className="agent-card-open" onClick={() => setSelected(assistant)} aria-label={`View ${assistant.name} details`}><span className="agent-card-top"><span className="agent-avatar agent-avatar-large">{initials(assistant.name)}</span><span className="status-tag status-idle"><BadgeCheck size={12} /> Registered</span></span><h2>{assistant.name}</h2><code>{assistant.graph_id}</code><p>{assistant.description || "A LangGraph assistant available in this deployment."}</p></button><div className="agent-card-foot"><span><Radio size={13} /> Connected to runtime</span><Link to="/app/command" className="text-link">Run task <ArrowRight size={14} /></Link></div></article>)}</div>
      {selected && <aside className="panel agent-detail-panel"><button className="agent-detail-close" aria-label="Close agent details" onClick={() => setSelected(null)}><X size={15} /></button><span className="agent-avatar agent-avatar-large">{initials(selected.name)}</span><h2>{selected.name}</h2><code>{selected.graph_id}</code><p>{selected.description || "Registered LangGraph assistant."}</p><Link className="button button-primary" to="/app/command">Run a task <ArrowRight size={14} /></Link><div className="agent-detail-divider" /><div className="section-kicker">GRAPH CAPABILITIES · LIVE SCHEMA</div>{graphLoading ? <div className="loading-panel"><LoaderCircle size={16} className="spin" /> Loading graph schema…</div> : graphError ? <div className="inline-error"><CircleAlert size={14} />{graphError}</div> : graph ? <div className="agent-node-list">{graph.nodes.map((node) => <div key={node.id}><GitBranch size={13} /><span>{node.data?.name || node.id}</span></div>)}</div> : null}<div className="agent-detail-divider" /><div className="section-kicker">RECENT THREADS</div>{threads.filter((thread) => thread.metadata?.assistant_id === selected.assistant_id).slice(0, 4).map((thread) => <div className="agent-thread-row" key={thread.thread_id}><span className={`timeline-dot dot-${statusTone(thread.status)}`} /><span>{thread.thread_id.slice(0, 18)}…</span><span className={`status-tag status-${statusTone(thread.status)}`}>{statusLabel(thread.status)}</span></div>)}{!threads.some((thread) => thread.metadata?.assistant_id === selected.assistant_id) && <p className="agent-detail-muted">No recent threads are associated with this assistant.</p>}</aside>}</div> : <div className="panel"><div className="empty-state"><Search size={21} /><strong>No matching agents</strong><p>Try a different search term.</p></div></div>}
  </div>;
}

export function WorkflowsPage() {
  const { assistants, threads } = useAppContext();
  const [assistantId, setAssistantId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [graph, setGraph] = useState<AssistantGraph | null>(null);
  const [nextNodes, setNextNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const assistant = assistants.find((item) => item.assistant_id === assistantId);
  const graphThreads = threads.filter((thread) => thread.metadata?.assistant_id === assistantId);

  useEffect(() => {
    if (!assistants.some((item) => item.assistant_id === assistantId)) setAssistantId(assistants[0]?.assistant_id || "");
  }, [assistants, assistantId]);
  useEffect(() => {
    if (!graphThreads.some((thread) => thread.thread_id === threadId)) setThreadId("");
  }, [graphThreads, threadId]);
  useEffect(() => {
    let active = true;
    setGraph(null); setNextNodes([]); setError("");
    if (!assistantId) return () => { active = false; };
    setLoading(true);
    void getAssistantGraph(assistantId).then((value) => {
      if (active) setGraph(value);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [assistantId]);
  useEffect(() => {
    let active = true;
    setNextNodes([]);
    if (!threadId) return () => { active = false; };
    void getThreadState(threadId).then((state) => {
      if (!active) return;
      const next = Array.isArray(state.next) ? state.next.map(String) : [];
      setNextNodes(next);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [threadId]);

  return <div className="page"><PageHeading eyebrow="GRAPH EXPLORER" title="Workflows, in view." description="Explore the actual node and edge schema returned by LangGraph. No supervisor relationships or execution paths are fabricated." action={<Link className="button button-quiet" to="/app/command">Run a workflow <ArrowRight size={14} /></Link>} />
    <section className="panel workflow-explorer">
      <div className="workflow-controls">
        <div className="workflow-emblem">
          <CorollaGleam size={42} intensity={1.1} speed={0.8} className="workflow-corolla-gleam" />
        </div>
        <label>Registered assistant<select aria-label="Select workflow graph" value={assistantId} onChange={(event) => setAssistantId(event.target.value)}>{assistants.map((item) => <option key={item.assistant_id} value={item.assistant_id}>{item.name}</option>)}</select></label><label>Checkpoint state<select aria-label="Select checkpoint thread" value={threadId} onChange={(event) => setThreadId(event.target.value)}><option value="">Graph structure only</option>{graphThreads.map((thread) => <option key={thread.thread_id} value={thread.thread_id}>{thread.thread_id.slice(0, 22)} · {statusLabel(thread.status)}</option>)}</select></label>{graph && <span className="graph-schema-count">{graph.nodes.length} nodes <i /> {graph.edges.length} transitions</span>}</div>
      {error && <div className="inline-error"><CircleAlert size={15} />{error}</div>}
      {loading ? <div className="loading-panel"><LoaderCircle size={17} className="spin" /> Loading graph structure from LangGraph…</div> : graph ? <WorkflowCanvas graph={graph} nextNodes={nextNodes} onSelectNode={(node) => setSelectedNode(node.data?.name || node.id)} /> : !assistants.length ? <RuntimeEmpty message="Registered workflow graphs will appear when LangGraph is connected." /> : null}
      {selectedNode && <div className="workflow-selection">Selected graph node: <strong>{selectedNode}</strong></div>}
    </section>
    <section className="panel workflow-runs"><PanelTitle title="Recent graph threads" detail="Thread statuses and timestamps reported by LangGraph" action={<Link className="text-link" to="/app/history">Full history <ArrowRight size={14} /></Link>} />
      {threads.length ? <div className="thread-list">{threads.slice(0, 12).map((thread) => <div className="thread-row" key={thread.thread_id}><span className={`timeline-dot dot-${statusTone(thread.status)}`} /><div className="thread-main"><strong>{graphName(thread, assistants)}</strong><small>{thread.thread_id} · {relativeTime(thread.updated_at)}</small></div><span className={`status-tag status-${statusTone(thread.status)}`}>{statusLabel(thread.status)}</span></div>)}</div> : <RuntimeEmpty />}
    </section>
  </div>;
}

export function ResearchPage() {
  const { assistants, refresh } = useAppContext();
  const researchAgents = assistants.filter((assistant) => /research/i.test(`${assistant.name} ${assistant.graph_id}`));
  const [assistantId, setAssistantId] = useState("");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!researchAgents.some((agent) => agent.assistant_id === assistantId)) setAssistantId(researchAgents[0]?.assistant_id || ""); }, [researchAgents, assistantId]);
  async function startResearch(event: FormEvent) {
    event.preventDefault();
    const agent = researchAgents.find((item) => item.assistant_id === assistantId);
    if (!agent || !topic.trim() || busy) return;
    setBusy(true); setError(""); setResult(""); setProgress("Creating a research thread");
    try {
      const thread = await createThread(agent.assistant_id);
      await streamRun(thread.thread_id, agent.assistant_id, { messages: [{ role: "user", content: topic.trim() }] }, {
        onToken: (token) => setResult((current) => current + token),
        onProgress: setProgress,
      });
      setProgress("Research run complete");
      void refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setProgress("");
    } finally {
      setBusy(false);
    }
  }
  return <div className="page"><PageHeading eyebrow="RESEARCH WORKSPACE" title="Follow the evidence." description="Submit a research request to a registered research graph and collect its streamed report." />
    <div className="research-layout"><section className="panel research-form-panel"><PanelTitle title="Research brief" detail="Your prompt is sent to the selected backend graph." />
      <form className="research-form" onSubmit={(event) => void startResearch(event)}><label htmlFor="research-topic">What should the agents investigate?</label><textarea id="research-topic" rows={6} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Describe a focused research question, the context that matters, and the depth you need." /><label htmlFor="research-agent">Research graph</label><select id="research-agent" value={assistantId} onChange={(event) => setAssistantId(event.target.value)} disabled={!researchAgents.length}>{researchAgents.length ? researchAgents.map((agent) => <option key={agent.assistant_id} value={agent.assistant_id}>{agent.name}</option>) : <option value="">No registered research graph found</option>}</select>{error && <div className="inline-error"><CircleAlert size={15} />{error}</div>}<button type="submit" className="button button-primary" disabled={busy || !assistantId || !topic.trim()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Microscope size={15} />}{busy ? progress || "Researching…" : "Start research"}</button></form>
      {!researchAgents.length && <div className="notice-muted"><CircleAlert size={15} /> A graph whose registered name or ID includes “research” is required. No substitute agent will be selected.</div>}
    </section><section className="panel findings-panel"><PanelTitle title="Research output" detail={progress || "The report appears here as the graph streams its response."} action={result && <button className="text-link" onClick={() => downloadText("nexora-research.md", result)}><ArrowDownToLine size={14} /> Export</button>} />
      {result ? <pre className="research-result">{result}</pre> : <div className="research-placeholder"><div className="research-orbit"><Microscope size={23} /></div><strong>Your findings, grounded in your workflow.</strong><p>Start a research run to see its real output and execution updates.</p></div>}
    </section></div>
  </div>;
}

function findInterrupts(state: Record<string, unknown>): unknown[] {
  const interrupts: unknown[] = [];
  if (Array.isArray(state.tasks)) {
    for (const task of state.tasks) {
      if (task && typeof task === "object" && Array.isArray((task as Record<string, unknown>).interrupts)) {
        interrupts.push(...(task as { interrupts: unknown[] }).interrupts);
      }
    }
  }
  if (Array.isArray(state.interrupts)) interrupts.push(...state.interrupts);
  return interrupts;
}

export function MemoryPage() {
  const { assistants } = useAppContext();
  const deepAgent = assistants.find((assistant) => /deep.agent/i.test(`${assistant.name} ${assistant.graph_id}`));
  return <div className="page"><PageHeading eyebrow="AGENT KNOWLEDGE" title="Memory & skills." description="Inspect the capabilities and memory mechanisms that are actually present in this repository." />
    <div className="memory-grid"><section className="panel"><PanelTitle title="Installed skills" detail="Source files under agents/deep_agent/skills/" />
      {deepAgent ? <div className="skill-list"><div className="skill-row"><span className="skill-mark"><Sparkles size={16} /></span><div><strong>LinkedIn post</strong><small>agents/deep_agent/skills/linkedin-post/SKILL.md</small></div><span className="status-tag status-idle">Available to Deep Agent</span></div><div className="skill-row"><span className="skill-mark"><Sparkles size={16} /></span><div><strong>Twitter / X post</strong><small>agents/deep_agent/skills/twitter-post/SKILL.md</small></div><span className="status-tag status-idle">Available to Deep Agent</span></div></div> : <div className="notice-muted"><Bot size={15} /> The Deep Agent is not currently listed by the connected runtime. Skill files remain in the repository.</div>}
      <div className="memory-note"><TerminalSquare size={17} /><div><strong>Agent instructions</strong><p>The Deep Agent loads its identity and instructions from <code>agents/deep_agent/AGENTS.md</code>.</p></div></div>
    </section><section className="panel"><PanelTitle title="Persistent memory" detail="Deep Agent StoreBackend" />
      {deepAgent ? <><div className="memory-illustration"><div><span className="memory-ring"><Sparkles size={22} /></span><span className="memory-line" /><span className="memory-node" /></div><strong>Memory is owned by the graph runtime</strong><p>The Deep Agent routes <code>/memories/</code> to LangGraph's StoreBackend. The generic assistant API does not expose a safe memory-inspection endpoint for this app.</p></div><div className="notice-muted"><CircleAlert size={15} /> Inspect or manage stored memories through LangGraph Studio or a dedicated authenticated Store API.</div></> : <RuntimeEmpty message="The repository memory backend belongs to the Deep Agent graph." />}
    </section></div>
  </div>;
}

export function ApprovalsPage() {
  const { assistants, threads, refresh } = useAppContext();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [working, setWorking] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all(threads.slice(0, 30).map(async (thread) => {
      try {
        const state = await getThreadState(thread.thread_id);
        return { thread, interrupts: findInterrupts(state), failed: false };
      } catch {
        return { thread, interrupts: [], failed: true };
      }
    })).then((results) => {
      if (!active) return;
      const failures = results.filter((result) => result.failed).length;
      setWarning(failures ? `Could not inspect ${failures} recent thread state(s); their interrupt status is unknown.` : "");
      const found = results.flatMap(({ thread, interrupts }) => interrupts.map((interrupt) => ({
        thread,
        interrupt,
        assistant: assistants.find((item) => item.assistant_id === thread.metadata?.assistant_id || item.graph_id === thread.metadata?.assistant_id) || assistants[0],
      }))).filter((approval): approval is Approval => Boolean(approval.assistant));
      setApprovals(found);
      setSelected(Object.fromEntries(found.map((item) => [item.thread.thread_id, item.assistant.assistant_id])));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assistants, threads]);

  async function decide(approval: Approval, decision: "approve" | "reject") {
    const assistantId = selected[approval.thread.thread_id];
    if (!assistantId) return;
    setWorking(approval.thread.thread_id); setError("");
    try {
      await resumeThread(approval.thread.thread_id, assistantId, decision, { onToken: () => undefined, onProgress: () => undefined });
      setApprovals((current) => current.filter((item) => item.thread.thread_id !== approval.thread.thread_id));
      void refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking("");
    }
  }
  return <div className="page"><PageHeading eyebrow="HUMAN IN THE LOOP" title="Review before resuming." description="Interrupts are discovered from actual LangGraph thread state. Approve or reject to resume the originating graph." action={<button className="button button-quiet" onClick={() => void refresh()}><RefreshCw size={15} /> Refresh</button>} />
    {error && <div className="inline-error"><CircleAlert size={16} />{error}</div>}
    {warning && <div className="notice-muted"><CircleAlert size={15} />{warning}</div>}
    {loading ? <div className="panel loading-panel"><LoaderCircle size={18} className="spin" /> Checking recent thread states for interrupts…</div> : approvals.length ? <div className="approval-list">{approvals.map((approval) => <article className="panel approval-card" key={approval.thread.thread_id}><div className="approval-warning"><ShieldCheck size={21} /></div><div className="approval-content"><span className="section-kicker">LANGGRAPH INTERRUPT</span><h2>{approval.assistant.name}</h2><p className="approval-thread-id">Thread {approval.thread.thread_id}</p><pre>{JSON.stringify(approval.interrupt, null, 2)}</pre><label>Resume graph as<select value={selected[approval.thread.thread_id] || ""} onChange={(event) => setSelected((current) => ({ ...current, [approval.thread.thread_id]: event.target.value }))}>{assistants.map((assistant) => <option key={assistant.assistant_id} value={assistant.assistant_id}>{assistant.name}</option>)}</select></label><div className="approval-actions"><button className="button button-primary" disabled={working === approval.thread.thread_id} onClick={() => void decide(approval, "approve")}><Check size={15} /> Approve & resume</button><button className="button button-danger" disabled={working === approval.thread.thread_id} onClick={() => void decide(approval, "reject")}><X size={15} /> Reject & resume</button></div></div></article>)}</div> : <section className="panel"><div className="empty-state"><span className="empty-icon"><ShieldCheck size={20} /></span><strong>{threads.length ? "No pending interrupts found" : "No threads to review yet"}</strong><p>{threads.length ? "Recent LangGraph thread states did not report an interrupt." : "Interrupt-enabled workflows will appear here after they have run."}</p>{!threads.length && <Link className="button button-quiet" to="/app/command">Start a graph run <ArrowRight size={14} /></Link>}</div></section>}
  </div>;
}

export function HistoryPage() {
  const { assistants, threads } = useAppContext();
  const [selectedId, setSelectedId] = useState("");
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selected = threads.find((thread) => thread.thread_id === selectedId);
  async function inspect(threadId: string) {
    setSelectedId(threadId); setState(null); setError("");
    if (!threadId) return;
    setLoading(true);
    try { setState(await getThreadState(threadId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }
  return <div className="page"><PageHeading eyebrow="EXECUTION HISTORY" title="Every run, accounted for." description="Thread history is loaded from the LangGraph API. The deployment does not expose a separate execution archive." />
    <div className="history-layout"><section className="panel history-panel"><PanelTitle title="Recent threads" detail={`${threads.length} loaded from the API`} />
      {threads.length ? <div className="history-list">{threads.map((thread) => <button className={`history-item ${selectedId === thread.thread_id ? "history-selected" : ""}`} key={thread.thread_id} onClick={() => void inspect(thread.thread_id)}><span className={`timeline-dot dot-${statusTone(thread.status)}`} /><span className="history-item-main"><strong>{graphName(thread, assistants)}</strong><small>{thread.thread_id}</small></span><span className={`status-tag status-${statusTone(thread.status)}`}>{statusLabel(thread.status)}</span><small className="history-time">{relativeTime(thread.updated_at)}</small></button>)}</div> : <RuntimeEmpty />}
    </section><section className="panel history-detail"><PanelTitle title="Thread details" detail={selected?.thread_id || "Select a thread to inspect its checkpoint state"} />
      {loading ? <div className="loading-panel"><LoaderCircle size={17} className="spin" /> Loading thread state…</div> : error ? <div className="inline-error"><CircleAlert size={15} />{error}</div> : state ? <pre className="state-json">{JSON.stringify(state, null, 2)}</pre> : <div className="empty-state"><Clock3 size={22} /><strong>Execution context</strong><p>Inputs, graph values, next nodes, and interrupt details are fetched directly from LangGraph.</p></div>}
    </section></div>
  </div>;
}

function downloadText(filename: string, value: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([value], { type: `${mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

export function ExportsPage() {
  const { threads } = useAppContext();
  const [threadId, setThreadId] = useState("");
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    if (!threadId) return;
    setBusy(true); setError("");
    try { setState(await getThreadState(threadId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  const messages = useMemo(() => {
    const values = state?.values && typeof state.values === "object" ? state.values as Record<string, unknown> : {};
    return Array.isArray(values.messages) ? values.messages : [];
  }, [state]);
  const markdown = messages.map((message) => {
    const record = message && typeof message === "object" ? message as Record<string, unknown> : {};
    const role = roleFromMessage(record) === "user" ? "You" : "Agent";
    return `## ${role}\n\n${contentFromStateMessage(message)}`;
  }).join("\n\n");
  return <div className="page"><PageHeading eyebrow="EXPORT CENTER" title="Take your work with you." description="Export actual persisted thread state and agent responses from LangGraph." />
    <div className="export-layout"><section className="panel export-picker"><PanelTitle title="Choose a thread" detail="Thread state is fetched only when you request it." /><label htmlFor="export-thread">LangGraph thread</label><select id="export-thread" value={threadId} onChange={(event) => { setThreadId(event.target.value); setState(null); }}><option value="">Select a recent thread</option>{threads.map((thread) => <option key={thread.thread_id} value={thread.thread_id}>{thread.thread_id.slice(0, 22)} · {statusLabel(thread.status)}</option>)}</select><button className="button button-primary" disabled={!threadId || busy} onClick={() => void load()}>{busy ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} Load thread content</button>{error && <div className="inline-error"><CircleAlert size={14} />{error}</div>}<div className="export-options"><h3>Available formats</h3><button disabled={!state} onClick={() => state && downloadText("nexora-thread.md", markdown, "text/markdown")}><FileText size={16} /><span><strong>Markdown</strong><small>Conversation and agent responses</small></span><ArrowDownToLine size={15} /></button><button disabled={!state} onClick={() => state && downloadText("nexora-thread.txt", markdown)}><TerminalSquare size={16} /><span><strong>Plain text</strong><small>Readable text transcript</small></span><ArrowDownToLine size={15} /></button><button disabled={!state} onClick={() => state && downloadText("nexora-thread.json", JSON.stringify(state, null, 2), "application/json")}><FileJson2 size={16} /><span><strong>JSON</strong><small>Complete LangGraph checkpoint state</small></span><ArrowDownToLine size={15} /></button><button disabled={!state} onClick={() => window.print()}><FileText size={16} /><span><strong>Print / save as PDF</strong><small>Use your browser’s print dialog</small></span><ArrowDownToLine size={15} /></button></div></section><section className="panel export-preview"><PanelTitle title="Export preview" detail={state ? `${messages.length} message(s) in thread state` : "Load a thread to preview its contents"} />{state ? <pre className="research-result">{markdown || JSON.stringify(state, null, 2)}</pre> : <div className="research-placeholder"><FileText size={23} /><strong>Your generated output stays yours.</strong><p>Choose a thread to prepare a real export.</p></div>}</section></div>
  </div>;
}

export function SettingsPage() {
  const { health } = useAppContext();
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem("nexora-reduce-motion") === "true");
  function toggleMotion() {
    setReduceMotion((value) => {
      const next = !value;
      localStorage.setItem("nexora-reduce-motion", String(next));
      document.documentElement.dataset.reduceMotion = String(next);
      return next;
    });
  }
  useEffect(() => { document.documentElement.dataset.reduceMotion = String(reduceMotion); }, [reduceMotion]);
  return <div className="page"><PageHeading eyebrow="PREFERENCES" title="Settings." description="Runtime credentials and model behavior stay on the backend; this workspace never reads or stores API keys." />
    <div className="settings-stack"><section className="panel settings-section"><PanelTitle title="LangGraph runtime" detail="Connection settings for this browser session" /><div className="setting-row"><div><strong>API endpoint</strong><p>Set <code>VITE_LANGGRAPH_API_URL</code> for a remote deployment, or use the local proxy.</p></div><span className={`status-tag status-${health === "online" ? "idle" : "paused"}`}>{health === "online" ? "Connected" : "Not connected"}</span></div><div className="setting-row"><div><strong>Authentication</strong><p>Deployment authentication is managed by your LangGraph host or secure reverse proxy. No API token is stored in this frontend.</p></div><ShieldCheck size={18} className="setting-symbol" /></div></section>
      <section className="panel settings-section"><PanelTitle title="Model configuration" detail="Read-only view of the repository’s backend configuration" /><div className="setting-row"><div><strong>Configured model</strong><p><code>anthropic:claude-haiku-4-5</code> is selected in <code>utils/models.py</code>.</p></div><span className="status-tag status-idle">Backend configured</span></div><div className="setting-row"><div><strong>Provider configuration</strong><p>Provider credentials are read from server environment variables. Change providers in the existing Python model configuration—not in browser storage.</p></div><ExternalLink size={17} className="setting-symbol" /></div></section>
      <section className="panel settings-section"><PanelTitle title="Workspace preferences" detail="Stored locally in this browser" /><div className="setting-row"><div><strong>Reduce motion</strong><p>Reduce decorative interface transitions. System reduced-motion preferences are also respected.</p></div><button className={`toggle ${reduceMotion ? "toggle-on" : ""}`} aria-label="Reduce motion" aria-pressed={reduceMotion} onClick={toggleMotion}><span /></button></div><div className="setting-row"><div><strong>Appearance</strong><p>NEXORA dark navy theme with violet and cyan accents.</p></div><span className="theme-chip"><span /> Dark</span></div></section>
    </div>
  </div>;
}

const SAMPLE_OPERATIONS_BRIEF = `# NEXORA AI — MULTI-AGENT OPERATIONS BRIEF
Document Reference: NX-OPS-2026-B4
Classification: INTERNAL ENTERPRISE SPECIFICATION
Target Cluster: LangGraph Distributed Runtime (v0.17+)

## 1. Executive Summary & Operational Scope
This document outlines operational deployment standards for the NEXORA AI multi-agent cluster. The objective is to orchestrate specialized autonomous agents across complex enterprise workflows—spanning real-time web research, stateful customer communications, memory-augmented supervisor hierarchies, and human-in-the-loop compliance verification.

## 2. Cluster Architecture & Agent Registry
The active runtime hosts nine production graphs:
1. 101 Weather Agent: Base tool-augmented single-step execution benchmark.
2. Music Store Catalog Subagent: Specialized semantic querying over inventory metadata.
3. Music Store Invoice Subagent: Transaction validation and ledger record processing.
4. Music Store Supervisor: Autonomous orchestrator delegating between catalog and invoice subgraphs.
5. Music Store Supervisor with Verification: Human-in-the-loop gate requiring explicit operator confirmation before ledger mutation.
6. Music Store Supervisor with Memory and Verification: Long-term profile retrieval coupled with stateful interrupt validation.
7. Email Agent: Multi-stage triage pipeline routing customer inquiries and generating drafted replies.
8. Research Agent: Deep multi-node research graph coordinating recursive query formulation, Tavily web inspection, and cross-source evidence synthesis.
9. Deep Agent: Autonomous agent harness featuring AGENTS.md instruction encapsulation, on-demand skill compilation (LinkedIn/Twitter), and persistent StoreBackend memory.

## 3. Human-in-the-Loop (HITL) Protocol
State checkpoints that encounter safety thresholds or write operations must trigger a non-blocking graph interrupt. 
Operators review thread state through the NEXORA Approvals Center before dispatching resume payloads.
- Rule 1: No simulated approvals or fabricated state mutations.
- Rule 2: Checkpoint state serialization must retain full task trajectories for audit compliance.
- Rule 3: Timeout for pending interrupts is 48 hours before auto-suspension.

## 4. Key Performance Targets
- Thread State Discovery: < 120ms latency across 50 concurrent active runs.
- Streamed Token Latency: First-token arrival < 850ms via Anthropic Claude 3.5 / Haiku engines.
- Memory Persistence: Zero loss tolerance across worker restarts using StoreBackend.`;

export function DocumentsPage() {
  const { assistants, refresh } = useAppContext();
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; content: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [assistantId, setAssistantId] = useState("");
  const [analysisType, setAnalysisType] = useState("Executive Operations Summary");
  const [customInstructions, setCustomInstructions] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default assistant
  useEffect(() => {
    if (!assistants.some((a) => a.assistant_id === assistantId)) {
      const preferred = assistants.find((a) => /research|deep/i.test(`${a.name} ${a.graph_id}`)) || assistants[0];
      setAssistantId(preferred?.assistant_id || "");
    }
  }, [assistants, assistantId]);

  function loadSampleBrief() {
    setSelectedFile({
      name: "NEXORA_AI_Sample_Operations_Brief.pdf",
      size: 42800,
      content: SAMPLE_OPERATIONS_BRIEF,
    });
    setUploadProgress(100);
    setError(null);
  }

  function handleFileSelected(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds maximum allowed size of 25MB.");
      return;
    }
    setError(null);
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      setUploadProgress(100);
      setSelectedFile({
        name: file.name,
        size: file.size,
        content: text || `[Binary content from ${file.name} - Text representation prepared for agent analysis]`,
      });
    };
    reader.onerror = () => {
      setError("Could not read the uploaded document.");
      setUploadProgress(0);
    };

    if (file.type.includes("pdf")) {
      // In browser, read as text or extract
      reader.readAsText(file);
    } else {
      reader.readAsText(file);
    }
  }

  async function runDocumentAnalysis(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile || !assistantId || isAnalyzing) return;

    const agent = assistants.find((a) => a.assistant_id === assistantId);
    if (!agent) {
      setError("Please select a registered assistant.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult("");
    setAnalysisProgress(`Initializing analysis thread with ${agent.name}…`);

    const promptText = `Please analyze the following operational document (${selectedFile.name}) according to the mode: "${analysisType}".
${customInstructions.trim() ? `Specific instructions: ${customInstructions.trim()}\n` : ""}

DOCUMENT CONTENT:
"""
${selectedFile.content.slice(0, 15000)}
"""`;

    try {
      const thread = await createThread(agent.assistant_id);
      setAnalysisProgress(`Streaming analysis from ${agent.name}…`);
      await streamRun(
        thread.thread_id,
        agent.assistant_id,
        { messages: [{ role: "user", content: promptText }] },
        {
          onToken: (token) => setAnalysisResult((prev) => prev + token),
          onProgress: (p) => setAnalysisProgress(p),
        }
      );
      setAnalysisProgress("Document analysis complete.");
      void refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Analysis unavailable: ${msg}. Make sure 'langgraph dev' is active and configured.`);
      setAnalysisProgress("");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function copyResult() {
    if (!analysisResult) return;
    void navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedAssistant = assistants.find((a) => a.assistant_id === assistantId);

  return (
    <div className="page">
      <PageHeading
        eyebrow="DOCUMENT INTELLIGENCE"
        title="Document analysis."
        description="Upload operational briefs, PDFs, or research notes. Select a connected LangGraph agent to extract intelligence and stream structured analysis."
        action={
          <div className="heading-actions">
            <button className="button button-quiet" onClick={loadSampleBrief}>
              <Sparkles size={15} /> Load sample brief
            </button>
            {selectedFile && (
              <button className="button button-quiet" onClick={() => { setSelectedFile(null); setAnalysisResult(""); }}>
                <X size={15} /> Clear
              </button>
            )}
          </div>
        }
      />

      <div className="document-layout">
        <section className="panel document-upload-panel">
          <PanelTitle
            title="Document ingestion"
            detail="Supports .pdf, .txt, .md, .json, .csv files up to 25MB."
            action={
              <div className="doc-emblem">
                <CorollaGleam size={36} intensity={1.1} speed={0.8} />
              </div>
            }
          />

          {!selectedFile ? (
            <div
              className={`document-dropzone ${isDragging ? "dropzone-active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileSelected(file);
              }}
            >
              <UploadCloud size={36} className="dropzone-icon" />
              <strong>Drag & drop your document here</strong>
              <p>or click to browse your local filesystem</p>
              <label className="button button-primary dropzone-browse">
                Browse file
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.json,.csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                />
              </label>
              <small className="dropzone-hint">
                Try loading the pre-configured sample: <code>NEXORA_AI_Sample_Operations_Brief.pdf</code>
              </small>
            </div>
          ) : (
            <div className="document-loaded-card">
              <div className="loaded-file-header">
                <div className="loaded-icon"><FileText size={22} /></div>
                <div className="loaded-meta">
                  <strong>{selectedFile.name}</strong>
                  <small>{(selectedFile.size / 1024).toFixed(1)} KB · Text content parsed</small>
                </div>
                <span className="status-tag status-idle"><Check size={12} /> Ready</span>
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="progress-bar-wrap">
                  <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}

              <form className="analysis-config-form" onSubmit={(e) => void runDocumentAnalysis(e)}>
                <label>
                  <span>Select agent for analysis</span>
                  <select
                    value={assistantId}
                    onChange={(e) => setAssistantId(e.target.value)}
                    disabled={isAnalyzing || !assistants.length}
                  >
                    {assistants.length ? (
                      assistants.map((a) => (
                        <option key={a.assistant_id} value={a.assistant_id}>
                          {a.name} ({a.graph_id})
                        </option>
                      ))
                    ) : (
                      <option value="">No registered agents found</option>
                    )}
                  </select>
                </label>

                <label>
                  <span>Analysis mode</span>
                  <select
                    value={analysisType}
                    onChange={(e) => setAnalysisType(e.target.value)}
                    disabled={isAnalyzing}
                  >
                    <option value="Executive Operations Summary">Executive Operations Summary</option>
                    <option value="Key Action Items & Risk Matrix">Key Action Items & Risk Matrix</option>
                    <option value="Agent Task Delegation Plan">Agent Task Delegation Plan</option>
                    <option value="Full Architectural Breakdown">Full Architectural Breakdown</option>
                  </select>
                </label>

                <label>
                  <span>Custom instructions (optional)</span>
                  <textarea
                    rows={3}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="E.g., Highlight multi-agent communication latencies and human-in-the-loop policies."
                    disabled={isAnalyzing}
                  />
                </label>

                {error && (
                  <div className="inline-error">
                    <CircleAlert size={15} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={isAnalyzing || !assistantId}
                >
                  {isAnalyzing ? (
                    <><LoaderCircle size={15} className="spin" /> {analysisProgress || "Analyzing document…"}</>
                  ) : (
                    <><Play size={15} /> Analyze with {selectedAssistant?.name || "Agent"}</>
                  )}
                </button>
              </form>
            </div>
          )}
        </section>

        <section className="panel document-output-panel">
          <PanelTitle
            title="Analysis results"
            detail={analysisProgress || (selectedFile ? "Live agent analysis output" : "Upload a document to begin")}
            action={
              analysisResult && (
                <div className="result-actions">
                  <button className="icon-button" title="Copy to clipboard" onClick={copyResult}>
                    {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    className="icon-button"
                    title="Export Markdown"
                    onClick={() => downloadText(`${selectedFile?.name || "document"}-analysis.md`, analysisResult, "text/markdown")}
                  >
                    <ArrowDownToLine size={14} />
                  </button>
                </div>
              )
            }
          />

          {isAnalyzing && !analysisResult ? (
            <div className="document-analyzing-state">
              <CorollaGleam size={80} intensity={1.2} speed={1.1} />
              <strong>Synthesizing document intelligence…</strong>
              <p>{analysisProgress}</p>
            </div>
          ) : analysisResult ? (
            <pre className="research-result analysis-output">{analysisResult}</pre>
          ) : selectedFile ? (
            <div className="document-preview-wrap">
              <div className="preview-label">PARSED DOCUMENT PREVIEW</div>
              <pre className="document-parsed-content">{selectedFile.content}</pre>
            </div>
          ) : (
            <div className="research-placeholder">
              <div className="research-orbit">
                <FileText size={24} />
              </div>
              <strong>Grounded document intelligence.</strong>
              <p>Upload reports, briefs, or schemas to produce multi-agent analysis powered by real LangGraph graphs.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
