"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import AgentChatWorkspace from "./AgentChatWorkspace";
import {
  Bot,
  Eye,
  Filter,
  MessageCircle,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AgentRecord = {
  agentId: string;
  name: string;
  port: number | null;
  status: string;
  enterprise: string;
  start_time: string | null;
  stop_time: string | null;
  updated_at: string | null;
};

type AgentListApiResponseItem = {
  name?: string | null;
  agent_id?: string | null;
  updated_at?: string | null;
  status?: string | null;
  type?: string | null;
};

const mapApiStatusToDashboardStatus = (status: string | null | undefined) =>
  String(status ?? "").toLowerCase() === "active" ? "STARTED" : "STOPPED";

const inferEnterprise = (name: string, type: string | null | undefined) => {
  const lowered = name.toLowerCase();
  if (lowered.includes("servicenow")) {
    return "servicenow";
  }
  if (lowered.includes("mule")) {
    return "mule";
  }
  return (type ?? "agent").toLowerCase();
};

const formatUpdatedAt = (updatedAt: string | null) => {
  if (!updatedAt) {
    return "--";
  }
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return updatedAt;
  }
  return parsed.toLocaleString();
};

export default function AgentManagementSection() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const agentListUrl = `${trimTrailingSlash(llmManagerApiBaseUrl)}/agent/`;
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isAgentsLoading, setIsAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [agentFilter, setAgentFilter] = useState<
    "all" | "running" | "stopped"
  >("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSeeAllOpen, setIsSeeAllOpen] = useState(false);
  const [activeChatAgent, setActiveChatAgent] = useState<AgentRecord | null>(
    null
  );
  const agentsRef = useRef<AgentRecord[]>([]);
  const requestIdRef = useRef(0);
  const firstAgentCardRef = useRef<HTMLDivElement | null>(null);
  const [agentListMaxHeight, setAgentListMaxHeight] = useState<number | null>(null);

  const totalAgents = agents.length;

  const filteredAgents = useMemo(() => {
    if (agentFilter === "all") {
      return agents;
    }
    const isRunning = agentFilter === "running";
    return agents.filter((agent) =>
      isRunning
        ? agent.status?.toUpperCase() === "STARTED"
        : agent.status?.toUpperCase() !== "STARTED"
    );
  }, [agents, agentFilter]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    const updateListHeight = () => {
      const cardHeight = firstAgentCardRef.current?.getBoundingClientRect().height;
      if (!cardHeight) {
        setAgentListMaxHeight(null);
        return;
      }
      const gapPx = 16; // matches space-y-4
      setAgentListMaxHeight(cardHeight * 3 + gapPx * 2);
    };

    updateListHeight();
    window.addEventListener("resize", updateListHeight);
    return () => window.removeEventListener("resize", updateListHeight);
  }, [filteredAgents.length, isAgentsLoading, agentsError]);

  const loadAgents = useCallback(
    async (options?: { signal?: AbortSignal; refresh?: boolean }) => {
      const requestId = ++requestIdRef.current;
      const hasData = agentsRef.current.length > 0;
      const shouldRefresh = Boolean(options?.refresh && hasData);

      if (!shouldRefresh) {
        setIsAgentsLoading(true);
        setAgentsError("");
      }

      try {
        const response = await fetch(agentListUrl, {
          headers: { accept: "application/json" },
          signal: options?.signal,
        });
        const data = await response.json();
        // console.log("Dashboard agent list response:", {
        //   ok: response.ok,
        //   status: response.status,
        //   data,
        // });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (response.ok && Array.isArray(data)) {
          const mappedAgents: AgentRecord[] = (data as AgentListApiResponseItem[])
            .filter(
              (item) => String(item.type ?? "").trim().toLowerCase() !== "automation"
            )
            .map((item, index) => {
              const name = String(item.name ?? "").trim() || `Agent ${index + 1}`;
              const id = String(item.agent_id ?? "").trim() || `agent_${index + 1}`;
              return {
                agentId: id,
                name,
                port: null,
                status: mapApiStatusToDashboardStatus(item.status),
                enterprise: inferEnterprise(name, item.type),
                start_time: null,
                stop_time: null,
                updated_at: item.updated_at ?? null,
              };
            });
          setAgents(mappedAgents);
          setAgentsError("");
        } else if (!shouldRefresh) {
          setAgentsError(data?.message || "Unable to load agents.");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!shouldRefresh) {
          setAgentsError("Unable to load agents.");
        }
      } finally {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (!shouldRefresh) {
          setIsAgentsLoading(false);
        }
      }
    },
    [agentListUrl]
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

  const closeSeeAll = () => {
    setIsSeeAllOpen(false);
    setIsFilterOpen(false);
  };

  const openChat = (agent: AgentRecord) => {
    setActiveChatAgent(agent);
  };

  const closeChat = () => {
    setActiveChatAgent(null);
  };

  return (
    <div className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
              <Bot className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-semibold text-[#111827]">
              Agent Management
            </h3>
            <span className="rounded-md border border-[#cbd2ff] px-2 py-0.5 text-xs font-semibold text-[#5b4cf0]">
              {totalAgents}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#5b6476]">
            Start/stop live actions and inspect recent activity.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-[#e3e7f2] px-3 py-2 text-sm font-medium text-[#111827] shadow-[0_6px_14px_-12px_rgba(16,24,40,0.3)]"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
          {isFilterOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.3)]">
              {[
                { label: "All", value: "all" },
                { label: "Running", value: "running" },
                { label: "Stopped", value: "stopped" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setAgentFilter(option.value as "all" | "running" | "stopped");
                    setIsFilterOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    agentFilter === option.value
                      ? "bg-[#eef2ff] text-[#4f49e2]"
                      : "text-[#111827] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {agentFilter !== "all" ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#e0e5f0] bg-white px-3 py-1 text-xs font-semibold text-[#4f49e2]">
          {agentFilter === "running" ? "Running" : "Stopped"}
          <button
            type="button"
            onClick={() => setAgentFilter("all")}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <div
        className="mt-6 flex-1 space-y-4 overflow-y-auto pr-2 no-scrollbar"
        style={agentListMaxHeight ? { maxHeight: `${agentListMaxHeight}px` } : undefined}
      >
        {isAgentsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`agent-skeleton-${index}`}
                className="animate-pulse rounded-2xl border border-[#eef1f7] bg-white px-5 py-4 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-[#edf2f9]" />
                    <div className="space-y-2">
                      <span className="block h-4 w-32 rounded bg-[#edf2f9]" />
                      <span className="block h-3 w-44 rounded bg-[#edf2f9]" />
                    </div>
                  </div>
                  <span className="h-5 w-24 rounded bg-[#edf2f9]" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <span className="h-10 rounded-xl bg-[#edf2f9]" />
                  <span className="h-10 rounded-xl bg-[#edf2f9]" />
                </div>
              </div>
            ))}
          </div>
        ) : agentsError ? (
          <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-6 text-sm text-[#b91c1c] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
            {agentsError}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-6 text-sm text-[#647087] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
            No agents yet.
          </div>
        ) : (
          filteredAgents.map((agent, index) => {
            const isRunning = agent.status?.toUpperCase() === "STARTED";
            const isMule =
              (agent.enterprise ?? "").trim().toLowerCase() === "mule";
            const updatedAt = formatUpdatedAt(agent.updated_at);
            return (
              <div
                key={agent.agentId}
                ref={index === 0 ? firstAgentCardRef : undefined}
                className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-4 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">
                        {agent.name}
                      </p>
                      <p className="text-xs text-[#647087]">
                        Updated at: {updatedAt}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#647087]">
                    <span>{isRunning ? "Running" : "Stopped"}</span>
                    <button
                      type="button"
                      disabled
                      aria-label={`${isRunning ? "Running" : "Stopped"} status`}
                      className={`relative inline-flex h-5 w-10 cursor-default items-center rounded-full ${
                        isRunning ? "bg-[#5b4cf0]" : "bg-[#e3e6ee]"
                      }`}
                    >
                      <span
                        className={`absolute h-4 w-4 rounded-full bg-white shadow transition ${
                          isRunning ? "left-5" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => openChat(agent)}
                    disabled={!isRunning}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                      isRunning
                        ? "bg-[#cfefff] text-[#0b7ed9]"
                        : "cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]"
                    }`}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chat with agent
                  </button>
                  <button
                    type="button"
                    disabled={!isMule}
                    className={`flex items-center justify-center gap-2 rounded-xl border border-[#e1e5ef] px-4 py-2 text-sm font-medium text-[#3a4355] ${
                      isMule
                        ? "bg-white hover:bg-[#f3f4f6]"
                        : "bg-[#f9fafb] opacity-60 cursor-not-allowed"
                    }`}
                  >
                    View Logs
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setIsSeeAllOpen(true);
          setIsFilterOpen(false);
        }}
        className="mt-5 w-full rounded-xl bg-[#4f49e2] py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)]"
      >
        See All
      </button>

      {isSeeAllOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.7)] max-h-[92vh]">
            <div className="flex items-start justify-between border-b border-[#eef1f7] px-8 py-6">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-[#111827]">
                    Agent Management
                  </h3>
                  <span className="rounded-md border border-[#cbd2ff] px-2 py-0.5 text-xs font-semibold text-[#5b4cf0]">
                    {totalAgents}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#5b6476]">
                  Start/stop live actions and inspect recent activity.
                </p>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-xl border border-[#e3e7f2] px-3 py-2 text-sm font-medium text-[#111827] shadow-[0_6px_14px_-12px_rgba(16,24,40,0.3)]"
                >
                  <Filter className="h-4 w-4" />
                  Filter
                </button>
                {isFilterOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.3)]">
                    {[
                      { label: "All", value: "all" },
                      { label: "Running", value: "running" },
                      { label: "Stopped", value: "stopped" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setAgentFilter(option.value as "all" | "running" | "stopped");
                          setIsFilterOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm ${
                          agentFilter === option.value
                            ? "bg-[#eef2ff] text-[#4f49e2]"
                            : "text-[#111827] hover:bg-[#f3f4f6]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 max-h-[620px]">
              {agentFilter !== "all" ? (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e0e5f0] bg-white px-3 py-1 text-xs font-semibold text-[#4f49e2]">
                  {agentFilter === "running" ? "Running" : "Stopped"}
                  <button
                    type="button"
                    onClick={() => setAgentFilter("all")}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}

              {isAgentsLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`agent-modal-skeleton-${index}`}
                      className="animate-pulse rounded-2xl border border-[#eef1f7] bg-white px-5 py-4 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="h-10 w-10 rounded-2xl bg-[#edf2f9]" />
                          <div className="space-y-2">
                            <span className="block h-4 w-36 rounded bg-[#edf2f9]" />
                            <span className="block h-3 w-48 rounded bg-[#edf2f9]" />
                          </div>
                        </div>
                        <span className="h-5 w-24 rounded bg-[#edf2f9]" />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <span className="h-10 rounded-xl bg-[#edf2f9]" />
                        <span className="h-10 rounded-xl bg-[#edf2f9]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : agentsError ? (
                <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-6 text-sm text-[#b91c1c] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
                  {agentsError}
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-6 text-sm text-[#647087] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
                  No agents yet.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredAgents.map((agent) => {
                    const isRunning = agent.status?.toUpperCase() === "STARTED";
                    const isMule =
                      (agent.enterprise ?? "").trim().toLowerCase() === "mule";
                    const updatedAt = formatUpdatedAt(agent.updated_at);
                    return (
                      <div
                        key={`modal-${agent.agentId}`}
                        className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-4 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
                              <Bot className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#111827]">
                                {agent.name}
                              </p>
                              <p className="text-xs text-[#647087]">
                                Updated at: {updatedAt} - v1.0.0
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#647087]">
                            <span>{isRunning ? "Running" : "Stopped"}</span>
                            <button
                              type="button"
                              disabled
                              aria-label={`${isRunning ? "Running" : "Stopped"} status`}
                              className={`relative inline-flex h-5 w-10 cursor-default items-center rounded-full ${
                                isRunning ? "bg-[#5b4cf0]" : "bg-[#e3e6ee]"
                              }`}
                            >
                              <span
                                className={`absolute h-4 w-4 rounded-full bg-white shadow transition ${
                                  isRunning ? "left-5" : "left-1"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => openChat(agent)}
                            disabled={!isRunning}
                            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                              isRunning
                                ? "bg-[#cfefff] text-[#0b7ed9]"
                                : "cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]"
                            }`}
                          >
                            <MessageCircle className="h-4 w-4" />
                            Chat with agent
                          </button>
                          <button
                            type="button"
                            disabled={!isMule}
                            className={`flex items-center justify-center gap-2 rounded-xl border border-[#e1e5ef] px-4 py-2 text-sm font-medium text-[#3a4355] ${
                              isMule
                                ? "bg-white hover:bg-[#f3f4f6]"
                                : "bg-[#f9fafb] opacity-60 cursor-not-allowed"
                            }`}
                          >
                            View Logs
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-center border-t border-[#eef1f7] px-8 py-4">
              <button
                type="button"
                onClick={closeSeeAll}
                className="text-sm font-semibold text-[#4f49e2] hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeChatAgent ? (
        <AgentChatWorkspace agent={activeChatAgent} onClose={closeChat} />
      ) : null}
    </div>
  );
}
