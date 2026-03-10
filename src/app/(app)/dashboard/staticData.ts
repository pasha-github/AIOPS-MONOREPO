export type OverviewStat = {
  title: string;
  value: string;
  tone: "warning" | "success" | "info";
};

export const serviceNowApiDetails = {
  instance: "royalcyberdev.service-now.com",
  endpoint: "/api/now/table/incident",
  authType: "Basic Auth",
  updatedAt: "March 10, 2026 11:42 AM",
  source: "Static demo data",
};

export const overviewStats: OverviewStat[] = [
  { title: "Total Incidents", value: "114", tone: "warning" },
  { title: "Resolved Incidents", value: "39", tone: "success" },
  { title: "Open Incidents", value: "75", tone: "info" },
];

export type AgentCard = {
  id: number;
  name: string;
  enterprise: string;
  status: "Running" | "Stopped";
  port: string;
  websocketChannel: string;
};

export const agentCards: AgentCard[] = [
  {
    id: 1726,
    name: "ServiceNow 1726",
    enterprise: "ServiceNow",
    status: "Running",
    port: "59469",
    websocketChannel: "ws://localhost:59469/ws/agent?agent_id=1726",
  },
  {
    id: 2401,
    name: "MuleSoft 2401",
    enterprise: "Mule",
    status: "Running",
    port: "60321",
    websocketChannel: "ws://localhost:60321/ws/agent?agent_id=2401",
  },
  {
    id: 3002,
    name: "Teams 3002",
    enterprise: "Teams",
    status: "Stopped",
    port: "Agent not started",
    websocketChannel: "Not connected",
  },
];

export type WebSocketLog = {
  id: string;
  level: "INFO" | "WARN" | "SUCCESS";
  time: string;
  message: string;
};

export const websocketLogs: WebSocketLog[] = [
  {
    id: "log-1",
    level: "INFO",
    time: "11:37:11 AM",
    message: "Connected to ws://localhost:60321/ws/agent?agent_id=2401",
  },
  {
    id: "log-2",
    level: "INFO",
    time: "11:37:14 AM",
    message: "Received event: mule.flow.started | flowName=incident-sync",
  },
  {
    id: "log-3",
    level: "WARN",
    time: "11:37:20 AM",
    message: "Retrying ServiceNow push for incident INC0011842 (attempt 2/3)",
  },
  {
    id: "log-4",
    level: "SUCCESS",
    time: "11:37:26 AM",
    message: "Incident INC0011842 synced successfully to ServiceNow",
  },
  {
    id: "log-5",
    level: "INFO",
    time: "11:37:31 AM",
    message: "Heartbeat OK | queueDepth=3 | avgLatency=120ms",
  },
];

export type IncidentRecord = {
  number: string;
  shortDescription: string;
  state: string;
  openedAt: string;
  priority: string;
  status: "Open" | "Closed";
};

export const incidentRecords: IncidentRecord[] = [
  {
    number: "INC0011842",
    shortDescription: "Payment gateway timeout for checkout API",
    state: "In Progress",
    openedAt: "2026-03-10 10:52",
    priority: "P1",
    status: "Open",
  },
  {
    number: "INC0011837",
    shortDescription: "Warehouse integration failed in Mule flow",
    state: "New",
    openedAt: "2026-03-10 10:21",
    priority: "P2",
    status: "Open",
  },
  {
    number: "INC0011828",
    shortDescription: "ServiceNow webhook authentication mismatch",
    state: "Resolved",
    openedAt: "2026-03-10 09:44",
    priority: "P2",
    status: "Closed",
  },
  {
    number: "INC0011819",
    shortDescription: "Delayed agent heartbeat from MuleSoft runtime",
    state: "Resolved",
    openedAt: "2026-03-10 08:58",
    priority: "P3",
    status: "Closed",
  },
  {
    number: "INC0011806",
    shortDescription: "Catalog item update failed for enterprise app",
    state: "In Progress",
    openedAt: "2026-03-10 08:12",
    priority: "P3",
    status: "Open",
  },
];
