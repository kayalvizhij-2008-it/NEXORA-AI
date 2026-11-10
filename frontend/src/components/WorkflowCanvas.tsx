import { useMemo, useState } from "react";
import type { AssistantGraph, GraphNode } from "../types";

type WorkflowCanvasProps = {
  graph: AssistantGraph;
  nextNodes?: string[];
  onSelectNode?: (node: GraphNode) => void;
};

const nodeWidth = 162;
const nodeHeight = 58;
const columnGap = 54;
const rowGap = 24;
const margin = 30;

function nodeName(node: GraphNode) {
  return node.data?.name || node.id;
}

function layout(graph: AssistantGraph) {
  const nodes = graph.nodes;
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  const rank = new Map<string, number>();
  while (queue.length) {
    const id = queue.shift()!;
    const currentRank = rank.get(id) || 0;
    for (const next of outgoing.get(id) || []) {
      rank.set(next, Math.max(rank.get(next) || 0, currentRank + 1));
      incoming.set(next, Math.max(0, (incoming.get(next) || 1) - 1));
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  for (const node of nodes) {
    if (!rank.has(node.id)) rank.set(node.id, rank.size ? Math.max(...rank.values()) + 1 : 0);
  }

  const columns = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const column = rank.get(node.id) || 0;
    columns.set(column, [...(columns.get(column) || []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const [column, columnNodes] of columns) {
    columnNodes.forEach((node, row) => positions.set(node.id, {
      x: margin + column * (nodeWidth + columnGap),
      y: margin + row * (nodeHeight + rowGap),
    }));
  }
  const height = Math.max(280, ...[...columns.values()].map((items) => margin * 2 + items.length * (nodeHeight + rowGap)));
  const width = Math.max(540, margin * 2 + columns.size * (nodeWidth + columnGap) - columnGap);
  return { positions, width, height };
}

export function WorkflowCanvas({ graph, nextNodes = [], onSelectNode }: WorkflowCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const geometry = useMemo(() => layout(graph), [graph]);
  const currentNodes = new Set(nextNodes);
  const selected = graph.nodes.find((node) => node.id === selectedNode);

  return (
    <div className="workflow-canvas-shell">
      <div className="workflow-canvas-scroll">
        <svg
          className="workflow-canvas"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          role="img"
          aria-label="Interactive graph visualization returned by LangGraph"
        >
          <defs>
            <marker id="workflow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#7770a9" />
            </marker>
          </defs>
          {graph.edges.map((edge, index) => {
            const source = geometry.positions.get(edge.source);
            const target = geometry.positions.get(edge.target);
            if (!source || !target) return null;
            const x1 = source.x + nodeWidth;
            const y1 = source.y + nodeHeight / 2;
            const x2 = target.x;
            const y2 = target.y + nodeHeight / 2;
            const curve = Math.max(24, (x2 - x1) / 2);
            return (
              <path
                key={`${edge.source}-${edge.target}-${index}`}
                className={`workflow-edge ${edge.conditional ? "workflow-edge-conditional" : ""}`}
                d={`M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`}
                markerEnd="url(#workflow-arrow)"
              />
            );
          })}
          {graph.nodes.map((node) => {
            const position = geometry.positions.get(node.id);
            if (!position) return null;
            const active = currentNodes.has(node.id);
            const selected = selectedNode === node.id;
            return (
              <g
                key={node.id}
                className={`workflow-node ${active ? "workflow-node-next" : ""} ${selected ? "workflow-node-selected" : ""}`}
                transform={`translate(${position.x} ${position.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Graph node ${nodeName(node)}${active ? ", next node" : ""}`}
                onClick={() => { setSelectedNode(node.id); onSelectNode?.(node); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedNode(node.id);
                    onSelectNode?.(node);
                  }
                }}
              >
                <rect width={nodeWidth} height={nodeHeight} rx="12" />
                <circle cx="18" cy="21" r="4" />
                <text x="30" y="24">{nodeName(node).slice(0, 20)}</text>
                <text className="workflow-node-type" x="30" y="42">{active ? "NEXT IN CHECKPOINT" : node.type || "GRAPH NODE"}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="workflow-canvas-footer">
        <span>{graph.nodes.length} nodes</span>
        <span>{graph.edges.length} edges</span>
        {nextNodes.length > 0 && <span className="workflow-next-key">Next checkpoint: {nextNodes.join(", ")}</span>}
      </div>
      {selected && <div className="workflow-node-detail"><strong>{nodeName(selected)}</strong><span>{selected.type || "Graph node"} · {selected.id}</span></div>}
    </div>
  );
}
