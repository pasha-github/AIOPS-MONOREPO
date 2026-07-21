import { trimTrailingSlash } from "@/config/agent";

import type { AgentListApiResponseItem, AgentRecord } from "./types";

export const mapApiStatusToDashboardStatus = (
  status: string | null | undefined,
  isEnabled: boolean | null | undefined
) => {
  if (isEnabled === true) {
    return "STARTED";
  }
  if (isEnabled === false) {
    return "STOPPED";
  }
  return String(status ?? "").toLowerCase() === "active" ? "STARTED" : "STOPPED";
};

export const inferEnterprise = (
  name: string,
  type: string | null | undefined
) => {
  const lowered = name.toLowerCase();
  if (lowered.includes("servicenow")) {
    return "servicenow";
  }
  if (lowered.includes("mule")) {
    return "mule";
  }
  return (type ?? "agent").toLowerCase();
};

export const formatUpdatedAt = (updatedAt: string | null) => {
  if (!updatedAt) {
    return "--";
  }
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return updatedAt;
  }
  return parsed.toLocaleString();
};

export const resolveLlmManagerBaseUrl = (value: string) => {
  const trimmed = trimTrailingSlash(value.trim());
  if (!trimmed) {
    throw new Error("NEXT_PUBLIC_LLM_MANAGER_API_BASE_URL is not configured.");
  }

  return trimmed;
};

export const mapAgentListResponse = (
  data: AgentListApiResponseItem[]
): AgentRecord[] =>
  data
    .filter((item) => String(item.type ?? "").trim().toLowerCase() !== "automation")
    .map((item, index) => {
      const name = String(item.name ?? "").trim() || `Agent ${index + 1}`;
      const id = String(item.agent_id ?? "").trim() || `agent_${index + 1}`;

      return {
        agentId: id,
        name,
        port: null,
        status: mapApiStatusToDashboardStatus(item.status, item.isEnabled),
        enterprise: inferEnterprise(name, item.type),
        start_time: null,
        stop_time: null,
        updated_at: item.updated_at ?? null,
        deployment_target: item.deployment_target ?? null,
        vertex_stream_query_url: item.vertex_stream_query_url ?? null,
      };
    });
