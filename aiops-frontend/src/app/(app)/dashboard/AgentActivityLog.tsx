"use client";

import { useRuntimeConfig } from "@/config/runtime-config";
import {
  Activity,
  Bell,
  Bot,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type AgentSessionDetail,
  type AgentSessionSummary,
  type AutomationAgentOption,
  fetchAgentSessionDetail,
  fetchAgentSessions,
  fetchAutomationAgents,
  renderMarkdownBlocks,
  resolveAgentManagerApiBase,
  resolveLogsApiBase,
} from "./logs";

const levelStyles = {
  text: "bg-[#eef2ff] text-[#4338ca]",
  request: "bg-[#fff7ed] text-[#ea580c]",
} as const;

const entryIconStyles = {
  text: "bg-[#ecebff] text-[#5b4cf0]",
  request: "bg-[#fff1e8] text-[#ea580c]",
} as const;

const REVEAL_INTERVAL_MS = 140;
const DASHBOARD_SESSION_LIMIT = 5;

function EmptyAutomationSessionsState() {
  return (
    <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] px-6 py-10 text-center">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <Activity className="h-48 w-48 text-[#16a34a]/[0.07]" strokeWidth={1.2} />
      </div>
      <div className="relative z-10 mx-auto max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#e6f9ee] text-[#16a34a] shadow-[0_18px_35px_-24px_rgba(22,163,74,0.7)]">
          <Activity className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[#111827]">
          No Automation Sessions
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#5f677a]">
          Automation activity will appear here after the selected agent runs,
          triggers a workflow, or records session events.
        </p>
      </div>
    </div>
  );
}

export default function AgentActivityLog() {
  const { agentAdkBaseUrl, llmManagerApiBaseUrl } = useRuntimeConfig();
  const logsApiBaseUrl = resolveLogsApiBase(agentAdkBaseUrl);
  const agentManagerApiBaseUrl = resolveAgentManagerApiBase(llmManagerApiBaseUrl);
  const [agents, setAgents] = useState<AutomationAgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isAgentsLoading, setIsAgentsLoading] = useState(true);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionDetails, setSessionDetails] = useState<Record<string, AgentSessionDetail>>(
    {}
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [visibleEntryCount, setVisibleEntryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sessionDetailsRef = useRef<Record<string, AgentSessionDetail>>({});
  const selectedSessionIdRef = useRef<string | null>(null);
  const selectedAgentIdRef = useRef<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sessionDetailsRef.current = sessionDetails;
  }, [sessionDetails]);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  useEffect(() => {
    if (!isAgentMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuContainerRef.current?.contains(event.target as Node)) {
        setIsAgentMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isAgentMenuOpen]);

  const loadSessionDetail = useCallback(
    async (sessionId: string, options?: { force?: boolean; signal?: AbortSignal }) => {
      if (!options?.force && sessionDetailsRef.current[sessionId]) {
        return sessionDetailsRef.current[sessionId];
      }

      setLoadingSessionId(sessionId);
      try {
        const detail = await fetchAgentSessionDetail(
          sessionId,
          options?.signal,
          logsApiBaseUrl,
          selectedAgentIdRef.current ?? undefined
        );
        setSessionDetails((current) => {
          const next = {
            ...current,
            [sessionId]: detail,
          };
          sessionDetailsRef.current = next;
          return next;
        });
        return detail;
      } finally {
        setLoadingSessionId((current) => (current === sessionId ? null : current));
      }
    },
    [logsApiBaseUrl]
  );

  const loadSessions = useCallback(
    async (refresh = false, signal?: AbortSignal) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError("");

      try {
        const nextSessions = await fetchAgentSessions(
          signal,
          logsApiBaseUrl,
          selectedAgentIdRef.current ?? undefined
        );
        const nextSelectedSessionId =
          selectedSessionIdRef.current &&
          nextSessions.some((session) => session.id === selectedSessionIdRef.current)
            ? selectedSessionIdRef.current
            : null;

        startTransition(() => {
          setSessions(nextSessions);
          setSelectedSessionId(nextSelectedSessionId);
          if (refresh) {
            sessionDetailsRef.current = {};
            setSessionDetails({});
            setActiveEntryId(null);
          }
        });

        if (nextSelectedSessionId) {
          await loadSessionDetail(nextSelectedSessionId, {
            force: refresh,
            signal,
          });
        }
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load automation sessions right now.");
          setSessions([]);
          setSelectedSessionId(null);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadSessionDetail, logsApiBaseUrl]
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadAgents = async () => {
      setIsAgentsLoading(true);
      try {
        const nextAgents = await fetchAutomationAgents(
          controller.signal,
          agentManagerApiBaseUrl
        );
        setAgents(nextAgents);
        setSelectedAgentId((current) => {
          if (current && nextAgents.some((agent) => agent.id === current)) {
            return current;
          }
          return nextAgents[0]?.id ?? null;
        });
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setAgents([]);
          setSelectedAgentId(null);
          setError("Unable to load automation agents right now.");
        }
      } finally {
        setIsAgentsLoading(false);
      }
    };

    void loadAgents();
    return () => controller.abort();
  }, [agentManagerApiBaseUrl]);

  useEffect(() => {
    if (isAgentsLoading) {
      return;
    }

    if (!selectedAgentId) {
      setSessions([]);
      setSelectedSessionId(null);
      setSessionDetails({});
      sessionDetailsRef.current = {};
      setVisibleEntryCount(0);
      setActiveEntryId(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    void loadSessions(false, controller.signal);
    return () => controller.abort();
  }, [isAgentsLoading, loadSessions, selectedAgentId]);

  const dashboardSessions = useMemo(
    () => sessions.slice(0, DASHBOARD_SESSION_LIMIT),
    [sessions]
  );
  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? null;

  const selectedDetail = selectedSessionId ? sessionDetails[selectedSessionId] : null;
  const visibleEntries = useMemo(
    () => selectedDetail?.entries.slice(0, visibleEntryCount) ?? [],
    [selectedDetail, visibleEntryCount]
  );
  const activeEntry = useMemo(
    () => visibleEntries.find((entry) => entry.id === activeEntryId) ?? null,
    [activeEntryId, visibleEntries]
  );

  useEffect(() => {
    if (!selectedDetail) {
      setVisibleEntryCount(0);
      return;
    }

    setVisibleEntryCount(0);
    if (selectedDetail.entries.length === 0) {
      return;
    }

    let currentIndex = 0;
    const intervalId = window.setInterval(() => {
      currentIndex += 1;
      startTransition(() => {
        setVisibleEntryCount(Math.min(currentIndex, selectedDetail.entries.length));
      });

      if (currentIndex >= selectedDetail.entries.length) {
        window.clearInterval(intervalId);
      }
    }, REVEAL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedDetail]);

  const handleSessionClick = useCallback(
    async (sessionId: string) => {
      const nextSessionId = selectedSessionId === sessionId ? null : sessionId;
      setSelectedSessionId(nextSessionId);

      if (!nextSessionId) {
        return;
      }

      try {
        await loadSessionDetail(nextSessionId);
      } catch {
        setError("Unable to load the selected automation session log.");
      }
    },
    [loadSessionDetail, selectedSessionId]
  );

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    void loadSessions(true, controller.signal);
  }, [loadSessions]);

  const openEntryModal = useCallback((entryId: string) => {
    setActiveEntryId(entryId);
  }, []);

  const closeEntryModal = useCallback(() => {
    setActiveEntryId(null);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex items-center justify-between gap-4">
        <div ref={menuContainerRef} className="relative flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e6f9ee] text-[#16a34a]">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a94a6]">
              Automation agent
            </p>
            <button
              type="button"
              onClick={() => setIsAgentMenuOpen((current) => !current)}
              disabled={isAgentsLoading || agents.length === 0}
              className="mt-1 inline-flex min-h-8 max-w-full items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="truncate text-lg font-semibold leading-tight text-[#111827]">
                {selectedAgent?.name ?? "Select agent"}
              </span>
              {isAgentsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#5b4cf0]" />
              ) : (
                <ChevronDown
                  className={`h-4 w-4 text-[#748096] transition-transform ${
                    isAgentMenuOpen ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>
          </div>

          {isAgentMenuOpen && agents.length > 0 ? (
            <div className="absolute left-0 top-[calc(100%+12px)] z-40 w-[320px] rounded-2xl border border-[#e4ebf8] bg-white p-3 shadow-[0_28px_60px_-34px_rgba(15,23,42,0.35)]">
              <div className="max-h-[320px] overflow-y-auto pr-1">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setSelectedSessionId(null);
                      setSessionDetails({});
                      sessionDetailsRef.current = {};
                      setVisibleEntryCount(0);
                      setActiveEntryId(null);
                      setError("");
                      setIsAgentMenuOpen(false);
                    }}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left transition ${
                      agent.id === selectedAgentId
                        ? "bg-[#eef2ff] text-[#24324a]"
                        : "text-[#5f677a] hover:bg-[#f8faff]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 shrink-0 text-[#4f49e2]" />
                        <p className="truncate text-sm font-semibold text-[#111827]">
                          {agent.name}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-[#7a8498]">{agent.id}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e3e7f2] bg-white text-[#6b7280] shadow-[0_8px_16px_-14px_rgba(16,24,40,0.4)]"
            aria-label="Refresh logs"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a94a6]">
            Latest Sessions
          </p>
          <p className="mt-1 text-sm text-[#6b7280]">
            {selectedAgent
              ? `Showing the latest ${DASHBOARD_SESSION_LIMIT} sessions for ${selectedAgent.name}.`
              : `Showing the latest ${DASHBOARD_SESSION_LIMIT} sessions.`}
          </p>
        </div>
      </div>

      <div className="soft-scrollbar mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`session-skeleton-${index}`}
                className="animate-pulse rounded-2xl border border-[#eef1f7] bg-white px-4 py-3 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <span className="block h-4 w-3/4 rounded bg-[#edf2f9]" />
                    <span className="block h-3 w-24 rounded bg-[#edf2f9]" />
                  </div>
                  <span className="h-4 w-4 rounded bg-[#edf2f9]" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && dashboardSessions.length > 0 ? (
          dashboardSessions.map((session) => {
            const isOpen = session.id === selectedSessionId;
            const isSessionLoading = loadingSessionId === session.id;
            const detail = sessionDetails[session.id];
            const detailEntries =
              detail?.entries.slice(
                0,
                session.id === selectedSessionId
                  ? visibleEntryCount || detail.entries.length
                  : detail?.entries.length ?? 0
              ) ?? [];

            return (
              <div
                key={session.id}
                className={`overflow-hidden rounded-2xl border shadow-[0_14px_34px_-30px_rgba(15,23,42,0.4)] transition-all ${
                  isOpen
                    ? "border-[#cfd7ff] bg-[#f8faff]"
                    : "border-[#edf1f7] bg-white hover:border-[#dbe4f5]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleSessionClick(session.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">
                      {session.summary}
                    </p>
                    <p className="mt-1 text-xs text-[#748096]">{session.updatedAtLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSessionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#5b4cf0]" />
                    ) : null}
                    <ChevronDown
                      className={`h-4 w-4 text-[#748096] transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {isOpen ? (
                  <div className="border-t border-[#e9edf6] bg-white/80 px-5 py-4">
                    {isSessionLoading && !detail ? (
                      <div className="flex items-center gap-2 text-sm text-[#5f677a]">
                        <Loader2 className="h-4 w-4 animate-spin text-[#5b4cf0]" />
                        Loading session activity...
                      </div>
                    ) : null}

                    {!isSessionLoading && detail && detail.entries.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#d8deec] bg-[#fafbff] px-4 py-6 text-sm text-[#748096]">
                        No text or tool request parts were found in this session.
                      </div>
                    ) : null}

                    {detail ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f8faff] px-4 py-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
                              Activity ID
                            </p>
                            <p className="mt-1 break-all text-xs font-medium text-[#5f677a]">
                              {detail.id}
                            </p>
                          </div>
                          <p className="text-xs text-[#748096]">
                            Updated {detail.updatedAtLabel}
                          </p>
                        </div>

                        {detailEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-2xl border border-[#edf1f7] bg-white px-4 py-4"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                                  entryIconStyles[entry.source]
                                }`}
                              >
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[#111827]">
                                      {entry.title}
                                    </p>
                                    <p className="mt-1 text-xs font-medium text-[#7a8498]">
                                      {entry.authorLabel}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-[#8a94a6]">
                                    <Bell className="h-3.5 w-3.5" />
                                    {entry.timestampLabel}
                                  </div>
                                </div>

                                <div className="mt-3 text-sm leading-6 text-[#5f677a]">
                                  <p className="break-words">{entry.preview}</p>
                                  {entry.isTruncated ? (
                                    <button
                                      type="button"
                                      onClick={() => openEntryModal(entry.id)}
                                      className="mt-2 text-xs font-semibold text-[#4f49e2]"
                                    >
                                      Show more...
                                    </button>
                                  ) : null}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                      levelStyles[entry.source]
                                    }`}
                                  >
                                    {entry.source}
                                  </span>
                                  {entry.tools.length > 0 ? (
                                    <span className="text-xs text-[#8a94a6]">
                                      {entry.tools.length} tool
                                      {entry.tools.length === 1 ? "" : "s"}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b42318]">
            {error}
          </div>
        ) : null}

        {!isLoading && sessions.length === 0 && !error ? (
          <EmptyAutomationSessionsState />
        ) : null}
      </div>

      <div className="mt-auto pt-5">
        <Link
          href="/activity"
          className="block w-full rounded-xl bg-[#4f49e2] py-3 text-center text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)]"
        >
          Inspect All Logs
        </Link>
      </div>

      {activeEntry ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/45 px-4 py-6"
          onClick={closeEntryModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-[0_28px_80px_-32px_rgba(16,24,40,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#edf1f7] px-6 py-5">
              <div className="min-w-0">
                <p className="text-base font-semibold text-[#111827]">{activeEntry.title}</p>
                <p className="mt-1 text-sm text-[#7a8498]">
                  {activeEntry.authorLabel} | {activeEntry.timestampLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEntryModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e3e7f2] bg-white text-[#6b7280]"
                aria-label="Close message"
                title="Close message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="soft-scrollbar max-h-[calc(85vh-88px)] overflow-y-auto px-6 py-5 text-sm text-[#5f677a]">
              <div className="space-y-3 break-words">{renderMarkdownBlocks(activeEntry.text)}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
