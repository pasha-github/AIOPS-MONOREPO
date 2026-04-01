 "use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Bot, Layers3, Loader2, RefreshCw, Waypoints } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { serviceNowApiDetails } from "./staticData";

const iconMap = {
  agents: Bot,
  providers: Layers3,
  llms: Waypoints,
} as const;

const gradientMap = {
  agents: "from-[#ff7a45] to-[#ff4d4f]",
  providers: "from-[#18c964] to-[#00b56c]",
  llms: "from-[#2f80ff] to-[#1aa7ff]",
} as const;

type OverviewCounts = {
  totalAgents: number;
  providerCount: number;
  totalLlms: number;
};

const EMPTY_COUNTS: OverviewCounts = {
  totalAgents: 0,
  providerCount: 0,
  totalLlms: 0,
};

export default function DashboardOverview() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const baseUrl = trimTrailingSlash(llmManagerApiBaseUrl);
  const [counts, setCounts] = useState<OverviewCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadCounts = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

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

        setCounts({
          totalAgents: agents.length,
          providerCount: providers.size,
          totalLlms: llms.length,
        });
      } catch {
        setCounts(EMPTY_COUNTS);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const overviewStats = useMemo(
    () => [
      { title: "Total Agents", value: counts.totalAgents, tone: "agents" as const },
      { title: "LLM Providers", value: counts.providerCount, tone: "providers" as const },
      { title: "Total LLMs", value: counts.totalLlms, tone: "llms" as const },
    ],
    [counts]
  );

  return (
    <section className="relative rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_2fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#10131a]">
                Welcome back, Alice!
              </h2>
              <p className="mt-2 text-sm text-[#5b6476]">
                ServiceNow instance: {serviceNowApiDetails.instance}
              </p>
              <p className="mt-1 text-xs text-[#8a94a6]">
                Endpoint: {serviceNowApiDetails.endpoint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadCounts(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh Overview
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-[#1d2433]">
              <span>Profile Completion:</span>
              <span className="text-[#5b4cf0]">75%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#e8ebf4]">
              <div className="relative h-2 w-[75%] rounded-full bg-[#5b4cf0]">
                <span className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full border-[3px] border-white bg-[#5b4cf0] shadow-[0_4px_12px_rgba(91,76,240,0.35)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid justify-end gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {overviewStats.map((card) => {
            const Icon = iconMap[card.tone];
            return (
              <div
                key={card.title}
                className="flex flex-col items-center rounded-2xl bg-white p-5 text-center shadow-[0_12px_30px_-28px_rgba(16,24,40,0.45)] ring-1 ring-[#eef1f7]"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${gradientMap[card.tone]} text-white shadow-[0_10px_20px_-12px_rgba(0,0,0,0.45)]`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-6 text-sm font-semibold text-[#5a6476]">
                  {card.title}
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#0f1115]">
                  {isLoading || isRefreshing ? (
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#5b4cf0]" />
                  ) : (
                    card.value
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
