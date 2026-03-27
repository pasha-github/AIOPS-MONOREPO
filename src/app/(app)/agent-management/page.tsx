"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import AgentRegistry from "./AgentRegistry";
import AgentStats from "./AgentStats";
import CreateNewAgent from "./createnewagent";
import type { AgentRecord } from "./types";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";

const isOnlineStatus = (statusValue: string | null | undefined) => {
  const normalized = statusValue?.trim().toLowerCase() ?? "";
  return (
    normalized === "started" ||
    normalized === "active" ||
    normalized === "online"
  );
};

const getStringOrNull = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getLoadErrorMessage = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return String((payload as { message: string }).message);
  }
  return fallback;
};

export default function AgentManagementPage() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const agentManagerApiBase = trimTrailingSlash(llmManagerApiBaseUrl);
  const agentListUrl = `${agentManagerApiBase}/agent/`;
  const llmListUrl = `${agentManagerApiBase}/llms/`;
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const agentsRef = useRef<AgentRecord[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const loadAgents = useCallback(
    async (options?: { signal?: AbortSignal; refresh?: boolean }) => {
      const requestId = ++requestIdRef.current;
      const hasData = agentsRef.current.length > 0;
      const shouldRefresh = Boolean(options?.refresh && hasData);

      if (shouldRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
        setLoadError("");
      }

      try {
        const [agentResponse, llmResponse] = await Promise.all([
          fetch(agentListUrl, {
            headers: { accept: "application/json" },
            signal: options?.signal,
          }),
          fetch(llmListUrl, {
            headers: { accept: "application/json" },
            signal: options?.signal,
          }),
        ]);
        const [agentPayload, llmPayload] = await Promise.all([
          agentResponse.json(),
          llmResponse.json(),
        ]);

        // console.log("Agent list response:", {
        //   ok: agentResponse.ok,
        //   status: agentResponse.status,
        //   data: agentPayload,
        // });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!agentResponse.ok || !Array.isArray(agentPayload)) {
          if (!shouldRefresh) {
            setLoadError(getLoadErrorMessage(agentPayload, "Unable to load agents."));
          }
          return;
        }

        const llmByModelId = new Map<
          string,
          { provider: string | null; name: string | null }
        >();

        if (llmResponse.ok && Array.isArray(llmPayload)) {
          llmPayload.forEach((item) => {
            const record =
              item && typeof item === "object" && !Array.isArray(item)
                ? (item as Record<string, unknown>)
                : null;
            if (!record) {
              return;
            }
            const modelId = getStringOrNull(record.model_id);
            if (!modelId) {
              return;
            }
            llmByModelId.set(modelId.toLowerCase(), {
              provider: getStringOrNull(record.provider),
              name: getStringOrNull(record.name),
            });
          });
        }

        const normalizedAgents = agentPayload.map((item, index) => {
          const record =
            item && typeof item === "object" && !Array.isArray(item)
              ? (item as Record<string, unknown>)
              : {};

          const statusFromApi = getStringOrNull(record.status);
          const isEnabledFromApi =
            typeof record.isEnabled === "boolean" ? record.isEnabled : null;
          const status =
            isEnabledFromApi === true
              ? "active"
              : isEnabledFromApi === false
                ? "inactive"
                : statusFromApi ?? "offline";
          const modelId = getStringOrNull(record.model_id);
          const llmRecord = modelId
            ? llmByModelId.get(modelId.toLowerCase())
            : undefined;
          const type = getStringOrNull(record.type) ?? "agent";

          return {
            agentId:
              typeof record.agentId === "number" ? record.agentId : index + 1,
            name: getStringOrNull(record.name) ?? "Untitled Agent",
            port: typeof record.port === "number" ? record.port : null,
            status,
            type,
            enterprise: type,
            start_time: getStringOrNull(record.start_time),
            stop_time: getStringOrNull(record.stop_time),
            agent_id: getStringOrNull(record.agent_id),
            description: getStringOrNull(record.description),
            instruction: getStringOrNull(record.instruction),
            model_id: modelId,
            modelName: llmRecord?.name ?? modelId,
            modelProvider: llmRecord?.provider ?? null,
            created_at: getStringOrNull(record.created_at),
            updated_at: getStringOrNull(record.updated_at),
            tools: Array.isArray(record.tools)
              ? getStringArray(record.tools)
              : getStringOrNull(record.tools) ?? "",
            mcp_servers: getStringArray(record.mcp_servers),
            connector_config_ids: getStringArray(record.connector_config_ids),
            sub_agents: getStringArray(record.sub_agents),
            isEnabled: isEnabledFromApi,
          } satisfies AgentRecord;
        });

        setAgents(normalizedAgents);
        if (!llmResponse.ok) {
          console.warn("LLM list request failed. Model metadata may be incomplete.");
        }

        if (!shouldRefresh) {
          setLoadError("");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!shouldRefresh) {
          setLoadError("Unable to load agents.");
        }
      } finally {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (shouldRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [agentListUrl, llmListUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAgents({ signal: controller.signal });
    return () => controller.abort();
  }, [loadAgents]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadAgents({ refresh: true });
      }
    };

    const handleFocus = () => loadAgents({ refresh: true });
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadAgents]);

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }
    await loadAgents({ refresh: true });
  };

  const { onlineCount, offlineCount, totalCount } = useMemo(() => {
    const total = agents.length;
    const online = agents.filter((agent) =>
      isOnlineStatus(agent.status)
    ).length;
    const offline = total - online;
    return { onlineCount: online, offlineCount: offline, totalCount: total };
  }, [agents]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-md space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-[#111827]">
                Agent management
              </h2>
              <p className="mt-2 text-sm text-[#5b6476]">
                Lifecycle, versioning, and health of deployed agents.
              </p>
            </div>
            <CreateNewAgent onCreateSuccess={() => loadAgents({ refresh: true })} />
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_10px_20px_-16px_rgba(79,73,226,0.5)] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh Agents
              </button>
            </div>
            <AgentStats
              onlineCount={onlineCount}
              offlineCount={offlineCount}
              totalCount={totalCount}
              isLoading={isLoading || isRefreshing}
            />
          </div>
        </div>
      </section>

      <AgentRegistry
        agents={agents}
        isLoading={isLoading}
        loadError={loadError}
        onDeleteSuccess={() => loadAgents({ refresh: true })}
        onStatusUpdateSuccess={() => loadAgents({ refresh: true })}
      />
    </div>
  );
}
