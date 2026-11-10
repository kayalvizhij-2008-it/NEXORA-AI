export type Assistant = {
  assistant_id: string;
  graph_id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type GraphNode = {
  id: string;
  type?: string;
  data?: { name?: string; [key: string]: unknown };
};

export type GraphEdge = {
  source: string;
  target: string;
  conditional?: boolean;
  data?: Record<string, unknown>;
};

export type AssistantGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type ThreadSummary = {
  thread_id: string;
  status?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
  assistants?: Assistant[];
};

export type ChatEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  assistant?: string;
  status?: "running" | "complete" | "error";
};

export type Approval = {
  thread: ThreadSummary;
  assistant: Assistant;
  interrupt: unknown;
};
