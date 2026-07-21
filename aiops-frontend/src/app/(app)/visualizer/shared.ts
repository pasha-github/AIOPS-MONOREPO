import type { Node } from "@xyflow/react";

export type GraphKind = "agent" | "skill" | "connector" | "mcp" | "hub";

export type GraphNodeData = {
  id: string;
  kind: GraphKind;
  name: string;
  role: string;
  description: string;
  llm: string;
  hoverTitle: string;
  hoverText: string;
  detailItems: Array<{ label: string; value: string }>;
  modelDetails?: Array<{ label: string; value: string }>;
  expandableDetails?: Array<{
    title: string;
    items: Array<Array<{ label: string; value: string }>>;
    emptyText?: string;
  }>;
  longText: string;
  sections?: Array<{ title: string; items: string[] }>;
};

export type GraphFlowNode = Node<GraphNodeData, "visualizer" | "visualizerHub">;

export const NODE_WIDTH: Record<GraphKind, number> = {
  agent: 300,
  skill: 300,
  connector: 300,
  mcp: 300,
  hub: 18,
};

export const LANE_Y = {
  supervisor: 40,
  agent: 805,
  skill: 1705,
  resource: 2605,
} as const;

export const LANE_DEFINITIONS = [
  {
    key: "supervisor",
    label: "Supervisor Agents",
    hint: "Root orchestration agents",
    color: "from-sky-50 to-cyan-50",
    border: "border-sky-100",
  },
  {
    key: "agent",
    label: "Child Agents",
    hint: "Execution and domain agents",
    color: "from-emerald-50 to-teal-50",
    border: "border-emerald-100",
  },
  {
    key: "skill",
    label: "Skills",
    hint: "Tooling and instructions",
    color: "from-violet-50 to-fuchsia-50",
    border: "border-violet-100",
  },
  {
    key: "resource",
    label: "Connectors and MCP Clients",
    hint: "External systems and protocol endpoints",
    color: "from-orange-50 to-amber-50",
    border: "border-orange-100",
  },
  
] as const;

export const VISUALIZER_EDGE_COLORS = {
  agentToAgent: "#2563eb",
  agentToSkill: "#0f766e",
  connector: "#f97316",
  mcp: "#8b5cf6",
  default: "#0284c7",
  hub: "#94a3b8",
} as const;
