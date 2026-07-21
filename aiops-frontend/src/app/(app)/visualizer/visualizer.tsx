"use client";

import "@xyflow/react/dist/style.css";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { VisualizerResponse } from "./data";
import VisualizerAgentSwitcher from "./VisualizerAgentSwitcher";
import VisualizerDetailsPanel from "./VisualizerDetailsPanel";
import { createVisualizerGraph } from "./graphTransform";
import type { GraphFlowNode, GraphNodeData } from "./shared";
import VisualizerKey from "./VisualizerKey";
import { getMiniMapColor, visualizerNodeTypes } from "./VisualizerNodeCard";

async function loadVisualizerGraph(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal,
  });
  const data = (await response.json()) as Partial<VisualizerResponse>;

  if (!response.ok || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error("Unable to load visualizer graph.");
  }

  return createVisualizerGraph({
    nodes: data.nodes,
    edges: data.edges,
  });
}

function buildFocusedGraph(
  allNodes: GraphFlowNode[],
  allEdges: Edge[],
  focusedAgentId: string | null
) {
  if (!focusedAgentId) {
    return { nodes: allNodes, edges: allEdges };
  }

  const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
  const focusedNode = nodeMap.get(focusedAgentId);
  if (focusedNode?.data.kind !== "agent") {
    return { nodes: allNodes, edges: allEdges };
  }

  const adjacency = new Map<string, Set<string>>();
  allEdges.forEach((edge) => {
    const sourceNeighbors = adjacency.get(edge.source) ?? new Set<string>();
    sourceNeighbors.add(edge.target);
    adjacency.set(edge.source, sourceNeighbors);

    const targetNeighbors = adjacency.get(edge.target) ?? new Set<string>();
    targetNeighbors.add(edge.source);
    adjacency.set(edge.target, targetNeighbors);
  });

  const includedIds = new Set<string>([focusedAgentId]);
  const directNeighbors = Array.from(adjacency.get(focusedAgentId) ?? []);

  directNeighbors.forEach((neighborId) => {
    includedIds.add(neighborId);
  });

  directNeighbors.forEach((neighborId) => {
    const neighborKind = nodeMap.get(neighborId)?.data.kind;
    if (neighborKind !== "hub" && neighborKind !== "skill") {
      return;
    }

    Array.from(adjacency.get(neighborId) ?? []).forEach((secondaryId) => {
      includedIds.add(secondaryId);
    });
  });

  return {
    nodes: allNodes.filter((node) => includedIds.has(node.id)),
    edges: allEdges.filter(
      (edge) => includedIds.has(edge.source) && includedIds.has(edge.target)
    ),
  };
}

function buildSelectedRoute(
  nodes: GraphFlowNode[],
  edges: Edge[],
  selectedEdge: Edge | null
) {
  if (!selectedEdge) {
    return {
      highlightedNodeIds: null as Set<string> | null,
      highlightedEdgeIds: null as Set<string> | null,
    };
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const bridgeKinds = new Set(["hub", "skill"]);
  const visitedBridgeIds = new Set<string>();
  const queue: string[] = [];
  const highlightedNodeIds = new Set<string>([selectedEdge.source, selectedEdge.target]);
  const highlightedEdgeIds = new Set<string>([selectedEdge.id]);

  [selectedEdge.source, selectedEdge.target].forEach((nodeId) => {
    const nodeKind = nodeMap.get(nodeId)?.data.kind;
    if (nodeKind && bridgeKinds.has(nodeKind)) {
      visitedBridgeIds.add(nodeId);
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;

    edges.forEach((edge) => {
      if (edge.source !== currentId && edge.target !== currentId) {
        return;
      }

      highlightedEdgeIds.add(edge.id);
      const oppositeId = edge.source === currentId ? edge.target : edge.source;
      highlightedNodeIds.add(oppositeId);

      const oppositeKind = nodeMap.get(oppositeId)?.data.kind;
      if (oppositeKind && bridgeKinds.has(oppositeKind) && !visitedBridgeIds.has(oppositeId)) {
        visitedBridgeIds.add(oppositeId);
        queue.push(oppositeId);
      }
    });
  }

  return { highlightedNodeIds, highlightedEdgeIds };
}

function VisualizerSkeleton() {
  return (
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
          { left: "18%", top: "7%", width: "300px", height: "130px" },
          { left: "18%", top: "32%", width: "300px", height: "140px" },
          { left: "40%", top: "32%", width: "300px", height: "140px" },
          { left: "62%", top: "32%", width: "300px", height: "140px" },
          { left: "84%", top: "32%", width: "300px", height: "140px" },
          { left: "29%", top: "58%", width: "300px", height: "124px" },
          { left: "51%", top: "58%", width: "300px", height: "124px" },
          { left: "73%", top: "58%", width: "300px", height: "124px" },
          { left: "18%", top: "80%", width: "300px", height: "116px" },
          { left: "40%", top: "80%", width: "300px", height: "116px" },
          { left: "62%", top: "80%", width: "300px", height: "116px" },
          { left: "84%", top: "80%", width: "300px", height: "116px" },
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
                <div className="h-5 w-36 rounded bg-[#edf2f9]" />
                <div className="h-4 w-full rounded bg-[#edf2f9]" />
                <div className="h-4 w-4/5 rounded bg-[#edf2f9]" />
              </div>
            </div>
            <div className="mt-4 h-10 rounded-xl bg-[#edf2f9]" />
          </div>
        ))}
      </div>
    </div>
  );
}

type VisualizerViewProps = {
  showAgentSwitcher?: boolean;
  showDetailsPanel?: boolean;
};

export default function VisualizerView({
  showAgentSwitcher = true,
  showDetailsPanel = true,
}: VisualizerViewProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const visualizerUrl = `${trimTrailingSlash(llmManagerApiBaseUrl)}/visualizer/`;

  const [allNodes, setAllNodes] = useState<GraphFlowNode[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<GraphFlowNode, Edge> | null>(null);

  const hydrateGraph = useCallback(
    async (signal?: AbortSignal) => {
      const nextGraph = await loadVisualizerGraph(visualizerUrl, signal);
      setAllNodes(nextGraph.nodes);
      setAllEdges(nextGraph.edges);
    },
    [setAllEdges, setAllNodes, visualizerUrl]
  );

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        await hydrateGraph(controller.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (mounted) {
          setLoadError("Unable to load visualizer graph.");
          setAllNodes([]);
          setAllEdges([]);
          setNodes([]);
          setEdges([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [hydrateGraph, setEdges, setNodes]);

  useEffect(() => {
    const nextGraph = buildFocusedGraph(allNodes, allEdges, focusedAgentId);
    setNodes(nextGraph.nodes);
    setEdges(nextGraph.edges);
  }, [allEdges, allNodes, focusedAgentId, setEdges, setNodes]);

  useEffect(() => {
    if (!selectedNode) return;

    const stillExists = nodes.some((node) => node.id === selectedNode.id);
    if (!stillExists) {
      setSelectedNode(null);
    }
  }, [nodes, selectedNode]);

  useEffect(() => {
    if (!selectedEdgeId) return;

    const stillExists = edges.some((edge) => edge.id === selectedEdgeId);
    if (!stillExists) {
      setSelectedEdgeId(null);
    }
  }, [edges, selectedEdgeId]);

  useEffect(() => {
    if (!reactFlowInstance || isLoading || nodes.length === 0) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      reactFlowInstance.fitView({
        padding: focusedAgentId ? 0.24 : 0.12,
        duration: 350,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [focusedAgentId, isLoading, nodes, reactFlowInstance]);

  const agentOptions = useMemo(
    () =>
      allNodes
        .filter((node) => node.data.kind === "agent")
        .sort((left, right) => {
          if (left.position.y !== right.position.y) {
            return left.position.y - right.position.y;
          }

          return left.data.name.localeCompare(right.data.name, undefined, {
            sensitivity: "base",
            numeric: true,
          });
        })
        .map((node) => ({
          id: node.id,
          name: node.data.name,
          role: node.data.role,
        })),
    [allNodes]
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  const selectedRoute = useMemo(
    () => buildSelectedRoute(nodes, edges, selectedEdge),
    [edges, nodes, selectedEdge]
  );

  const displayNodes = useMemo(() => {
    const emphasizedIds = selectedRoute.highlightedNodeIds;

    return nodes.map((node) => {
      const isEmphasized = emphasizedIds?.has(node.id) ?? false;
      const shouldDim = Boolean(emphasizedIds) && !isEmphasized;

      return {
        ...node,
        zIndex: isEmphasized ? 30 : shouldDim ? 1 : node.zIndex,
        style: {
          ...(node.style ?? {}),
          opacity: shouldDim ? 0.22 : 1,
          filter: isEmphasized
            ? "drop-shadow(0 0 22px rgba(79,73,226,0.26))"
            : shouldDim
              ? "grayscale(0.12)"
              : "none",
        },
      } satisfies Node;
    });
  }, [nodes, selectedRoute.highlightedNodeIds]);

  const displayEdges = useMemo(() => {
    const highlightedEdgeIds =
      selectedEdgeId
        ? selectedRoute.highlightedEdgeIds ?? new Set<string>()
        : focusedAgentId
        ? new Set(edges.map((edge) => edge.id))
        : selectedNode
          ? new Set(
              edges
                .filter(
                  (edge) => edge.source === selectedNode.id || edge.target === selectedNode.id
                )
                .map((edge) => edge.id)
            )
          : new Set<string>();

    return edges.map((edge) => {
      const isHighlighted = highlightedEdgeIds.has(edge.id);
      const baseStyle = edge.style ?? {};
      const baseMarker = edge.markerEnd;
      const baseWidth =
        typeof baseStyle.strokeWidth === "number"
          ? baseStyle.strokeWidth
          : Number(baseStyle.strokeWidth ?? 2);

      return {
        ...edge,
        animated: isHighlighted,
        markerEnd:
          baseMarker && typeof baseMarker === "object"
            ? {
                ...baseMarker,
                width: isHighlighted ? 28 : 24,
                height: isHighlighted ? 28 : 24,
              }
            : baseMarker,
        style: {
          ...baseStyle,
          strokeWidth: isHighlighted ? baseWidth + 1.25 : baseWidth,
          opacity: selectedEdgeId ? (isHighlighted ? 1 : 0.12) : isHighlighted ? 1 : baseStyle.opacity ?? 0.92,
          filter: isHighlighted
            ? "drop-shadow(0 0 10px rgba(79,73,226,0.28))"
            : selectedEdgeId
              ? "drop-shadow(0 0 2px rgba(15,23,42,0.02))"
              : "drop-shadow(0 0 4px rgba(15,23,42,0.08))",
        },
      } satisfies Edge;
    });
  }, [edges, focusedAgentId, selectedEdgeId, selectedNode, selectedRoute.highlightedEdgeIds]);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setLoadError("");

    try {
      await hydrateGraph();
    } catch {
      setLoadError("Unable to load visualizer graph.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section className="-m-10 flex h-[calc(100vh-73px)] min-h-[720px] flex-col bg-[radial-gradient(circle_at_top,#f8faff_0%,#f5f7fc_48%,#f1f4fa_100%)]">
      {isLoading ? (
        <VisualizerSkeleton />
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
        <div className="relative h-full min-h-0 flex-1 overflow-hidden">
          <VisualizerKey />
          {showAgentSwitcher ? (
            <VisualizerAgentSwitcher
              agents={agentOptions}
              focusedAgentId={focusedAgentId}
              isOpen={isSwitcherOpen}
              isRefreshing={isRefreshing}
              onToggleOpen={() => setIsSwitcherOpen((previous) => !previous)}
              onRefresh={handleRefresh}
              onViewAll={() => setFocusedAgentId(null)}
              onSelectAgent={(agentId) => setFocusedAgentId(agentId)}
            />
          ) : null}
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={visualizerNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              setSelectedEdgeId(null);
              if (node.data.kind === "hub") {
                setSelectedNode(null);
                return;
              }

              if (showAgentSwitcher && node.data.kind === "agent") {
                setFocusedAgentId(node.id);
              }

              if (showDetailsPanel) {
                setSelectedNode(node.data);
              } else {
                setSelectedNode(null);
              }
            }}
            onEdgeClick={(_, edge) => {
              setSelectedNode(null);
              setSelectedEdgeId(edge.id);
            }}
            onPaneClick={() => {
              setSelectedNode(null);
              setSelectedEdgeId(null);
            }}
            onInit={setReactFlowInstance}
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

      {showDetailsPanel ? (
        <VisualizerDetailsPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      ) : null}
    </section>
  );
}
