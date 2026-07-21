 "use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Bot, Brain, Loader2, RefreshCw, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";


const iconMap = {
  agents: UserRound,
  providers: Bot,
  llms: Brain,
} as const;

const gradientMap = {
  agents: "from-[#ff7a45] to-[#ff4d4f]",
  providers: "from-[#18c964] to-[#00b56c]",
  llms: "from-[#2f80ff] to-[#1aa7ff]",
} as const;

type OverviewCounts = {
  conversationalAgents: number;
  automationAgents: number;
  conversationalOnlineAgents: number;
  conversationalOfflineAgents: number;
  automationOnlineAgents: number;
  automationOfflineAgents: number;
  totalAgents: number;
  configuredLlms: number;
  providerCount: number;
};

const EMPTY_COUNTS: OverviewCounts = {
  conversationalAgents: 0,
  automationAgents: 0,
  conversationalOnlineAgents: 0,
  conversationalOfflineAgents: 0,
  automationOnlineAgents: 0,
  automationOfflineAgents: 0,
  totalAgents: 0,
  configuredLlms: 0,
  providerCount: 0,
};

const resolveLlmManagerBaseUrl = (value: string) => {
  const trimmed = trimTrailingSlash(value.trim());
  if (!trimmed) {
    throw new Error("NEXT_PUBLIC_LLM_MANAGER_API_BASE_URL is not configured.");
  }

  return trimmed;
};

const formatLastRefreshed = (timestamp: number | null, now: number) => {
  if (!timestamp) {
    return "Not refreshed yet";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - timestamp) / 60000)
  );

  if (elapsedMinutes === 0) {
    return "Just now";
  }

  if (elapsedMinutes === 1) {
    return "1 minute ago";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minutes ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return elapsedHours === 1 ? "1 hour ago" : `${elapsedHours} hours ago`;
};

const isAgentOnline = (item: unknown) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }

  const record = item as Record<string, unknown>;
  if (typeof record.isEnabled === "boolean") {
    return record.isEnabled;
  }

  const status = typeof record.status === "string" ? record.status.trim().toLowerCase() : "";
  return status === "active" || status === "online" || status === "started";
};

export default function DashboardOverview() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const baseUrl = resolveLlmManagerBaseUrl(llmManagerApiBaseUrl);
  const [counts, setCounts] = useState<OverviewCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadCounts = useCallback(
    async () => {
      setIsLoading(true);
      try {
        const [agentResponse, llmResponse] = await Promise.all([
          fetch(`${baseUrl}/agent/`, { headers: { accept: "application/json" } }),
          fetch(`${baseUrl}/llms/`, { headers: { accept: "application/json" } }),
        ]);
        const [agentPayload, llmPayload] = await Promise.all([
          agentResponse.json(),
          llmResponse.json(),
        ]);

        const agents = Array.isArray(agentPayload) ? agentPayload : [];
        const llms = Array.isArray(llmPayload) ? llmPayload : [];
        const providers = new Set(
          llms
            .map((item) =>
              item && typeof item === "object" && !Array.isArray(item)
                ? (item as Record<string, unknown>).provider
                : null
            )
            .filter(
              (provider): provider is string =>
                typeof provider === "string" && provider.trim().length > 0
            )
            .map((provider) => provider.trim().toLowerCase())
        );
        const automationAgentItems = agents.filter((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return false;
          }
          const type = (item as Record<string, unknown>).type;
          return typeof type === "string" && type.trim().toLowerCase() === "automation";
        });
        const automationAgents = Math.max(automationAgentItems.length, 0);
        const automationOnlineAgents =
          automationAgentItems.filter(isAgentOnline).length;
        const automationOfflineAgents = Math.max(
          automationAgents - automationOnlineAgents,
          0
        );
        const conversationalAgentItems = agents.filter((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return false;
          }
          const type = (item as Record<string, unknown>).type;
          return typeof type !== "string" || type.trim().toLowerCase() !== "automation";
        });
        const conversationalAgents = Math.max(
          conversationalAgentItems.length,
          0
        );
        const conversationalOnlineAgents =
          conversationalAgentItems.filter(isAgentOnline).length;
        const conversationalOfflineAgents = Math.max(
          conversationalAgents - conversationalOnlineAgents,
          0
        );

        setCounts({
          conversationalAgents,
          automationAgents,
          conversationalOnlineAgents,
          conversationalOfflineAgents,
          automationOnlineAgents,
          automationOfflineAgents,
          totalAgents: agents.length,
          configuredLlms: llms.length,
          providerCount: providers.size,
        });
        setLastRefreshedAt(Date.now());
      } catch {
        setCounts(EMPTY_COUNTS);
      } finally {
        setIsLoading(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const lastRefreshedLabel = useMemo(
    () => formatLastRefreshed(lastRefreshedAt, now),
    [lastRefreshedAt, now]
  );

  const overviewStats = useMemo(
    () => [
      {
        title: "Conversational Agents",
        value: counts.conversationalAgents,
        detail: `Out of ${counts.totalAgents} agents`,
        statusCounts: {
          online: counts.conversationalOnlineAgents,
          offline: counts.conversationalOfflineAgents,
        },
        tone: "agents" as const,
      },
      {
        title: "Automation Agents",
        value: counts.automationAgents,
        detail: `Out of ${counts.totalAgents} agents`,
        statusCounts: {
          online: counts.automationOnlineAgents,
          offline: counts.automationOfflineAgents,
        },
        tone: "providers" as const,
      },
      {
        title: "Configured LLMs",
        value: counts.configuredLlms,
        detail: `Across ${counts.providerCount} providers`,
        tone: "llms" as const,
      },
    ],
    [counts]
  );

  return (
    <section className="relative rounded-3xl bg-white px-8 py-6">
      <div className="grid items-stretch gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="px-6 py-6">
          <div className="space-y-2">
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-2.5">
                <UserRound className="h-5 w-5 text-[#4f49e2]" />
                <h2 className="text-[24px] font-semibold leading-tight text-[#10131a]">
                  Welcome To Royal Cyber AIOPS for Enterprise
                </h2>
              </div>
              <p className="max-w-[460px] text-sm font-medium leading-6 text-[#64748b]">
                Monitor agents, providers, and platform capacity at a glance.
              </p>
              <div className="flex items-center gap-2 text-xs font-medium text-[#8a94a6]">
                <span>Last Refresh: {lastRefreshedLabel}</span>
                <button
                  type="button"
                  onClick={() => void loadCounts()}
                  disabled={isLoading}
                  aria-label="Refresh dashboard overview"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e5eaf3] bg-white text-[#64748b] transition hover:border-[#cfd7e6] hover:text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overviewStats.map((card) => {
              const Icon = iconMap[card.tone];
              const statusCounts =
                "statusCounts" in card ? card.statusCounts : null;
              return (
                <div
                  key={card.title}
                  className="flex min-h-[188px] flex-col justify-between rounded-[24px] bg-white px-5 py-5 text-left ring-[#edf2f9]"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradientMap[card.tone]} text-white shadow-[0_10px_20px_-12px_rgba(0,0,0,0.45)]`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[#5a6476]">
                      {card.title}
                    </p>
                    <div className="flex items-end gap-3">
                      <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-[#0f1115]">
                        {isLoading ? (
                          <Loader2 className="h-7 w-7 animate-spin text-[#5b4cf0]" />
                        ) : (
                          card.value
                        )}
                      </p>
                      {statusCounts && !isLoading ? (
                        <div className="mb-1 flex flex-col gap-1 text-xs font-medium text-[#8a94a6]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#18c964]" />
                            {statusCounts.online} online
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                            {statusCounts.offline} offline
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {"detail" in card && !isLoading ? (
                      <p className="text-xs font-medium text-[#8a94a6]">
                        {card.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        
      </div>
    </section>
  );
}
