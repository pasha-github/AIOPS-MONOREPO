"use client";

import {
  Activity,
  Bell,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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
  fetchAgentSessionDetail,
  fetchAgentSessions,
  renderMarkdownBlocks,
} from "./logs";

const levelStyles = {
  text: "bg-[#eef2ff] text-[#4338ca]",
  request: "bg-[#fff7ed] text-[#ea580c]",
} as const;

const REVEAL_INTERVAL_MS = 140;

export default function AgentActivityLog() {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionDetails, setSessionDetails] = useState<Record<string, AgentSessionDetail>>(
    {}
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
  const [visibleEntryCount, setVisibleEntryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sessionDetailsRef = useRef<Record<string, AgentSessionDetail>>({});
  const selectedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionDetailsRef.current = sessionDetails;
  }, [sessionDetails]);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  const loadSessionDetail = useCallback(
    async (sessionId: string, options?: { force?: boolean; signal?: AbortSignal }) => {
      if (!options?.force && sessionDetailsRef.current[sessionId]) {
        return sessionDetailsRef.current[sessionId];
      }

      setLoadingSessionId(sessionId);
      try {
        const detail = await fetchAgentSessionDetail(sessionId, options?.signal);
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
    []
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
        const nextSessions = await fetchAgentSessions(signal);
        const nextSelectedSessionId =
          (selectedSessionIdRef.current &&
          nextSessions.some((session) => session.id === selectedSessionIdRef.current)
            ? selectedSessionIdRef.current
            : nextSessions[0]?.id) ?? null;

        startTransition(() => {
          setSessions(nextSessions);
          setSelectedSessionId(nextSelectedSessionId);
          if (refresh) {
            sessionDetailsRef.current = {};
            setSessionDetails({});
            setExpandedEntryIds({});
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
          setError("Unable to load MuleSoft automation sessions right now.");
          setSessions([]);
          setSelectedSessionId(null);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadSessionDetail]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadSessions(false, controller.signal);
    return () => controller.abort();
  }, [loadSessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const selectedDetail = selectedSessionId ? sessionDetails[selectedSessionId] : null;
  const visibleEntries = useMemo(
    () => selectedDetail?.entries.slice(0, visibleEntryCount) ?? [],
    [selectedDetail, visibleEntryCount]
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
        setError("Unable to load the selected MuleSoft session log.");
      }
    },
    [loadSessionDetail, selectedSessionId]
  );

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    void loadSessions(true, controller.signal);
  }, [loadSessions]);

  const toggleExpandedEntry = useCallback((entryId: string) => {
    setExpandedEntryIds((current) => ({
      ...current,
      [entryId]: !current[entryId],
    }));
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e6f9ee] text-[#16a34a]">
            <Activity className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-semibold leading-none text-[#111827]">
            Automation Agent
          </h3>
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

      <div className="mt-6 max-h-[172px] space-y-3 overflow-y-auto pr-2">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[#edf1f7] bg-[#fafbff] px-4 py-3 text-sm text-[#5f677a]">
            <Loader2 className="h-4 w-4 animate-spin text-[#5b4cf0]" />
            Loading latest MuleSoft sessions...
          </div>
        ) : null}

        {!isLoading && sessions.length > 0 ? (
          sessions.map((session) => {
            const isOpen = session.id === selectedSessionId;
            const isSessionLoading = loadingSessionId === session.id;

            return (
              <div
                key={session.id}
                className={`overflow-hidden rounded-2xl border transition-colors ${
                  isOpen
                    ? "border-[#cfd7ff] bg-[#f9faff]"
                    : "border-[#edf1f7] bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleSessionClick(session.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
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
              </div>
            );
          })
        ) : null}
      </div>

      <div className="soft-scrollbar mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
        {error ? (
          <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b42318]">
            {error}
          </div>
        ) : null}

        {!isLoading && sessions.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-[#d8deec] bg-[#fafbff] px-4 py-8 text-center text-sm text-[#748096]">
            No automation sessions are available right now.
          </div>
        ) : null}

        {selectedSession && selectedDetail ? (
          <div className="rounded-2xl border border-[#edf1f7] bg-[#fcfdff] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#edf1f7] pb-4">
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  {selectedSession.summary}
                </p>
                <p className="mt-1 text-xs text-[#748096]">
                  Updated {selectedDetail.updatedAtLabel}
                </p>
              </div>
              <p className="text-xs text-[#8a94a6]">
                Session ID: <span className="font-medium text-[#5f677a]">{selectedDetail.id}</span>
              </p>
            </div>

            <div className="mt-5 space-y-6">
              {selectedDetail.entries.length === 0 && loadingSessionId !== selectedSession.id ? (
                <div className="rounded-2xl border border-dashed border-[#d8deec] bg-white px-4 py-6 text-sm text-[#748096]">
                  No text or tool request parts were found in this session.
                </div>
              ) : null}

              {visibleEntries.map((entry, index) => {
                const isExpanded = Boolean(expandedEntryIds[entry.id]);
                return (
                  <div
                    key={entry.id}
                    className="animate-[fadeIn_220ms_ease-out] flex gap-4"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="mt-2 h-full w-px bg-[#e6eaf3]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#111827]">{entry.title}</p>
                          <p className="mt-1 text-xs font-medium text-[#7a8498]">
                            {entry.authorLabel}
                          </p>
                          <div className="mt-2 text-sm text-[#5f677a]">
                            {isExpanded ? (
                              <div className="space-y-3 break-words">
                                {renderMarkdownBlocks(entry.text)}
                              </div>
                            ) : (
                              <p className="break-words">{entry.preview}</p>
                            )}
                          </div>
                          {entry.isTruncated ? (
                            <button
                              type="button"
                              onClick={() => toggleExpandedEntry(entry.id)}
                              className="mt-2 text-xs font-semibold text-[#4f49e2]"
                            >
                              {isExpanded ? "Show less" : "Expand"}
                            </button>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#8a94a6]">
                          <Bell className="h-3.5 w-3.5" />
                          {entry.timestampLabel}
                        </div>
                      </div>
                      <span
                        className={`mt-3 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          levelStyles[entry.source]
                        }`}
                      >
                        {entry.source}
                      </span>
                    </div>
                  </div>
                );
              })}

              {loadingSessionId === selectedSession.id ? (
                <div className="flex items-center gap-2 rounded-2xl border border-[#edf1f7] bg-white px-4 py-3 text-sm text-[#5f677a]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#5b4cf0]" />
                  Writing latest session events...
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
