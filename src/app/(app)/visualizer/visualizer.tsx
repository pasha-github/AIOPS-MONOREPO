"use client";

import "@xyflow/react/dist/style.css";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    NodeToolbar,
    Position,
    ReactFlow,
    useEdgesState,
    useNodesState,
    type Edge,
    type Node,
    type NodeProps,
} from "@xyflow/react";
import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
    type VisualizerAgent,
    type VisualizerConnector,
    type VisualizerJob,
    type VisualizerMcp,
    type VisualizerNode,
    type VisualizerResponse,
    type VisualizerWebhook,
} from "./data";

export type GraphKind = "agent" | "connector" | "mcp";

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

type GraphFlowNode = Node<GraphNodeData, "visualizer">;

const NODE_WIDTH: Record<GraphKind, number> = {
  agent: 320,
  connector: 320,
  mcp: 320,
};

const SUPERVISOR_Y = 40;
const AGENT_Y = 320;
const RESOURCE_Y = 600;
const SIBLING_GAP = 72;
const ROOT_GAP = 120;
const START_X = 80;

export function createVisualizerGraph(response: VisualizerResponse) {
  const nodeMap = new Map(response.nodes.map((node) => [node.id, node]));
  const outgoing = buildOutgoingEdges(response);
  const positionMap = createPositionMap(response, nodeMap, outgoing);

  const nodes: GraphFlowNode[] = response.nodes.map((node, index) => ({
    id: node.id,
    type: "visualizer",
    position: positionMap.get(node.id) ?? fallbackPosition(index),
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: buildNodeData(node),
  }));

  const edges: Edge[] = response.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "simplebezier",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: getEdgeColor(nodeMap.get(edge.target)?.type),
    },
    style: {
      stroke: getEdgeColor(nodeMap.get(edge.target)?.type),
      strokeWidth: 3,
    },
  }));

  return { nodes, edges };
}

function buildOutgoingEdges(response: VisualizerResponse) {
  const outgoing = new Map<string, string[]>();

  for (const edge of response.edges) {
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }

  return outgoing;
}

function createPositionMap(
  response: VisualizerResponse,
  nodeMap: Map<string, VisualizerNode>,
  outgoing: Map<string, string[]>
) {
  const positionMap = new Map<string, { x: number; y: number }>();
  const parentAgents = new Map<string, string[]>();
  const resourceParents = new Map<string, string[]>();

  for (const edge of response.edges) {
    const sourceType = nodeMap.get(edge.source)?.type;
    const targetType = nodeMap.get(edge.target)?.type;

    if (sourceType === "agent" && targetType === "agent") {
      const parents = parentAgents.get(edge.target) ?? [];
      parents.push(edge.source);
      parentAgents.set(edge.target, parents);
    }

    if (
      sourceType === "agent" &&
      (targetType === "connector" || targetType === "mcp")
    ) {
      const parents = resourceParents.get(edge.target) ?? [];
      parents.push(edge.source);
      resourceParents.set(edge.target, parents);
    }
  }

  const agentIds = response.nodes
    .filter((node) => node.type === "agent")
    .map((node) => node.id);

  const rootAgentIds = agentIds
    .filter((id) => {
      const childAgents = (outgoing.get(id) ?? []).filter(
        (targetId) => nodeMap.get(targetId)?.type === "agent"
      );
      return childAgents.length > 0 || isSupervisorAgent(nodeMap.get(id));
    })
    .sort((left, right) => compareNodes(left, right, nodeMap));

  const childAgentIds = agentIds
    .filter((id) => !rootAgentIds.includes(id))
    .sort((left, right) => compareNodes(left, right, nodeMap));

  const orderedChildAgents = childAgentIds.sort((leftId, rightId) => {
    const leftParents = parentAgents.get(leftId) ?? [];
    const rightParents = parentAgents.get(rightId) ?? [];
    const leftAnchor = getIndexAnchor(leftParents, rootAgentIds);
    const rightAnchor = getIndexAnchor(rightParents, rootAgentIds);

    if (leftAnchor !== rightAnchor) {
      return leftAnchor - rightAnchor;
    }

    return compareNodes(leftId, rightId, nodeMap);
  });

  placeNodesInRow(
    orderedChildAgents,
    () => null,
    AGENT_Y,
    positionMap,
    nodeMap
  );

  const rootAnchors = new Map<string, number>();
  rootAgentIds.forEach((rootId, index) => {
    const childCenters = ((outgoing.get(rootId) ?? [])
      .filter((targetId) => nodeMap.get(targetId)?.type === "agent")
      .map((targetId) => getNodeCenter(targetId, positionMap, nodeMap))
      .filter((value): value is number => typeof value === "number"));

    rootAnchors.set(
      rootId,
      childCenters.length > 0
        ? childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length
        : START_X + index * (NODE_WIDTH.agent + ROOT_GAP) + NODE_WIDTH.agent / 2
    );
  });

  const orderedRoots = [...rootAgentIds].sort((leftId, rightId) => {
    const leftAnchor = rootAnchors.get(leftId) ?? 0;
    const rightAnchor = rootAnchors.get(rightId) ?? 0;

    if (leftAnchor !== rightAnchor) {
      return leftAnchor - rightAnchor;
    }

    return compareNodes(leftId, rightId, nodeMap);
  });

  placeNodesInRow(
    orderedRoots,
    (nodeId) => rootAnchors.get(nodeId) ?? null,
    SUPERVISOR_Y,
    positionMap,
    nodeMap
  );

  const resourceIds = response.nodes
    .filter((node) => node.type === "connector" || node.type === "mcp")
    .map((node) => node.id)
    .sort((leftId, rightId) => {
      const leftParents = resourceParents.get(leftId) ?? [];
      const rightParents = resourceParents.get(rightId) ?? [];
      const leftAnchor = getPositionAnchor(leftParents, positionMap, nodeMap);
      const rightAnchor = getPositionAnchor(rightParents, positionMap, nodeMap);

      if (leftAnchor !== rightAnchor) {
        return leftAnchor - rightAnchor;
      }

      return compareNodes(leftId, rightId, nodeMap);
    });

  placeNodesInRow(
    resourceIds,
    (nodeId) => getPositionAnchor(resourceParents.get(nodeId) ?? [], positionMap, nodeMap),
    RESOURCE_Y,
    positionMap,
    nodeMap
  );

  response.nodes.forEach((node, index) => {
    if (!positionMap.has(node.id)) {
      positionMap.set(node.id, fallbackPosition(index));
    }
  });

  return positionMap;
}

function fallbackPosition(index: number) {
  return { x: 80 + index * 280, y: 940 };
}

function placeNodesInRow(
  nodeIds: string[],
  getAnchor: (nodeId: string) => number | null,
  y: number,
  positionMap: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, VisualizerNode>
) {
  let currentLeft = START_X;

  nodeIds.forEach((nodeId) => {
    const width = getNodeWidth(nodeId, nodeMap);
    const anchor = getAnchor(nodeId);
    const desiredLeft =
      typeof anchor === "number" ? anchor - width / 2 : currentLeft;
    const x = Math.max(currentLeft, desiredLeft);

    positionMap.set(nodeId, { x, y });
    currentLeft = x + width + SIBLING_GAP;
  });

  if (nodeIds.length === 0) {
    return;
  }

  const leftMost = Math.min(
    ...nodeIds.map((nodeId) => positionMap.get(nodeId)?.x ?? START_X)
  );
  const shift = leftMost - START_X;

  if (shift > 0) {
    nodeIds.forEach((nodeId) => {
      const current = positionMap.get(nodeId);
      if (!current) {
        return;
      }
      positionMap.set(nodeId, { x: current.x - shift, y: current.y });
    });
  }
}

function getIndexAnchor(
  ids: string[],
  orderedIds: string[]
) {
  if (ids.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const anchors = ids
    .map((id) => orderedIds.indexOf(id))
    .filter((index) => index >= 0);

  if (anchors.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return anchors.reduce((sum, value) => sum + value, 0) / anchors.length;
}

function getPositionAnchor(
  nodeIds: string[],
  positionMap: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, VisualizerNode>
) {
  const centers = nodeIds
    .map((nodeId) => getNodeCenter(nodeId, positionMap, nodeMap))
    .filter((value): value is number => typeof value === "number");

  if (centers.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return centers.reduce((sum, value) => sum + value, 0) / centers.length;
}

function getNodeCenter(
  nodeId: string,
  positionMap: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, VisualizerNode>
) {
  const position = positionMap.get(nodeId);
  if (!position) {
    return null;
  }

  return position.x + getNodeWidth(nodeId, nodeMap) / 2;
}

function getNodeWidth(nodeId: string, nodeMap: Map<string, VisualizerNode>) {
  const nodeType = nodeMap.get(nodeId)?.type;
  if (nodeType === "agent" || nodeType === "connector" || nodeType === "mcp") {
    return NODE_WIDTH[nodeType];
  }
  return NODE_WIDTH.agent;
}

function isSupervisorAgent(node?: VisualizerNode) {
  if (!node || node.type !== "agent") {
    return false;
  }

  const name = node.data.agent.name.trim().toLowerCase();
  const agentId = node.data.agent.agent_id.trim().toLowerCase();
  return (
    agentId === "supervisor" ||
    name === "supervisor agent" ||
    node.data.agent.sub_agents.length > 0
  );
}

function compareNodes(
  leftId: string,
  rightId: string,
  nodeMap: Map<string, VisualizerNode>
) {
  const leftNode = nodeMap.get(leftId);
  const rightNode = nodeMap.get(rightId);
  const leftTypeWeight = getTypeWeight(leftNode?.type);
  const rightTypeWeight = getTypeWeight(rightNode?.type);

  if (leftTypeWeight !== rightTypeWeight) {
    return leftTypeWeight - rightTypeWeight;
  }

  return getDisplayName(leftNode).localeCompare(getDisplayName(rightNode), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function getTypeWeight(type?: VisualizerNode["type"]) {
  if (type === "agent") {
    return 0;
  }
  if (type === "connector") {
    return 1;
  }
  if (type === "mcp") {
    return 2;
  }
  return 3;
}

function getDisplayName(node?: VisualizerNode) {
  if (!node) {
    return "";
  }

  if (node.type === "agent") {
    return node.data.agent.name || node.id;
  }
  if (node.type === "connector") {
    return node.data.connector.name || node.id;
  }
  if (node.type === "mcp") {
    return node.data.mcp.name || node.id;
  }
  return "";
}

function buildNodeData(node: VisualizerNode): GraphNodeData {
  switch (node.type) {
    case "agent":
      return buildAgentNodeData(node.data.agent);
    case "connector":
      return buildConnectorNodeData(node.data.connector);
    case "mcp":
      return buildMcpNodeData(node.data.mcp);
  }

  return {
    id: "",
    kind: "mcp",
    name: "",
    role: "Unknown",
    description: "",
    llm: "N/A",
    hoverTitle: "",
    hoverText: "",
    detailItems: [],
    expandableDetails: [],
    longText: "",
  };
}

function buildAgentNodeData(agent: VisualizerAgent): GraphNodeData {
  return {
    id: agent.agent_id,
    kind: "agent",
    name: agent.name,
    role: `${agent.type} | ${agent.model.provider}`,
    description: agent.description,
    llm: agent.model.name,
    hoverTitle: agent.name,
    hoverText: truncate(agent.instruction, 160),
    detailItems: [
      { label: "Agent id", value: agent.agent_id },
      { label: "Type", value: agent.type },
      { label: "Status", value: agent.status },
      { label: "Enabled", value: agent.isEnabled ? "True" : "False" },
      { label: "Webhooks", value: `${agent.webhooks.length}` },
      { label: "Jobs", value: `${agent.jobs?.length ?? 0}` },
      { label: "Created at", value: formatDateTime(agent.created_at) },
      { label: "Updated at", value: formatDateTime(agent.updated_at) },
    ],
    modelDetails: [
      { label: "Provider", value: agent.model.provider },
      { label: "Name", value: agent.model.name },
      { label: "Description", value: agent.model.description ?? "-" },
      { label: "Enabled", value: agent.model.isEnabled ? "True" : "False" },
      { label: "Created at", value: formatDateTime(agent.model.created_at) },
      { label: "Updated at", value: formatDateTime(agent.model.updated_at) },
    ],
    expandableDetails: [
      {
        title: "Webhooks",
        items: agent.webhooks.map((webhook) => buildWebhookDetails(webhook)),
        emptyText: "No webhooks configured",
      },
      {
        title: "Jobs",
        items: (agent.jobs ?? []).map((job) => buildJobDetails(job)),
        emptyText: "No jobs configured",
      },
    ],
    longText: agent.instruction,
    sections: [
      {
        title: "Sub-agents",
        items: agent.sub_agents,
      },
      {
        title: "Connector ids",
        items: agent.connector_config_ids,
      },
      {
        title: "MCP servers",
        items: agent.mcp_servers,
      },
    ].filter((section) => section.items.length > 0),
  };
}

function buildConnectorNodeData(connector: VisualizerConnector): GraphNodeData {
  return {
    id: connector.connector_config_id,
    kind: "connector",
    name: connector.name,
    role: connector.connector_id,
    description:
      connector.description ?? `${connector.config.length} config keys configured`,
    llm: "N/A",
    hoverTitle: connector.name,
    hoverText: `${connector.connector_id} with ${connector.config.length} config keys.`,
    detailItems: [
      { label: "Config keys", value: `${connector.config.length}` },
      { label: "Created at", value: formatDateTime(connector.created_at) },
      { label: "Updated at", value: formatDateTime(connector.updated_at) },
    ],
    longText:
      connector.description ??
      "Connector configuration used by the linked agent to call an external platform.",
    sections: [
      {
        title: "Config entries",
        items: connector.config.map((item) => item.name),
      },
    ],
  };
}

function buildMcpNodeData(mcp: VisualizerMcp): GraphNodeData {
  const parsedUrl = new URL(mcp.url);

  return {
    id: mcp.url,
    kind: "mcp",
    name: mcp.name,
    role: "MCP Server",
    description: mcp.url,
    llm: "N/A",
    hoverTitle: mcp.name,
    hoverText: mcp.url,
    detailItems: [
      { label: "Name", value: mcp.name },
      { label: "URL", value: mcp.url },
      { label: "Host", value: parsedUrl.hostname },
      { label: "Protocol", value: parsedUrl.protocol.replace(":", "") },
    ],
    longText:
      "Model Context Protocol server linked to an agent in the visualizer response.",
    sections: [
      {
        title: "Endpoint",
        items: [mcp.url],
      },
    ],
  };
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildWebhookDetails(webhook: VisualizerWebhook) {
  return [
    { label: "Prompt", value: webhook.prompt || "-" },
    { label: "Created at", value: formatDateTime(webhook.created_at) },
    { label: "Updated at", value: formatDateTime(webhook.updated_at) },
  ];
}

function buildJobDetails(job: VisualizerJob) {
  return [
    { label: "Prompt", value: job.prompt || "-" },
    {
      label: "Interval seconds",
      value:
        typeof job.interval_seconds === "number"
          ? String(job.interval_seconds)
          : "-",
    },
    { label: "Cron expression", value: job.cron_expression || "-" },
    { label: "Created at", value: formatDateTime(job.created_at) },
    { label: "Updated at", value: formatDateTime(job.updated_at) },
  ];
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEdgeColor(nodeType?: VisualizerNode["type"]) {
  if (nodeType === "connector") {
    return "#f97316";
  }
  if (nodeType === "mcp") {
    return "#8b5cf6";
  }
  return "#0284c7";
}

export function VisualizerNodeCard({
  id,
  data,
}: NodeProps<GraphFlowNode>) {
  const [isHovered, setIsHovered] = useState(false);

  if (!data) {
    return null;
  }

  const kind = data.kind;
  const isAgent = kind === "agent";

  return (
    <>
      <NodeToolbar
        nodeId={id}
        isVisible={isHovered}
        position={Position.Bottom}
        offset={12}
      >
        <div className="pointer-events-none w-80 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs text-slate-200 shadow-2xl">
          <div className="text-[10px] uppercase tracking-[0.22em] text-sky-300">
            Hover preview
          </div>
          <div className="mt-2 text-sm font-medium text-white">
            {data.hoverTitle}
          </div>
          <div className="mt-2 leading-5 text-slate-300">{data.hoverText}</div>
        </div>
      </NodeToolbar>
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-sky-500 !bg-white"
      />
      <div
        className="relative z-10 w-[320px] rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-shadow hover:z-50 hover:shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-start gap-3">
          <NodeLogo kind={kind} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                  {data.role}
                </div>
                <div
                  className="mt-1 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-lg font-semibold text-slate-950"
                  title={data.name}
                >
                  {data.name}
                </div>
              </div>
            </div>
            <div className="mt-2 min-h-[48px] break-words text-sm leading-5 text-slate-600">
              {data.description}
            </div>
          </div>
        </div>

        {isAgent ? (
          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              LLM
            </div>
            <div className="mt-1 break-words text-sm font-medium text-slate-700">
              {data.llm}
            </div>
          </div>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-sky-500 !bg-white"
      />
    </>
  );
}

export const visualizerNodeTypes = {
  visualizer: VisualizerNodeCard,
};

export function getMiniMapColor(kind?: GraphKind) {
  if (kind === "agent") {
    return "#10b981";
  }
  if (kind === "connector") {
    return "#f97316";
  }
  if (kind === "mcp") {
    return "#8b5cf6";
  }
  return "#38bdf8";
}

function NodeLogo({ kind }: { kind: GraphKind }) {
  const palette = {
    agent: "from-sky-600 to-cyan-500",
    connector: "from-orange-500 to-amber-500",
    mcp: "from-violet-600 to-fuchsia-500",
  }[kind];

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${palette} text-white shadow-lg`}
    >
      {kind === "agent" ? (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 fill-none stroke-current stroke-[1.8]"
        >
          <rect x="5" y="5" width="14" height="14" rx="4" />
          <path d="M9 12h6M12 9v6" />
        </svg>
      ) : null}
      {kind === "connector" ? (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 fill-none stroke-current stroke-[1.8]"
        >
          <path d="M10 7H7a4 4 0 0 0 0 8h3" />
          <path d="M14 7h3a4 4 0 0 1 0 8h-3" />
          <path d="M8 12h8" />
        </svg>
      ) : null}
      {kind === "mcp" ? (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 fill-none stroke-current stroke-[1.8]"
        >
          <path d="M9 8V5H7v3H5v2h2v3h2v-3h2V8Z" />
          <path d="M15 11h4M17 9v4" />
          <path d="M5 17h14" />
        </svg>
      ) : null}
    </div>
  );
}

function renderMarkdownBlocks(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const className =
        level === 1
          ? "text-lg font-semibold text-[#111827]"
          : level === 2
            ? "text-base font-semibold text-[#111827]"
            : "text-sm font-semibold text-[#111827]";

      blocks.push(
        <p key={`md-heading-${index}`} className={className}>
          {content}
        </p>
      );
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol
          key={`md-ordered-${index}`}
          className="list-decimal space-y-2 pl-5 text-sm leading-7 text-[#344054]"
        >
          {items.map((item, itemIndex) => (
            <li key={`md-ordered-item-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul
          key={`md-unordered-${index}`}
          className="list-disc space-y-2 pl-5 text-sm leading-7 text-[#344054]"
        >
          {items.map((item, itemIndex) => (
            <li key={`md-unordered-item-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current ||
        /^(#{1,6})\s+/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        /^[-*]\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(
        <p
          key={`md-paragraph-${index}`}
          className="text-sm leading-7 text-[#344054]"
        >
          {paragraphLines.join(" ")}
        </p>
      );
      continue;
    }

    index += 1;
  }

  return blocks;
}

export default function VisualizerView() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const visualizerUrl = `${trimTrailingSlash(llmManagerApiBaseUrl)}/visualizer/`;

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadGraph = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await fetch(visualizerUrl, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const data = (await response.json()) as Partial<VisualizerResponse>;

        if (!mounted) {
          return;
        }

        if (
          !response.ok ||
          !Array.isArray(data.nodes) ||
          !Array.isArray(data.edges)
        ) {
          setLoadError("Unable to load visualizer graph.");
          setNodes([]);
          setEdges([]);
          return;
        }

        const nextGraph = createVisualizerGraph({
          nodes: data.nodes,
          edges: data.edges,
        });
        setNodes(nextGraph.nodes);
        setEdges(nextGraph.edges);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (mounted) {
          setLoadError("Unable to load visualizer graph.");
          setNodes([]);
          setEdges([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadGraph();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [setEdges, setNodes, visualizerUrl]);

  useEffect(() => {
    if (!selectedNode) {
      return;
    }

    const stillExists = nodes.some((node) => node.id === selectedNode.id);
    if (!stillExists) {
      setSelectedNode(null);
    }
  }, [nodes, selectedNode]);

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setLoadError("");

    try {
      const response = await fetch(visualizerUrl, {
        headers: { accept: "application/json" },
      });
      const data = (await response.json()) as Partial<VisualizerResponse>;

      if (
        !response.ok ||
        !Array.isArray(data.nodes) ||
        !Array.isArray(data.edges)
      ) {
        setLoadError("Unable to load visualizer graph.");
        return;
      }

      const nextGraph = createVisualizerGraph({
        nodes: data.nodes,
        edges: data.edges,
      });
      setNodes(nextGraph.nodes);
      setEdges(nextGraph.edges);
    } catch {
      setLoadError("Unable to load visualizer graph.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section className="-m-10 flex h-[calc(100vh-73px)] min-h-[720px] flex-col bg-[radial-gradient(circle_at_top,#f8faff_0%,#f5f7fc_48%,#f1f4fa_100%)]">
      <div className="flex justify-end px-6 py-4">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_10px_20px_-16px_rgba(79,73,226,0.5)] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh Graph
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[720px] flex-1 bg-[linear-gradient(135deg,#f8faff_0%,#f3f5fb_100%)] px-6 pb-6">
          <div className="relative h-full min-h-[720px] w-full overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
            </div>

            {[
              { left: "23%", top: "8%", width: "320px", height: "148px" },
              { left: "4%", top: "38%", width: "320px", height: "170px" },
              { left: "25%", top: "38%", width: "320px", height: "170px" },
              { left: "46%", top: "38%", width: "320px", height: "170px" },
              { left: "67%", top: "38%", width: "320px", height: "170px" },
              { left: "88%", top: "38%", width: "320px", height: "170px" },
              { left: "4%", top: "70%", width: "320px", height: "120px" },
              { left: "25%", top: "70%", width: "320px", height: "120px" },
              { left: "46%", top: "70%", width: "320px", height: "120px" },
              { left: "67%", top: "70%", width: "320px", height: "120px" },
              { left: "88%", top: "70%", width: "320px", height: "120px" },
            ].map((item, index) => (
              <div
                key={`visualizer-skeleton-${index}`}
                className="absolute animate-pulse rounded-2xl border border-[#e5eaf3] bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
                style={{
                  left: item.left,
                  top: item.top,
                  width: item.width,
                  height: item.height,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-[#edf2f9]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-[#edf2f9]" />
                    <div className="h-5 w-40 rounded bg-[#edf2f9]" />
                    <div className="h-4 w-full rounded bg-[#edf2f9]" />
                    <div className="h-4 w-4/5 rounded bg-[#edf2f9]" />
                  </div>
                </div>
                <div className="mt-4 h-12 rounded-xl bg-[#edf2f9]" />
              </div>
            ))}
          </div>
        </div>
      ) : loadError ? (
        <div className="flex min-h-[720px] flex-1 items-center justify-center bg-[#fff5f5] px-6 text-center">
          <div>
            <p className="text-base font-semibold text-[#b91c1c]">
              Unable to load visualizer graph
            </p>
            <p className="mt-2 text-sm text-[#c2410c]">{loadError}</p>
          </div>
        </div>
      ) : (
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={visualizerNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelectedNode(node.data)}
            className="h-full w-full"
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.25}
            maxZoom={1.6}
            nodesDraggable
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#dbe3f0" />
            <MiniMap
              zoomable
              pannable
              nodeStrokeWidth={3}
              nodeColor={(node) => getMiniMapColor((node.data as GraphNodeData)?.kind)}
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}

      {selectedNode ? (
        <>
          <button
            type="button"
            aria-label="Close details"
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setSelectedNode(null)}
          />
          <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col border-l border-[#e6eaf2] bg-white shadow-[-24px_0_60px_-38px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between border-b border-[#eef1f7] px-6 py-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b94a7]">
                  {selectedNode.role}
                </p>
                <h3
                  className="mt-2 truncate text-xl font-semibold text-[#111827]"
                  title={selectedNode.name}
                >
                  {selectedNode.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#5b6476]">
                  {selectedNode.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5e7eb] text-[#475467] transition hover:bg-[#f8fafc]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <section className="border-b border-[#eef1f7] pb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                  Description
                </p>
                <p className="mt-3 text-sm leading-7 text-[#344054]">
                  {selectedNode.description || "No description available."}
                </p>
              </section>

              {selectedNode.kind === "agent" ? (
                <section className="border-b border-[#eef1f7] pb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                    LLM
                  </p>
                  <p className="mt-3 break-words text-sm font-semibold text-[#111827]">
                    {selectedNode.llm}
                  </p>
                </section>
              ) : null}

              {selectedNode.detailItems.length > 0 ? (
                <section className="border-b border-[#eef1f7] pb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                    Details
                  </p>
                  <div className="mt-4 divide-y divide-[#eef1f7]">
                    {selectedNode.detailItems.map((item) => (
                      <div
                        key={`${selectedNode.id}-${item.label}`}
                        className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b94a7]">
                          {item.label}
                        </p>
                        <p className="break-words text-sm font-medium text-[#111827]">
                          {item.value || "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {selectedNode.kind === "agent" && selectedNode.modelDetails?.length ? (
                <section className="border-b border-[#eef1f7] pb-6">
                  <details className="group" open>
                    <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                      <span className="inline-flex items-center gap-2">
                        Model Details
                        <span className="text-[#667085] transition group-open:rotate-180">
                          ▼
                        </span>
                      </span>
                    </summary>
                    <div className="mt-4 divide-y divide-[#eef1f7]">
                      {selectedNode.modelDetails.map((item) => (
                        <div
                          key={`${selectedNode.id}-model-${item.label}`}
                          className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 py-3"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b94a7]">
                            {item.label}
                          </p>
                          <p className="break-words text-sm font-medium text-[#111827]">
                            {item.value || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                </section>
              ) : null}

              {selectedNode.expandableDetails?.length
                ? selectedNode.expandableDetails.map((section) => (
                    <section
                      key={`${selectedNode.id}-${section.title}`}
                      className="border-b border-[#eef1f7] pb-6"
                    >
                      <details className="group" open>
                        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                          <span className="inline-flex items-center gap-2">
                            {section.title}
                            <span className="text-[#667085] transition group-open:rotate-180">
                              ▼
                            </span>
                          </span>
                        </summary>
                        {section.items.length > 0 ? (
                          <div className="mt-4 space-y-5">
                            {section.items.map((detailGroup, index) => (
                              <div
                                key={`${selectedNode.id}-${section.title}-${index}`}
                                className="border-b border-[#eef1f7] pb-4 last:border-b-0"
                              >
                                <p className="mb-3 text-sm font-semibold text-[#111827]">
                                  {section.title.slice(0, -1)} {index + 1}
                                </p>
                                <div className="divide-y divide-[#eef1f7]">
                                  {detailGroup.map((item) => (
                                    <div
                                      key={`${selectedNode.id}-${section.title}-${index}-${item.label}`}
                                      className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 py-3"
                                    >
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b94a7]">
                                        {item.label}
                                      </p>
                                      <p className="break-words text-sm font-medium text-[#111827]">
                                        {item.value || "-"}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-[#667085]">
                            {section.emptyText ?? "No data available"}
                          </p>
                        )}
                      </details>
                    </section>
                  ))
                : null}

              {selectedNode.longText ? (
                <section className="border-b border-[#eef1f7] pb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                    {selectedNode.kind === "agent" ? "Instruction" : "Overview"}
                  </p>
                  <div className="mt-4 space-y-4 break-words">
                    {renderMarkdownBlocks(selectedNode.longText)}
                  </div>
                </section>
              ) : null}

              {selectedNode.sections?.length ? (
                <section className="pb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                    Linked Items
                  </p>
                  <div className="mt-4 space-y-4">
                    {selectedNode.sections.map((section) => (
                      <div
                        key={`${selectedNode.id}-${section.title}`}
                        className="border-b border-[#eef1f7] pb-4 last:border-b-0"
                      >
                        <p className="text-sm font-semibold text-[#111827]">
                          {section.title}
                        </p>
                        <div className="mt-3 space-y-2">
                          {section.items.map((item, index) => (
                            <p
                              key={`${selectedNode.id}-${section.title}-${index}`}
                              className="break-words text-sm leading-6 text-[#344054]"
                              title={item}
                            >
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
