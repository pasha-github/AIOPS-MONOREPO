"use client";

import { useRuntimeConfig } from "@/config/runtime-config";
import AgentChatWorkspace from "./AgentChatWorkspace";
import { Bot, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AgentList,
  FilterMenu,
  mapAgentListResponse,
  resolveLlmManagerBaseUrl,
  type AgentFilter,
  type AgentListApiResponseItem,
  type AgentRecord,
} from "./agentmanagementdashboard";

export default function AgentManagementSection() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const agentListUrl = `${resolveLlmManagerBaseUrl(llmManagerApiBaseUrl)}/agent/`;
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isAgentsLoading, setIsAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSeeAllOpen, setIsSeeAllOpen] = useState(false);
  const [activeChatAgent, setActiveChatAgent] = useState<AgentRecord | null>(null);
  const [agentListMaxHeight, setAgentListMaxHeight] = useState<number | null>(null);
  const agentsRef = useRef<AgentRecord[]>([]);
  const requestIdRef = useRef(0);
  const firstAgentCardRef = useRef<HTMLDivElement | null>(null);

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
  }, [agentFilter, agents]);

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

      const gapPx = 16;
      setAgentListMaxHeight(cardHeight * 3 + gapPx * 2);
    };

    updateListHeight();
    window.addEventListener("resize", updateListHeight);
    return () => window.removeEventListener("resize", updateListHeight);
  }, [agentsError, filteredAgents.length, isAgentsLoading]);

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

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (response.ok && Array.isArray(data)) {
          setAgents(mapAgentListResponse(data as AgentListApiResponseItem[]));
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
        if (requestId !== requestIdRef.current || shouldRefresh) {
          return;
        }
        setIsAgentsLoading(false);
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

  const totalAgents = agents.length;

  const clearFilter = () => setAgentFilter("all");
  const closeSeeAll = () => {
    setIsSeeAllOpen(false);
    setIsFilterOpen(false);
  };
  const openChat = (agent: AgentRecord) => setActiveChatAgent(agent);
  const closeChat = () => setActiveChatAgent(null);

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

        <FilterMenu
          agentFilter={agentFilter}
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen((prev) => !prev)}
          onSelect={(value) => {
            setAgentFilter(value);
            setIsFilterOpen(false);
          }}
        />
      </div>

      {agentFilter !== "all" ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#e0e5f0] bg-white px-3 py-1 text-xs font-semibold text-[#4f49e2]">
          {agentFilter === "running" ? "Running" : "Stopped"}
          <button
            type="button"
            onClick={clearFilter}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <div
        className="mt-6 flex-1 overflow-y-auto pr-2 no-scrollbar"
        style={
          agentListMaxHeight ? { maxHeight: `${agentListMaxHeight}px` } : undefined
        }
      >
        <AgentList
          agents={filteredAgents}
          isLoading={isAgentsLoading}
          error={agentsError}
          layout="stack"
          onOpenChat={openChat}
          firstItemRef={firstAgentCardRef}
        />
      </div>

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={() => {
            setIsSeeAllOpen(true);
            setIsFilterOpen(false);
          }}
          className="w-full rounded-xl bg-[#4f49e2] py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)]"
        >
          See All
        </button>
      </div>

      {isSeeAllOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.7)]">
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

              <FilterMenu
                agentFilter={agentFilter}
                isOpen={isFilterOpen}
                onToggle={() => setIsFilterOpen((prev) => !prev)}
                onSelect={(value) => {
                  setAgentFilter(value);
                  setIsFilterOpen(false);
                }}
              />
            </div>

            <div className="max-h-[620px] flex-1 overflow-y-auto px-8 py-6">
              {agentFilter !== "all" ? (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e0e5f0] bg-white px-3 py-1 text-xs font-semibold text-[#4f49e2]">
                  {agentFilter === "running" ? "Running" : "Stopped"}
                  <button
                    type="button"
                    onClick={clearFilter}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}

              <AgentList
                agents={filteredAgents}
                isLoading={isAgentsLoading}
                error={agentsError}
                layout="grid"
                onOpenChat={openChat}
              />
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
