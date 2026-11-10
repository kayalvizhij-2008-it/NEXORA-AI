import type { Assistant, AssistantGraph, ThreadSummary } from "../types";

const apiBase = (import.meta.env.VITE_LANGGRAPH_API_URL || "/langgraph-api").replace(/\/$/, "");

export class LangGraphApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "LangGraphApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new LangGraphApiError(`Could not reach the LangGraph API at ${apiBase}. Start the server with "langgraph dev" and check VITE_LANGGRAPH_API_URL.`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new LangGraphApiError(body || `LangGraph API returned ${response.status}.`, response.status);
  }
  return response.json() as Promise<T>;
}

function listFrom<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as Record<string, unknown>)[key])) {
    return (value as Record<string, unknown>)[key] as T[];
  }
  return [];
}

export async function getHealth(): Promise<boolean> {
  const response = await fetch(`${apiBase}/ok`);
  if (!response.ok) throw new LangGraphApiError(`LangGraph health check returned ${response.status}.`, response.status);
  return true;
}

export async function getAssistants(): Promise<Assistant[]> {
  const result = await request<unknown>("/assistants/search", {
    method: "POST",
    body: JSON.stringify({ limit: 100 }),
  });
  return listFrom<Record<string, unknown>>(result, "assistants").map((item) => ({
    assistant_id: String(item.assistant_id || item.id || ""),
    graph_id: String(item.graph_id || ""),
    name: String(item.name || item.graph_id || "Unnamed assistant"),
    description: typeof item.description === "string" ? item.description : undefined,
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata as Record<string, unknown> : undefined,
  })).filter((assistant) => assistant.assistant_id && assistant.graph_id);
}

export async function getThreads(limit = 50): Promise<ThreadSummary[]> {
  const result = await request<unknown>("/threads/search", {
    method: "POST",
    body: JSON.stringify({ limit, sort_by: "updated_at", sort_order: "desc" }),
  });
  return listFrom<Record<string, unknown>>(result, "threads").map((item) => ({
    thread_id: String(item.thread_id || ""),
    status: typeof item.status === "string" ? item.status : undefined,
    updated_at: typeof item.updated_at === "string" ? item.updated_at : undefined,
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata as Record<string, unknown> : undefined,
  })).filter((thread) => thread.thread_id);
}

export async function createThread(assistantId?: string): Promise<ThreadSummary> {
  const result = await request<Record<string, unknown>>("/threads", {
    method: "POST",
    body: JSON.stringify({ metadata: { product: "NEXORA AI", ...(assistantId ? { assistant_id: assistantId } : {}) } }),
  });
  const threadId = String(result.thread_id || "");
  if (!threadId) throw new LangGraphApiError("LangGraph created a thread without returning a thread_id.");
  return {
    thread_id: threadId,
    status: typeof result.status === "string" ? result.status : undefined,
    metadata: assistantId ? { product: "NEXORA AI", assistant_id: assistantId } : undefined,
  };
}

function textFromMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const message = value as Record<string, unknown>;
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
        return (part as Record<string, string>).text;
      }
      return "";
    }).join("");
  }
  return "";
}

function streamText(payload: unknown): string {
  if (Array.isArray(payload)) return textFromMessage(payload[0]);
  return textFromMessage(payload);
}

export type RunCallbacks = {
  onToken: (text: string) => void;
  onProgress: (stage: string) => void;
};

export async function streamRun(
  threadId: string,
  assistantId: string,
  input: Record<string, unknown>,
  callbacks: RunCallbacks,
  command?: Record<string, unknown>,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}/threads/${encodeURIComponent(threadId)}/runs/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        assistant_id: assistantId,
        ...(command ? { command } : { input }),
        stream_mode: ["messages-tuple", "updates"],
      }),
    });
  } catch {
    throw new LangGraphApiError(`Could not connect to the LangGraph API at ${apiBase}.`);
  }
  if (!response.ok) {
    throw new LangGraphApiError((await response.text()) || `Run request returned ${response.status}.`, response.status);
  }
  if (!response.body) throw new LangGraphApiError("The LangGraph API did not return a readable stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];

  const processEvent = () => {
    if (!dataLines.length) return;
    const raw = dataLines.join("\n");
    dataLines = [];
    if (raw === "[DONE]") return;
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      callbacks.onProgress(`Received an unrecognized ${eventName} event.`);
      return;
    }

    if (eventName.includes("message")) {
      const text = streamText(payload);
      if (text) callbacks.onToken(text);
    } else if (eventName.includes("updates")) {
      const stage = payload && typeof payload === "object" ? Object.keys(payload as object)[0] : "";
      if (stage) callbacks.onProgress(stage.replaceAll("_", " "));
    } else if (eventName === "error") {
      const message = payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : "LangGraph reported a run error.";
      throw new LangGraphApiError(message);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        processEvent();
        eventName = "message";
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      processEvent();
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getThreadState(threadId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/threads/${encodeURIComponent(threadId)}/state`);
}

export async function getAssistantGraph(assistantId: string): Promise<AssistantGraph> {
  const graph = await request<AssistantGraph>(`/assistants/${encodeURIComponent(assistantId)}/graph`);
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new LangGraphApiError("LangGraph returned a graph without a readable nodes/edges schema.");
  }
  return graph;
}

export async function resumeThread(
  threadId: string,
  assistantId: string,
  decision: "approve" | "reject",
  callbacks: RunCallbacks,
): Promise<void> {
  await streamRun(threadId, assistantId, {}, callbacks, {
    resume: { decisions: [{ type: decision }] },
  });
}
