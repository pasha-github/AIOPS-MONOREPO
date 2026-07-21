import {
  MarkerType,
  Position,
  type Edge,
} from "@xyflow/react";
import type {
  VisualizerAgent,
  VisualizerConnector,
  VisualizerJob,
  VisualizerMcp,
  VisualizerNode,
  VisualizerResponse,
  VisualizerSkill,
  VisualizerWebhook,
} from "./data";
import type { GraphFlowNode, GraphNodeData } from "./shared";
import { LANE_Y, NODE_WIDTH, VISUALIZER_EDGE_COLORS } from "./shared";

const SIBLING_GAP = 72;
const ROOT_GAP = 120;
const START_X = 80;

export function createVisualizerGraph(response: VisualizerResponse) {
  const normalizedResponse = normalizeVisualizerResponse(response);
  const nodeMap = new Map(normalizedResponse.nodes.map((node) => [node.id, node]));
  const outgoing = buildOutgoingEdges(normalizedResponse);
  const positionMap = createPositionMap(normalizedResponse, nodeMap, outgoing);

  const baseNodes: GraphFlowNode[] = normalizedResponse.nodes.map((node, index) => ({
    id: node.id,
    type: "visualizer",
    position: sanitizePosition(positionMap.get(node.id), fallbackPosition(index)),
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: buildNodeData(node),
  }));

  const { hubNodes, hubEdges, reroutedEdgeIds } = createResourceHubGraph(
    normalizedResponse,
    nodeMap,
    positionMap
  );

  const edges: Edge[] = normalizedResponse.edges
    .filter((edge) => !reroutedEdgeIds.has(edge.id))
    .map((edge) => {
      const targetType = nodeMap.get(edge.target)?.type;
      const sourceType = nodeMap.get(edge.source)?.type;
      const relation = getEdgeRelation(sourceType, targetType);
      const appearance = getEdgeAppearance(relation, targetType);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "simplebezier",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: appearance.color,
          width: 24,
          height: 24,
        },
        data: { relation },
        style: {
          stroke: appearance.color,
          strokeWidth: appearance.strokeWidth,
          strokeDasharray: appearance.strokeDasharray,
          opacity: appearance.opacity,
        },
      };
    });

  return {
    nodes: dedupeById([...baseNodes, ...hubNodes]),
    edges: dedupeById([...edges, ...hubEdges]),
  };
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seenIds = new Set<string>();
  return items.filter((item) => {
    if (seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
}

function createResourceHubGraph(
  response: VisualizerResponse,
  nodeMap: Map<string, VisualizerNode>,
  positionMap: Map<string, { x: number; y: number }>
) {
  const agentResourceTargets = new Map<string, string[]>();
  const reroutedEdgeIds = new Set<string>();

  response.edges.forEach((edge) => {
    const targetType = nodeMap.get(edge.target)?.type;
    const sourceType = nodeMap.get(edge.source)?.type;
    if (
      sourceType === "agent" &&
      (targetType === "connector" || targetType === "mcp")
    ) {
      const targets = agentResourceTargets.get(edge.source) ?? [];
      if (!targets.includes(edge.target)) {
        targets.push(edge.target);
      }
      agentResourceTargets.set(edge.source, targets);
      reroutedEdgeIds.add(edge.id);
    }
  });

  const hubNodes: GraphFlowNode[] = [];
  const hubEdges: Edge[] = [];

  agentResourceTargets.forEach((targets, agentId) => {
    const sourceNode = nodeMap.get(agentId);
    const sourcePosition = positionMap.get(agentId);
    if (!sourceNode || !sourcePosition) return;

    const resourceCenters = targets
      .map((targetId) => getNodeCenter(targetId, positionMap, nodeMap))
      .filter((value): value is number => typeof value === "number");

    const targetY = targets
      .map((targetId) => positionMap.get(targetId)?.y)
      .filter((value): value is number => typeof value === "number");

    if (resourceCenters.length === 0 || targetY.length === 0) return;

    const agentCenter = getNodeCenter(agentId, positionMap, nodeMap);
    if (typeof agentCenter !== "number") return;

    const averageResourceCenter =
      resourceCenters.reduce((sum, value) => sum + value, 0) / resourceCenters.length;
    const minTargetY = Math.min(...targetY);
    const sourceBottomY = sourcePosition.y + 132;
    const hubY = sourceBottomY + Math.max(96, (minTargetY - sourceBottomY) * 0.38);
    const hubX = ((agentCenter + averageResourceCenter) / 2) - NODE_WIDTH.hub / 2;
    const hubId = `resource-hub-${agentId}`;

    hubNodes.push({
      id: hubId,
      type: "visualizerHub",
      position: { x: hubX, y: hubY },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: false,
      selectable: false,
      focusable: false,
      data: {
        id: hubId,
        kind: "hub",
        name: "",
        role: "",
        description: "",
        llm: "",
        hoverTitle: "",
        hoverText: "",
        detailItems: [],
        longText: "",
      },
    });

    hubEdges.push({
      id: `hub-link-${agentId}`,
      source: agentId,
      target: hubId,
      type: "simplebezier",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: VISUALIZER_EDGE_COLORS.hub,
        width: 22,
        height: 22,
      },
      data: { relation: "agent-resource-hub" },
      style: {
        stroke: VISUALIZER_EDGE_COLORS.hub,
        strokeWidth: 3,
        opacity: 0.95,
      },
    });

    targets.forEach((targetId) => {
      const targetType = nodeMap.get(targetId)?.type;
      hubEdges.push({
        id: `hub-resource-${agentId}-${targetId}`,
        source: hubId,
        target: targetId,
        type: "simplebezier",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: getEdgeColor(targetType),
          width: 22,
          height: 22,
        },
        data: { relation: "hub-resource" },
        style: {
          stroke: getEdgeColor(targetType),
          strokeWidth: 2.5,
          strokeDasharray: "6 4",
          opacity: 0.9,
        },
      });
    });
  });

  return { hubNodes, hubEdges, reroutedEdgeIds };
}

function normalizeVisualizerResponse(response: VisualizerResponse): VisualizerResponse {
  const nodes = [...response.nodes];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = [...response.edges];
  const edgeIds = new Set(edges.map((edge) => edge.id));

  const addEdge = (source: string, target: string, prefix: string) => {
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;

    const edgeId = `${prefix}-${source}-${target}`;
    const alreadyExists = edges.some(
      (edge) => edge.source === source && edge.target === target
    );

    if (alreadyExists || edgeIds.has(edgeId)) return;

    edgeIds.add(edgeId);
    edges.push({ id: edgeId, source, target });
  };

  nodes.forEach((node) => {
    if (node.type === "agent") {
      (node.data.agent.skill_ids ?? []).forEach((skillId) => {
        addEdge(node.id, skillId, "derived-agent-skill");
      });
      return;
    }

    if (node.type === "skill") {
      node.data.skill.connector_config_ids.forEach((connectorId) => {
        addEdge(node.id, connectorId, "derived-skill-connector");
      });
      node.data.skill.mcp_server_ids.forEach((mcpId) => {
        addEdge(node.id, mcpId, "derived-skill-mcp");
      });
    }
  });

  const connectedIds = new Set<string>();
  edges.forEach((edge) => {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  });

  return {
    nodes: nodes.filter((node) => connectedIds.has(node.id)),
    edges: edges.filter(
      (edge) => connectedIds.has(edge.source) && connectedIds.has(edge.target)
    ),
  };
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
  const skillParents = new Map<string, string[]>();
  const resourceParents = new Map<string, string[]>();

  for (const edge of response.edges) {
    const sourceType = nodeMap.get(edge.source)?.type;
    const targetType = nodeMap.get(edge.target)?.type;

    if (sourceType === "agent" && targetType === "agent") {
      const parents = parentAgents.get(edge.target) ?? [];
      parents.push(edge.source);
      parentAgents.set(edge.target, parents);
    }

    if (sourceType === "agent" && targetType === "skill") {
      const parents = skillParents.get(edge.target) ?? [];
      parents.push(edge.source);
      skillParents.set(edge.target, parents);
    }

    if (
      (sourceType === "agent" || sourceType === "skill") &&
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

  const supervisorIds = agentIds
    .filter((id) => isSupervisorAgent(nodeMap.get(id)))
    .sort((left, right) => compareNodes(left, right, nodeMap));

  const childAgentIds = agentIds
    .filter((id) => !supervisorIds.includes(id))
    .sort((leftId, rightId) => {
      const leftParents = parentAgents.get(leftId) ?? [];
      const rightParents = parentAgents.get(rightId) ?? [];
      const leftAnchor = getIndexAnchor(leftParents, supervisorIds);
      const rightAnchor = getIndexAnchor(rightParents, supervisorIds);

      if (leftAnchor !== rightAnchor) return leftAnchor - rightAnchor;
      return compareNodes(leftId, rightId, nodeMap);
    });

  placeNodesInRow(
    childAgentIds,
    (nodeId) => getPositionAnchor(parentAgents.get(nodeId) ?? [], positionMap, nodeMap),
    LANE_Y.agent,
    positionMap,
    nodeMap
  );

  const supervisorAnchors = new Map<string, number>();
  supervisorIds.forEach((supervisorId, index) => {
    const childCenters = ((outgoing.get(supervisorId) ?? [])
      .filter((targetId) => nodeMap.get(targetId)?.type === "agent")
      .map((targetId) => getNodeCenter(targetId, positionMap, nodeMap))
      .filter((value): value is number => typeof value === "number"));

    supervisorAnchors.set(
      supervisorId,
      childCenters.length > 0
        ? childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length
        : START_X + index * (NODE_WIDTH.agent + ROOT_GAP) + NODE_WIDTH.agent / 2
    );
  });

  placeNodesInRow(
    supervisorIds,
    (nodeId) => supervisorAnchors.get(nodeId) ?? null,
    LANE_Y.supervisor,
    positionMap,
    nodeMap
  );

  const skillIds = response.nodes
    .filter((node) => node.type === "skill")
    .map((node) => node.id)
    .sort((leftId, rightId) => {
      const leftParents = skillParents.get(leftId) ?? [];
      const rightParents = skillParents.get(rightId) ?? [];
      const leftAnchor = getPositionAnchor(leftParents, positionMap, nodeMap);
      const rightAnchor = getPositionAnchor(rightParents, positionMap, nodeMap);

      if (typeof leftAnchor === "number" && typeof rightAnchor === "number") {
        if (leftAnchor !== rightAnchor) return leftAnchor - rightAnchor;
      } else if (leftAnchor !== rightAnchor) {
        if (leftAnchor === null) return 1;
        if (rightAnchor === null) return -1;
      }

      return compareNodes(leftId, rightId, nodeMap);
    });

  placeNodesInRow(
    skillIds,
    (nodeId) => getPositionAnchor(skillParents.get(nodeId) ?? [], positionMap, nodeMap),
    LANE_Y.skill,
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

      if (typeof leftAnchor === "number" && typeof rightAnchor === "number") {
        if (leftAnchor !== rightAnchor) return leftAnchor - rightAnchor;
      } else if (leftAnchor !== rightAnchor) {
        if (leftAnchor === null) return 1;
        if (rightAnchor === null) return -1;
      }

      return compareNodes(leftId, rightId, nodeMap);
    });

  placeNodesInRow(
    resourceIds,
    (nodeId) => getPositionAnchor(resourceParents.get(nodeId) ?? [], positionMap, nodeMap),
    skillIds.length > 0 ? LANE_Y.resource : LANE_Y.skill,
    positionMap,
    nodeMap
  );

  response.nodes.forEach((node, index) => {
    if (!positionMap.has(node.id)) {
      positionMap.set(node.id, sanitizePosition(null, fallbackPosition(index)));
    }
  });

  return positionMap;
}

function fallbackPosition(index: number) {
  return { x: 80 + index * 280, y: 940 };
}

function sanitizePosition(
  position: { x: number; y: number } | undefined | null,
  fallback: { x: number; y: number }
) {
  const x = position && Number.isFinite(position.x) ? position.x : fallback.x;
  const y = position && Number.isFinite(position.y) ? position.y : fallback.y;
  return { x, y };
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
    const hasFiniteAnchor = typeof anchor === "number" && Number.isFinite(anchor);
    const desiredLeft = hasFiniteAnchor ? anchor - width / 2 : currentLeft;
    const x = Number.isFinite(desiredLeft)
      ? Math.max(currentLeft, desiredLeft)
      : currentLeft;

    positionMap.set(nodeId, { x, y });
    currentLeft = x + width + SIBLING_GAP;
  });

  if (nodeIds.length === 0) return;

  const leftMost = Math.min(
    ...nodeIds.map((nodeId) => {
      const x = positionMap.get(nodeId)?.x;
      return typeof x === "number" && Number.isFinite(x) ? x : START_X;
    })
  );
  const shift = leftMost - START_X;

  if (Number.isFinite(shift) && shift > 0) {
    nodeIds.forEach((nodeId) => {
      const current = positionMap.get(nodeId);
      if (!current) return;
      const nextX = current.x - shift;
      positionMap.set(nodeId, {
        x: Number.isFinite(nextX) ? nextX : START_X,
        y: current.y,
      });
    });
  }
}

function getIndexAnchor(ids: string[], orderedIds: string[]) {
  if (ids.length === 0) return Number.POSITIVE_INFINITY;

  const anchors = ids.map((id) => orderedIds.indexOf(id)).filter((index) => index >= 0);
  if (anchors.length === 0) return Number.POSITIVE_INFINITY;
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

  if (centers.length === 0) return null;
  return centers.reduce((sum, value) => sum + value, 0) / centers.length;
}

function getNodeCenter(
  nodeId: string,
  positionMap: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, VisualizerNode>
) {
  const position = positionMap.get(nodeId);
  if (!position || !Number.isFinite(position.x)) return null;
  return position.x + getNodeWidth(nodeId, nodeMap) / 2;
}

function getNodeWidth(nodeId: string, nodeMap: Map<string, VisualizerNode>) {
  const nodeType = nodeMap.get(nodeId)?.type;
  if (nodeType === "agent" || nodeType === "skill" || nodeType === "connector" || nodeType === "mcp") {
    return NODE_WIDTH[nodeType];
  }
  return NODE_WIDTH.agent;
}

function isSupervisorAgent(node?: VisualizerNode) {
  if (!node || node.type !== "agent") return false;
  const name = node.data.agent.name.trim().toLowerCase();
  const agentId = node.data.agent.agent_id.trim().toLowerCase();
  return agentId === "supervisor" || name === "supervisor agent" || node.data.agent.sub_agents.length > 0;
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
  if (type === "agent") return 0;
  if (type === "skill") return 1;
  if (type === "connector") return 2;
  if (type === "mcp") return 3;
  return 4;
}

function getDisplayName(node?: VisualizerNode) {
  if (!node) return "";
  if (node.type === "agent") return node.data.agent.name || node.id;
  if (node.type === "connector") return node.data.connector.name || node.id;
  if (node.type === "mcp") return node.data.mcp.name || node.id;
  if (node.type === "skill") return node.data.skill.name || node.id;
  return "";
}

function buildNodeData(node: VisualizerNode): GraphNodeData {
  switch (node.type) {
    case "agent":
      return buildAgentNodeData(node.data.agent);
    case "skill":
      return buildSkillNodeData(node.id, node.data.skill);
    case "connector":
      return buildConnectorNodeData(node.data.connector);
    case "mcp":
      return buildMcpNodeData(node.id, node.data.mcp);
    default:
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
      { title: "Sub-agents", items: agent.sub_agents },
      { title: "Connector ids", items: agent.connector_config_ids },
      { title: "MCP servers", items: agent.mcp_servers },
      { title: "Skills", items: agent.skill_ids ?? [] },
    ].filter((section) => section.items.length > 0),
  };
}

function buildSkillNodeData(skillId: string, skill: VisualizerSkill): GraphNodeData {
  return {
    id: skillId,
    kind: "skill",
    name: skill.name,
    role: "Skill",
    description: skill.description,
    llm: "N/A",
    hoverTitle: skill.name,
    hoverText: truncate(skill.instructions, 160),
    detailItems: [
      { label: "Skill id", value: skill.skill_id },
      { label: "Tools", value: `${skill.tools.length}` },
      { label: "References", value: `${Object.keys(skill.references).length}` },
      { label: "Created at", value: formatDateTime(skill.created_at) },
      { label: "Updated at", value: formatDateTime(skill.updated_at) },
    ],
    longText: skill.instructions,
    sections: [
      { title: "Tools", items: skill.tools },
      { title: "Connector ids", items: skill.connector_config_ids },
      { title: "MCP servers", items: skill.mcp_server_ids },
      {
        title: "References",
        items: Object.entries(skill.references).map(
          ([referenceName, referenceText]) => `${referenceName}: ${referenceText}`
        ),
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
    description: connector.description ?? `${connector.config.length} config keys configured`,
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
    sections: [{ title: "Config entries", items: connector.config.map((item) => item.name) }],
  };
}

function buildMcpNodeData(nodeId: string, mcp: VisualizerMcp): GraphNodeData {
  const parsedUrl = tryParseUrl(mcp.url);
  const toolCount = mcp.tools?.length ?? mcp.metadata?.tool_count ?? 0;
  const resourceCount = mcp.resources?.length ?? mcp.metadata?.resource_count ?? 0;

  return {
    id: nodeId,
    kind: "mcp",
    name: mcp.name,
    role: "MCP Server",
    description: mcp.url,
    llm: "N/A",
    hoverTitle: mcp.name,
    hoverText: mcp.url,
    detailItems: [
      { label: "MCP id", value: mcp.mcp_server_id ?? nodeId },
      { label: "Name", value: mcp.name },
      { label: "URL", value: mcp.url },
      { label: "Auth type", value: mcp.auth_type ?? "-" },
      { label: "Host", value: parsedUrl?.hostname ?? "-" },
      { label: "Protocol", value: parsedUrl?.protocol.replace(":", "") ?? "-" },
      { label: "Tools", value: `${toolCount}` },
      { label: "Resources", value: `${resourceCount}` },
    ],
    longText: "Model Context Protocol server linked to an agent in the visualizer response.",
    sections: [
      { title: "Endpoint", items: [mcp.url] },
      { title: "Tools", items: (mcp.tools ?? []).map((tool) => tool.name) },
    ],
  };
}

function tryParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
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
      value: typeof job.interval_seconds === "number" ? String(job.interval_seconds) : "-",
    },
    { label: "Cron expression", value: job.cron_expression || "-" },
    { label: "Created at", value: formatDateTime(job.created_at) },
    { label: "Updated at", value: formatDateTime(job.updated_at) },
  ];
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEdgeColor(nodeType?: VisualizerNode["type"]) {
  if (nodeType === "skill") return VISUALIZER_EDGE_COLORS.agentToSkill;
  if (nodeType === "connector") return VISUALIZER_EDGE_COLORS.connector;
  if (nodeType === "mcp") return VISUALIZER_EDGE_COLORS.mcp;
  return VISUALIZER_EDGE_COLORS.default;
}

function getEdgeRelation(
  sourceType?: VisualizerNode["type"],
  targetType?: VisualizerNode["type"]
) {
  if (sourceType === "agent" && targetType === "agent") return "agent-agent";
  if (sourceType === "agent" && targetType === "skill") return "agent-skill";
  if (sourceType === "skill" && targetType === "connector") return "skill-connector";
  if (sourceType === "skill" && targetType === "mcp") return "skill-mcp";
  if (sourceType === "agent" && (targetType === "connector" || targetType === "mcp")) {
    return "agent-resource";
  }
  return "default";
}

function getEdgeAppearance(
  relation: string,
  targetType?: VisualizerNode["type"]
) {
  if (relation === "agent-agent") {
    return {
      color: VISUALIZER_EDGE_COLORS.agentToAgent,
      strokeWidth: 4,
      strokeDasharray: undefined,
      opacity: 0.98,
    };
  }

  if (relation === "agent-skill") {
    return {
      color: VISUALIZER_EDGE_COLORS.agentToSkill,
      strokeWidth: 3.5,
      strokeDasharray: undefined,
      opacity: 0.95,
    };
  }

  if (relation === "skill-connector" || relation === "skill-mcp" || relation === "agent-resource") {
    return {
      color: getEdgeColor(targetType),
      strokeWidth: 2.5,
      strokeDasharray: "6 4",
      opacity: 0.9,
    };
  }

  return {
    color: getEdgeColor(targetType),
    strokeWidth: 3,
    strokeDasharray: undefined,
    opacity: 0.92,
  };
}
