"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Network, RefreshCw } from "lucide-react";
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
  summary: string;
  hoverTitle: string;
  hoverText: string;
  tags: string[];
  detailItems: Array<{ label: string; value: string }>;
  longText: string;
  listLabel?: string;
  listItems: string[];
  sections?: Array<{ title: string; items: string[] }>;
};

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

  const supervisorIds = response.nodes
    .filter(
      (node) => node.type === "agent" && node.data.agent.sub_agents.length > 0
    )
    .map((node) => node.id);

  const childAgentIds = supervisorIds
    .flatMap((id) => outgoing.get(id) ?? [])
    .filter((id) => nodeMap.get(id)?.type === "agent");

  const standaloneAgentIds = response.nodes
    .filter((node) => node.type === "agent")
    .map((node) => node.id)
    .filter((id) => !supervisorIds.includes(id) && !childAgentIds.includes(id));

  supervisorIds.forEach((id, index) => {
    positionMap.set(id, { x: 520 + index * 320, y: 20 });
  });

  childAgentIds.forEach((id, index) => {
    positionMap.set(id, { x: 80 + index * 330, y: 300 });
  });

  standaloneAgentIds.forEach((id, index) => {
    positionMap.set(id, { x: 80 + index * 330, y: 620 });
  });

  for (const [sourceId, targets] of outgoing.entries()) {
    const sourcePosition = positionMap.get(sourceId);
    if (!sourcePosition) {
      continue;
    }

    const resourceTargets = targets.filter((targetId) => {
      const type = nodeMap.get(targetId)?.type;
      return type === "connector" || type === "mcp";
    });

    resourceTargets.forEach((targetId, index) => {
      const offset = (index - (resourceTargets.length - 1) / 2) * 220;
      positionMap.set(targetId, {
        x: sourcePosition.x + offset,
        y: sourcePosition.y + 240,
      });
    });
  }

  return positionMap;
}

function fallbackPosition(index: number) {
  return { x: 80 + index * 280, y: 940 };
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
        summary: node.id,
        hoverTitle: node.id,
        hoverText: node.id,
        tags: [],
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
    summary: agent.description,
    hoverTitle: agent.name,
    hoverText: truncate(agent.instruction, 160),
    tags: [agent.model.name, `${relationships.length} links`],
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
    summary: connector.description ?? `${connector.config.length} config keys`,
    hoverTitle: connector.name,
    hoverText: `${connector.connector_id} with ${connector.config.length} config keys.`,
    tags: [connector.connector_id, `${connector.config.length} keys`],
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
    summary: mcp.url,
    hoverTitle: mcp.name,
    hoverText: mcp.url,
    tags: ["MCP", parsedUrl.hostname],
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
  const statusTone = getStatusTone(data.status);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-sky-500 !bg-white"
      />
      <div
        className={`group relative border bg-white text-left shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_24px_60px_rgba(15,23,42,0.14)] ${
          isAgent
            ? "min-w-72 rounded-2xl border-slate-200 px-4 py-4"
            : "min-w-52 rounded-2xl border-slate-200 px-3 py-3"
        }`}
      >
        <div className="flex items-start gap-3">
          <NodeLogo kind={data.kind} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                  {data.role}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  {data.name}
                </div>
              </div>
              <div
                className={`mt-1 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {data.status}
              </div>
            </div>
            <div className="mt-2 text-sm leading-5 text-slate-600">
              {data.summary}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="uppercase tracking-[0.18em] text-slate-400">
              Kind
            </div>
            <div className="mt-1 font-medium text-slate-700">{data.kind}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="uppercase tracking-[0.18em] text-slate-400">
              Details
            </div>
            <div className="mt-1 font-medium text-slate-700">
              {data.detailItems.length} fields
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {data.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800"
            >
              {tag}
            </span>
          ))}
        </div>

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

function getStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized === "active" ||
    normalized === "linked" ||
    normalized === "configured"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "inactive" || normalized === "disabled") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
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

  const counts = useMemo(() => {
    const nodes = graph?.nodes ?? [];
    return {
      agents: nodes.filter((node) => node.data.kind === "agent").length,
      connectors: nodes.filter((node) => node.data.kind === "connector").length,
      mcps: nodes.filter((node) => node.data.kind === "mcp").length,
      edges: graph?.edges.length ?? 0,
    };
  }, [graph]);

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
    <div className="space-y-8">
      <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
                <Network className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-[#111827]">
                  Agent Visualizer
                </h2>
                <p className="mt-1 text-sm text-[#5b6476]">
                  Live graph for agents, connector configs, and MCP servers.
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm text-[#667085]">
              Source endpoint:{" "}
              <span className="font-medium text-[#344054]">{visualizerUrl}</span>
            </p>
          </div>

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

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Agents" value={counts.agents} />
          <StatCard label="Connectors" value={counts.connectors} />
          <StatCard label="MCP Servers" value={counts.mcps} />
          <StatCard label="Connections" value={counts.edges} />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
        {isLoading ? (
          <div className="flex min-h-[720px] items-center justify-center rounded-3xl border border-dashed border-[#d9deea] bg-[linear-gradient(135deg,#f8faff_0%,#f3f5fb_100%)]">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#c7d2fe] border-t-[#4f49e2]" />
              <p className="mt-4 text-sm font-semibold text-[#344054]">
                Loading visualizer canvas
              </p>
            </div>
          </div>
        ) : loadError ? (
          <div className="flex min-h-[720px] items-center justify-center rounded-3xl border border-[#fee2e2] bg-[#fff5f5] px-6 text-center">
            <div>
              <p className="text-base font-semibold text-[#b91c1c]">
                Unable to load visualizer graph
              </p>
              <p className="mt-2 text-sm text-[#c2410c]">{loadError}</p>
            </div>
          </div>
        ) : graph ? (
          <div className="h-[720px] overflow-hidden rounded-3xl border border-[#e6eaf2] bg-[radial-gradient(circle_at_top,#f8faff_0%,#f5f7fc_48%,#f1f4fa_100%)]">
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={visualizerNodeTypes}
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
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#e8eefb] bg-[#f8faff] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
