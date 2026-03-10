"use client";

import { AGENT_API_BASE_URL, AGENT_HOST, AGENT_ORG_KEY } from "@/config/agent";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type AgentRecord = {
  agentId: number;
  name: string;
  port: number | null;
  status: string;
  enterprise: string;
};

const AGENT_API_BASE = AGENT_API_BASE_URL.endsWith("/")
  ? AGENT_API_BASE_URL.slice(0, -1)
  : AGENT_API_BASE_URL;
const AGENT_LIST_URL = `${AGENT_API_BASE}/aiops/agent/list`;

const baseStatCards = [
  {
    title: "Total Incidents",
    icon: TriangleAlert,
    bg: "from-[#ff7a45] to-[#ff4d4f]",
  },
  {
    title: "Resolved Incidents",
    value: "30",
    icon: CheckCircle2,
    bg: "from-[#18c964] to-[#00b56c]",
  },
  {
    title: "Open Incidents",
    value: "58",
    icon: Zap,
    bg: "from-[#2f80ff] to-[#1aa7ff]",
  },
];

export default function DashboardOverview() {
  const [incidentCount, setIncidentCount] = useState<string>("--");
  const [isIncidentLoading, setIsIncidentLoading] = useState(false);
  const [openCount, setOpenCount] = useState<string>("--");
  const [closedCount, setClosedCount] = useState<string>("--");
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const serviceNowAgentRef = useRef<{
    agentId: number;
    port: number | null;
  } | null>(null);
  const statsInFlightRef = useRef(false);
  const statsRequestIdRef = useRef(0);
  const lastStatsAtRef = useRef(0);
  const lastAutoRefreshRef = useRef(0);
  const initialLoadRef = useRef(false);
  const AUTO_REFRESH_COOLDOWN_MS = 1500;
  const pathname = usePathname();

  const loadIncidentDetailsForAgent = useCallback(
    async (
      agentId: number,
      port: number,
      signal?: AbortSignal,
      options?: { force?: boolean }
    ) => {
      const now = Date.now();
      if (!options?.force) {
        if (statsInFlightRef.current) {
          return;
        }
        if (now - lastStatsAtRef.current < AUTO_REFRESH_COOLDOWN_MS) {
          return;
        }
      }

      statsInFlightRef.current = true;
      lastStatsAtRef.current = now;
      const requestId = ++statsRequestIdRef.current;

      setIsDetailsLoading(true);
      setIsIncidentLoading(true);
      try {
        const detailsUrl = `${AGENT_HOST}:${port}/agent/serviceNow/incidentDetails`;
        const fetchWithRetry = async () => {
          let lastError: unknown = null;
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            if (signal?.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            try {
              const response = await fetch(detailsUrl, {
                method: "POST",
                headers: {
                  accept: "application/json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ agent_id: String(agentId) }),
                signal,
              });
              const data = await response.json();
              console.log("ServiceNow incident details response:", {
                ok: response.ok,
                status: response.status,
                data,
                attempt,
              });
              if (response.ok && Array.isArray(data?.incidents)) {
                return data;
              }
              lastError = new Error("Invalid incident details response");
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") {
                throw error;
              }
              lastError = error;
            }
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 600));
            }
          }
          throw lastError ?? new Error("Incident details request failed");
        };

        const detailsData = await fetchWithRetry();

        const incidents = detailsData.incidents as { status?: string }[];
        const open = incidents.filter(
          (item) => String(item.status ?? "").toLowerCase() === "open"
        ).length;
        const closed = incidents.filter(
          (item) => String(item.status ?? "").toLowerCase() === "closed"
        ).length;
        const total =
          typeof detailsData?.total_incidents === "number"
            ? detailsData.total_incidents
            : incidents.length;
        setIncidentCount(String(total));
        setOpenCount(String(open));
        setClosedCount(String(closed));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setOpenCount("--");
        setClosedCount("--");
        setIncidentCount("--");
      } finally {
        if (requestId === statsRequestIdRef.current) {
          setIsDetailsLoading(false);
          setIsIncidentLoading(false);
          statsInFlightRef.current = false;
        }
      }
    },
    []
  );

  const loadIncidentCount = useCallback(
    async (signal?: AbortSignal, options?: { force?: boolean }) => {
      const now = Date.now();
      if (!options?.force) {
        if (statsInFlightRef.current) {
          return;
        }
        if (now - lastStatsAtRef.current < AUTO_REFRESH_COOLDOWN_MS) {
          return;
        }
      }
      try {
        const listResponse = await fetch(
          `${AGENT_LIST_URL}?orgKey=${encodeURIComponent(AGENT_ORG_KEY)}`,
        {
          headers: { accept: "application/json" },
          signal,
        }
      );
      const listData = await listResponse.json();

      if (!listResponse.ok || !Array.isArray(listData?.agents)) {
        setIncidentCount("--");
        setIsIncidentLoading(false);
        return;
      }

      const serviceNowAgent = (listData.agents as AgentRecord[]).find(
        (agent) =>
          agent.enterprise?.trim().toLowerCase() === "servicenow" &&
          agent.status?.toUpperCase() === "STARTED" &&
          agent.port
      );

      if (!serviceNowAgent) {
        setIncidentCount("--");
        setIsIncidentLoading(false);
        setOpenCount("--");
        setClosedCount("--");
        setIsDetailsLoading(false);
        serviceNowAgentRef.current = null;
        return;
      }

      serviceNowAgentRef.current = {
        agentId: serviceNowAgent.agentId,
        port: serviceNowAgent.port ?? null,
      };

      if (typeof serviceNowAgent.port !== "number") {
        setIncidentCount("--");
        setOpenCount("--");
        setClosedCount("--");
        setIsDetailsLoading(false);
        return;
      }

      await loadIncidentDetailsForAgent(
        serviceNowAgent.agentId,
        serviceNowAgent.port,
        signal,
        options
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setIncidentCount("--");
      setOpenCount("--");
      setClosedCount("--");
    } finally {
      if (statsRequestIdRef.current === 0) {
        setIsIncidentLoading(false);
      }
    }
  }, [loadIncidentDetailsForAgent]);

  useEffect(() => {
    if (initialLoadRef.current) {
      return;
    }
    initialLoadRef.current = true;
    const controller = new AbortController();
    loadIncidentCount(controller.signal);
    return () => controller.abort();
  }, [loadIncidentCount]);

  useEffect(() => {
    if (!pathname?.includes("dashboard")) {
      return;
    }
    loadIncidentCount(undefined, { force: true });
  }, [pathname, loadIncidentCount]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastAutoRefreshRef.current < AUTO_REFRESH_COOLDOWN_MS) {
          return;
        }
        lastAutoRefreshRef.current = now;
        loadIncidentCount(undefined, { force: false });
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastAutoRefreshRef.current < AUTO_REFRESH_COOLDOWN_MS) {
        return;
      }
      lastAutoRefreshRef.current = now;
      loadIncidentCount(undefined, { force: false });
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadIncidentCount]);

  useEffect(() => {
    const handleAgentStatusChanged = (event: Event) => {
      const detail = (event as CustomEvent)?.detail as
        | {
            agentId?: number;
            enterprise?: string | null;
            status?: string;
            port?: number | null;
            action?: "start" | "stop";
          }
        | undefined;

      if (
        detail?.enterprise?.trim().toLowerCase() === "servicenow" &&
        detail.action === "stop"
      ) {
        setIncidentCount("--");
        setIsIncidentLoading(false);
        setOpenCount("--");
        setClosedCount("--");
        setIsDetailsLoading(false);
        serviceNowAgentRef.current = null;
        return;
      }

      if (
        detail?.enterprise?.trim().toLowerCase() === "servicenow" &&
        detail.action === "start" &&
        typeof detail.port === "number" &&
        typeof detail.agentId === "number"
      ) {
        serviceNowAgentRef.current = {
          agentId: detail.agentId,
          port: detail.port,
        };
        loadIncidentDetailsForAgent(detail.agentId, detail.port, undefined, {
          force: true,
        });
        return;
      }

      loadIncidentCount(undefined, { force: true });
    };
    window.addEventListener("agents:statusChanged", handleAgentStatusChanged);
    return () => {
      window.removeEventListener("agents:statusChanged", handleAgentStatusChanged);
    };
  }, [loadIncidentCount, loadIncidentDetailsForAgent]);

  const statCards = baseStatCards.map((card) =>
    card.title === "Total Incidents"
      ? { ...card, value: incidentCount, isLoading: isIncidentLoading }
      : card.title === "Resolved Incidents"
        ? { ...card, value: closedCount, isLoading: isDetailsLoading }
        : card.title === "Open Incidents"
          ? { ...card, value: openCount, isLoading: isDetailsLoading }
      : card
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
                Here's what's happening with your infrastructure today
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const cached = serviceNowAgentRef.current;
                if (cached && typeof cached.port === "number") {
                  loadIncidentDetailsForAgent(
                    cached.agentId,
                    cached.port,
                    undefined,
                    {
                      force: true,
                    }
                  );
                  window.dispatchEvent(new CustomEvent("incidents:refresh"));
                  return;
                }
                loadIncidentCount(undefined, { force: true });
                window.dispatchEvent(new CustomEvent("incidents:refresh"));
              }}
              disabled={isIncidentLoading || isDetailsLoading}
              className={`inline-flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)] transition ${
                isIncidentLoading || isDetailsLoading
                  ? "cursor-not-allowed opacity-60"
                  : "hover:border-[#c7d2fe] hover:text-[#4338ca]"
              }`}
              aria-label="Refresh Incident details"
              title="Refresh Incident details"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isIncidentLoading || isDetailsLoading ? "animate-spin" : ""
                }`}
              />
              Refresh Incident details
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
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="flex flex-col items-center rounded-2xl bg-white p-5 text-center shadow-[0_12px_30px_-28px_rgba(16,24,40,0.45)] ring-1 ring-[#eef1f7]"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.bg} text-white shadow-[0_10px_20px_-12px_rgba(0,0,0,0.45)]`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-6 text-sm font-semibold text-[#5a6476]">
                  {card.title}
                </p>
                <p className="mt-2 flex items-center justify-center gap-2 text-3xl font-semibold text-[#0f1115]">
                  {"isLoading" in card && card.isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-[#5b4cf0]" />
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
