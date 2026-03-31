"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { RefreshCw } from "lucide-react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import {
  type VisualizerAgent,
  type VisualizerConnector,
  type VisualizerMcp,
  type VisualizerNode,
  type VisualizerResponse,
} from "./data";

export type GraphKind = "agent" | "connector" | "mcp";

export type GraphNodeData = {
  id: string;
  kind: GraphKind;
  name: string;
  role: string;
  status: string;
  description: string;
  llm: string;
  hoverTitle: string;
  hoverText: string;
  detailItems: Array<{ label: string; value: string }>;
  longText: string;
  listLabel?: string;
  listItems: string[];
  sections?: Array<{ title: string; items: string[] }>;
};

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

  const nodes: Node<GraphNodeData>[] = response.nodes.map((node, index) => ({
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
  const resourceOwner = new Map<string, string>();

  for (const edge of response.edges) {
    const sourceType = nodeMap.get(edge.source)?.type;
    const targetType = nodeMap.get(edge.target)?.type;
    if (
      sourceType === "agent" &&
      (targetType === "connector" || targetType === "mcp") &&
      !resourceOwner.has(edge.target)
    ) {
      resourceOwner.set(edge.target, edge.source);
    }
  }

  const agentIds = response.nodes
    .filter((node) => node.type === "agent")
    .map((node) => node.id);

  const supervisorIds = agentIds
    .filter((id) => isSupervisorAgent(nodeMap.get(id)))
    .sort((left, right) => compareNodes(left, right, nodeMap));

  const otherAgentIds = agentIds
    .filter((id) => !supervisorIds.includes(id))
    .sort((left, right) => compareNodes(left, right, nodeMap));

  const resourcesByAgent = new Map<string, string[]>();
  resourceOwner.forEach((ownerId, resourceId) => {
    const resources = resourcesByAgent.get(ownerId) ?? [];
    resources.push(resourceId);
    resourcesByAgent.set(ownerId, resources);
  });

  resourcesByAgent.forEach((resourceIds, ownerId) => {
    resourceIds.sort((left, right) => compareNodes(left, right, nodeMap));
    resourcesByAgent.set(ownerId, resourceIds);
  });

  const agentSpanWidth = (agentId: string) => {
    const resources = resourcesByAgent.get(agentId) ?? [];
    const resourceWidth = getRowWidth(resources, nodeMap);
    return Math.max(getNodeWidth(agentId, nodeMap), resourceWidth);
  };

  const supervisorChildren = new Map<string, string[]>();
  supervisorIds.forEach((supervisorId) => {
    const childAgents = (outgoing.get(supervisorId) ?? [])
      .filter((targetId) => nodeMap.get(targetId)?.type === "agent")
      .sort((left, right) => compareNodes(left, right, nodeMap));
    supervisorChildren.set(supervisorId, childAgents);
  });

  const assignedAgents = new Set<string>();
  let currentLeft = START_X;

  supervisorIds.forEach((supervisorId, index) => {
    const children = supervisorChildren.get(supervisorId) ?? [];
    const rowWidth = getRowWidth(children, nodeMap, agentSpanWidth);
    const supervisorWidth = getNodeWidth(supervisorId, nodeMap);
    const blockWidth = Math.max(supervisorWidth, rowWidth);

    if (index > 0) {
      currentLeft += ROOT_GAP;
    }

    const supervisorX = currentLeft + (blockWidth - supervisorWidth) / 2;
    positionMap.set(supervisorId, { x: supervisorX, y: SUPERVISOR_Y });
    assignedAgents.add(supervisorId);

    let childLeft = currentLeft;
    children.forEach((childId) => {
      const childBlockWidth = agentSpanWidth(childId);
      const childNodeWidth = getNodeWidth(childId, nodeMap);
      positionMap.set(childId, {
        x: childLeft + (childBlockWidth - childNodeWidth) / 2,
        y: AGENT_Y,
      });
      assignedAgents.add(childId);

      layoutResourcesForAgent(
        childId,
        childLeft,
        positionMap,
        resourcesByAgent,
        nodeMap
      );

      childLeft += childBlockWidth + SIBLING_GAP;
    });

    currentLeft += blockWidth;
  });

  const unassignedAgents = otherAgentIds.filter((id) => !assignedAgents.has(id));

  if (unassignedAgents.length > 0) {
    if (currentLeft > START_X) {
      currentLeft += ROOT_GAP;
    }

    let agentLeft = currentLeft;
    unassignedAgents.forEach((agentId) => {
      const blockWidth = agentSpanWidth(agentId);
      const agentWidth = getNodeWidth(agentId, nodeMap);
      positionMap.set(agentId, {
        x: agentLeft + (blockWidth - agentWidth) / 2,
        y: AGENT_Y,
      });
      layoutResourcesForAgent(
        agentId,
        agentLeft,
        positionMap,
        resourcesByAgent,
        nodeMap
      );
      agentLeft += blockWidth + SIBLING_GAP;
    });
  }

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

function layoutResourcesForAgent(
  agentId: string,
  left: number,
  positionMap: Map<string, { x: number; y: number }>,
  resourcesByAgent: Map<string, string[]>,
  nodeMap: Map<string, VisualizerNode>
) {
  const resourceIds = resourcesByAgent.get(agentId) ?? [];
  let resourceLeft = left;

  resourceIds.forEach((resourceId) => {
    const resourceWidth = getNodeWidth(resourceId, nodeMap);
    positionMap.set(resourceId, {
      x: resourceLeft,
      y: RESOURCE_Y,
    });
    resourceLeft += resourceWidth + SIBLING_GAP;
  });
}

function getRowWidth(
  nodeIds: string[],
  nodeMap: Map<string, VisualizerNode>,
  getWidth?: (nodeId: string) => number
) {
  if (nodeIds.length === 0) {
    return 0;
  }

  return nodeIds.reduce((sum, nodeId, index) => {
    const width = getWidth ? getWidth(nodeId) : getNodeWidth(nodeId, nodeMap);
    return sum + width + (index > 0 ? SIBLING_GAP : 0);
  }, 0);
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
  return node.id;
}

function buildNodeData(node: VisualizerNode): GraphNodeData {
  switch (node.type) {
    case "agent":
      return buildAgentNodeData(node.data.agent);
    case "connector":
      return buildConnectorNodeData(node.data.connector);
    case "mcp":
      return buildMcpNodeData(node.data.mcp);
    default:
      return {
        id: node.id,
        kind: "mcp",
        name: node.id,
        role: "Unknown",
        status: "unknown",
        description: node.id,
        llm: "N/A",
        hoverTitle: node.id,
        hoverText: node.id,
        detailItems: [],
        longText: node.id,
        listItems: [],
      };
  }
}

function buildAgentNodeData(agent: VisualizerAgent): GraphNodeData {
  const relationships = [
    ...agent.sub_agents.map((item) => `Sub-agent: ${item}`),
    ...agent.connector_config_ids.map((item) => `Connector: ${item}`),
    ...agent.mcp_servers.map((item) => `MCP: ${item}`),
  ];

  return {
    id: agent.agent_id,
    kind: "agent",
    name: agent.name,
    role: `${agent.type} | ${agent.model.provider}`,
    status: agent.status,
    description: agent.description,
    llm: agent.model.name,
    hoverTitle: agent.name,
    hoverText: truncate(agent.instruction, 160),
    detailItems: [
      { label: "Agent id", value: agent.agent_id },
      { label: "Type", value: agent.type },
      { label: "Provider", value: agent.model.provider },
      { label: "Model", value: agent.model.name },
      { label: "Status", value: agent.status },
      { label: "Enabled", value: agent.isEnabled ? "True" : "False" },
      { label: "Webhooks", value: `${agent.webhooks.length}` },
    ],
    longText: agent.instruction,
    listLabel: relationships.length > 0 ? "Relationships" : undefined,
    listItems: relationships,
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
      {
        title: "Webhook prompts",
        items: agent.webhooks.map((item) => item.prompt),
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
    status: "configured",
    description:
      connector.description ?? `${connector.config.length} config keys configured`,
    llm: "N/A",
    hoverTitle: connector.name,
    hoverText: `${connector.connector_id} with ${connector.config.length} config keys.`,
    detailItems: [
      { label: "Connector id", value: connector.connector_id },
      { label: "Config id", value: connector.connector_config_id },
      { label: "Config keys", value: `${connector.config.length}` },
      { label: "Created", value: formatDate(connector.created_at) },
      { label: "Updated", value: formatDate(connector.updated_at) },
    ],
    longText:
      connector.description ??
      "Connector configuration used by the linked agent to call an external platform.",
    listLabel: "Config keys",
    listItems: connector.config.map((item) => item.name),
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
    status: "linked",
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
    listItems: [],
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
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
  data,
}: NodeProps<Node<GraphNodeData>["data"]>) {
  if (!data) {
    return null;
  }

  const isAgent = data.kind === "agent";

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-sky-500 !bg-white"
      />
      <div
        className="group relative w-[320px] rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
      >
        <div className="flex items-start gap-3">
          <NodeLogo kind={data.kind} />
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

        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 hidden w-80 -translate-x-1/2 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs text-slate-200 shadow-2xl group-hover:block">
          <div className="text-[10px] uppercase tracking-[0.22em] text-sky-300">
            Hover preview
          </div>
          <div className="mt-2 text-sm font-medium text-white">
            {data.hoverTitle}
          </div>
          <div className="mt-2 leading-5 text-slate-300">{data.hoverText}</div>
        </div>
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

export default function VisualizerView() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const visualizerUrl = `${trimTrailingSlash(llmManagerApiBaseUrl)}/visualizer/`;

  const [graph, setGraph] = useState<ReturnType<typeof createVisualizerGraph> | null>(
    null
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
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
          setGraph(null);
          return;
        }

        setGraph(
          createVisualizerGraph({
            nodes: data.nodes,
            edges: data.edges,
          })
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (mounted) {
          setLoadError("Unable to load visualizer graph.");
          setGraph(null);
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
  }, [visualizerUrl]);

  useEffect(() => {
    setNodes(graph?.nodes ?? []);
    setEdges(graph?.edges ?? []);
  }, [graph, setEdges, setNodes]);

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

      setGraph(
        createVisualizerGraph({
          nodes: data.nodes,
          edges: data.edges,
        })
      );
    } catch {
      setLoadError("Unable to load visualizer graph.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section className="flex h-[calc(100vh-180px)] min-h-[720px] flex-col rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="mb-4 flex justify-end">
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
        <div className="flex min-h-[720px] flex-1 items-center justify-center rounded-3xl border border-dashed border-[#d9deea] bg-[linear-gradient(135deg,#f8faff_0%,#f3f5fb_100%)]">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#c7d2fe] border-t-[#4f49e2]" />
            <p className="mt-4 text-sm font-semibold text-[#344054]">
              Loading visualizer canvas
            </p>
          </div>
        </div>
      ) : loadError ? (
        <div className="flex min-h-[720px] flex-1 items-center justify-center rounded-3xl border border-[#fee2e2] bg-[#fff5f5] px-6 text-center">
          <div>
            <p className="text-base font-semibold text-[#b91c1c]">
              Unable to load visualizer graph
            </p>
            <p className="mt-2 text-sm text-[#c2410c]">{loadError}</p>
          </div>
        </div>
      ) : graph ? (
        <div className="h-full min-h-0 flex-1 overflow-hidden rounded-3xl border border-[#e6eaf2] bg-[radial-gradient(circle_at_top,#f8faff_0%,#f5f7fc_48%,#f1f4fa_100%)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={visualizerNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
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
      ) : null}
    </section>
  );
}
