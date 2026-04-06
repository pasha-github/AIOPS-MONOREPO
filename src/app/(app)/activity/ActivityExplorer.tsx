"use client";

import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type AgentSessionDetail,
  type AgentSessionSummary,
  fetchAgentSessionDetail,
  fetchAgentSessions,
  renderMarkdownBlocks,
} from "../dashboard/logs";

const levelStyles = {
  text: "bg-[#eef2ff] text-[#4338ca]",
  request: "bg-[#fff7ed] text-[#ea580c]",
} as const;

const entryIconStyles = {
  text: "bg-[#ecebff] text-[#5b4cf0]",
  request: "bg-[#fff1e8] text-[#ea580c]",
} as const;

const formatEntryDate = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp * 1000));
};

const formatEntryTime = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp * 1000));
};

function SessionDropdownSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-[linear-gradient(135deg,#ffffff_0%,#f7f9ff_100%)] p-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <span className="block h-3 w-24 rounded-full bg-[#e8edf7]" />
          <span className="block h-6 w-72 rounded-full bg-[#e8edf7]" />
          <span className="block h-4 w-40 rounded-full bg-[#e8edf7]" />
        </div>
        <span className="h-12 w-12 rounded-full bg-[#e8edf7]" />
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
      <div className="grid grid-cols-[1.2fr_1fr_2.8fr_1fr_1fr] gap-4 border-b border-[#edf1f7] px-6 py-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={`table-head-skeleton-${index}`} className="h-3 rounded-full bg-[#e8edf7]" />
        ))}
      </div>
      <div className="divide-y divide-[#f0f3f8]">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`timeline-skeleton-${index}`}
            className="grid animate-pulse grid-cols-[1.2fr_1fr_2.8fr_1fr_1fr] gap-4 px-6 py-5"
          >
            <span className="h-5 w-28 rounded-full bg-[#e8edf7]" />
            <span className="h-5 w-24 rounded-full bg-[#e8edf7]" />
            <span className="h-5 w-full rounded-full bg-[#e8edf7]" />
            <span className="h-5 w-24 rounded-full bg-[#e8edf7]" />
            <span className="h-5 w-24 rounded-full bg-[#e8edf7]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-8 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
      <div className="space-y-3 border-b border-[#edf1f7] pb-5">
        <span className="block h-3 w-20 rounded-full bg-[#e8edf7]" />
        <span className="block h-7 w-56 rounded-full bg-[#e8edf7]" />
        <span className="block h-4 w-44 rounded-full bg-[#e8edf7]" />
      </div>
      <div className="mt-6 space-y-3">
        <span className="block h-4 w-full rounded-full bg-[#e8edf7]" />
        <span className="block h-4 w-11/12 rounded-full bg-[#e8edf7]" />
        <span className="block h-4 w-10/12 rounded-full bg-[#e8edf7]" />
        <span className="block h-4 w-9/12 rounded-full bg-[#e8edf7]" />
      </div>
    </div>
  );
}

export default function ActivityExplorer() {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionDetails, setSessionDetails] = useState<Record<string, AgentSessionDetail>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const sessionDetailsRef = useRef<Record<string, AgentSessionDetail>>({});
  const selectedSessionIdRef = useRef<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sessionDetailsRef.current = sessionDetails;
  }, [sessionDetails]);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    if (!isSessionMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuContainerRef.current?.contains(event.target as Node)) {
        setIsSessionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isSessionMenuOpen]);

  const loadSessionDetail = useCallback(
    async (sessionId: string, options?: { force?: boolean; signal?: AbortSignal }) => {
      if (!options?.force && sessionDetailsRef.current[sessionId]) {
        return sessionDetailsRef.current[sessionId];
      }

      setLoadingSessionId(sessionId);
      try {
        const detail = await fetchAgentSessionDetail(sessionId, options?.signal);
        setSessionDetails((current) => {
          const next = { ...current, [sessionId]: detail };
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
          }
        });

        if (nextSelectedSessionId) {
          const detail = await loadSessionDetail(nextSelectedSessionId, {
            force: refresh,
            signal,
          });
          startTransition(() => {
            setSelectedEntryId(detail?.entries[0]?.id ?? null);
          });
        } else {
          setSelectedEntryId(null);
        }
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load automation activity right now.");
          setSessions([]);
          setSelectedSessionId(null);
          setSelectedEntryId(null);
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

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    void loadSessions(true, controller.signal);
  }, [loadSessions]);

  const handleSessionChange = useCallback(
    async (sessionId: string) => {
      setSelectedSessionId(sessionId);
      setSelectedEntryId(null);
      setIsSessionMenuOpen(false);
      try {
        const detail = await loadSessionDetail(sessionId);
        setSelectedEntryId(detail?.entries[0]?.id ?? null);
      } catch {
        setError("Unable to load the selected automation activity.");
      }
    },
    [loadSessionDetail]
  );

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const selectedDetail = selectedSessionId ? sessionDetails[selectedSessionId] : null;

  const selectedEntry = useMemo(
    () => selectedDetail?.entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [selectedDetail, selectedEntryId]
  );

  useEffect(() => {
    if (!selectedDetail) {
      return;
    }

    if (selectedDetail.entries.length === 0) {
      setSelectedEntryId(null);
      return;
    }

    if (!selectedDetail.entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(selectedDetail.entries[0]?.id ?? null);
    }
  }, [selectedDetail, selectedEntryId]);

  const detailMeta = selectedEntry ?? null;
  const timelineEntries = selectedDetail?.entries ?? [];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-xl bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f7f8fd_48%,#eef3ff_100%)] px-8 py-8 shadow-[0_32px_80px_-52px_rgba(15,23,42,0.5)]">
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6476]">
                <Activity className="h-3.5 w-3.5 text-[#4f49e2]" />
                User Activity
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#10131a]">
                Activity Explorer
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f677a]">
                Review session history for the default automation app and inspect individual
                events without leaving the activity stream.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_14px_30px_-22px_rgba(16,24,40,0.45)] backdrop-blur"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh Activity
            </button>
          </div>

          {isLoading ? (
            <SessionDropdownSkeleton />
          ) : (
            <div
              ref={menuContainerRef}
              className="relative overflow-visible rounded-xl bg-[linear-gradient(135deg,#ffffff_0%,#f7f9ff_100%)] p-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8498]">
                    Session
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSessionMenuOpen((current) => !current)}
                    className="mt-3 flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-2xl font-semibold text-[#111827]">
                        {selectedSession?.summary ?? "Select a session"}
                      </p>
                      <p className="mt-2 text-sm text-[#687285]">
                        {selectedSession
                          ? `Last updated ${selectedSession.updatedAtLabel}`
                          : "No sessions available"}
                      </p>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]">
                      <ChevronDown
                        className={`h-5 w-5 transition-transform ${
                          isSessionMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-full bg-[#f8faff] px-4 py-3 text-sm text-[#5f677a]">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f0ff] text-[#3662ff]">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-[#111827]">{sessions.length}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#7a8498]">
                      Sessions
                    </p>
                  </div>
                </div>
              </div>

              {isSessionMenuOpen && sessions.length > 0 ? (
                <div className="absolute left-6 right-6 top-[calc(100%-8px)] z-20 rounded-xl bg-white/96 p-3 shadow-[0_28px_60px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
                  <div className="max-h-[320px] overflow-y-auto pr-1">
                    {sessions.map((session) => {
                      const isActive = session.id === selectedSessionId;
                      return (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => void handleSessionChange(session.id)}
                          className={`flex w-full items-center justify-between gap-4 rounded-lg px-4 py-3 text-left transition ${
                            isActive
                              ? "bg-[#eef2ff] text-[#24324a]"
                              : "text-[#5f677a] hover:bg-[#f8faff]"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#111827]">
                              {session.summary}
                            </p>
                            <p className="mt-1 text-xs text-[#7a8498]">
                              Last updated {session.updatedAtLabel}
                            </p>
                          </div>
                          {isActive ? <Check className="h-4 w-4 shrink-0 text-[#4f49e2]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-6 py-4 text-sm text-[#b42318]">
          {error}
        </div>
      ) : null}

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_64px_minmax(380px,0.84fr)]">
        <div className="min-w-0">
          <div className="mb-6">
            <div className="mb-5 flex items-center gap-4">
              <span className="h-px w-full bg-[#dde4f1]" />
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8498]">
                  Activity Table
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#111827]">
                  User activity
                </h2>
              </div>
              {loadingSessionId && selectedSessionId === loadingSessionId ? (
                <div className="inline-flex items-center gap-2 text-sm font-medium text-[#5f677a]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#5b4cf0]" />
                  Syncing logs
                </div>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <TimelineSkeleton />
          ) : !selectedSession ? (
            <div className="py-10 text-sm text-[#687285]">No sessions available.</div>
          ) : timelineEntries.length === 0 ? (
            <div className="py-10 text-sm text-[#687285]">
              No text or tool request parts were found in this activity.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
              <div className="max-h-[68vh] overflow-auto">
                <table className="min-w-full border-collapse table-fixed">
                  <colgroup>
                    <col className="w-[24%]" />
                    <col className="w-[20%]" />
                    <col className="w-[28%]" />
                    <col className="w-[16%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#edf1f7] bg-[#fbfcff]">
                      <th className="sticky top-0 z-10 bg-[#fbfcff] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                        Type
                      </th>
                      <th className="sticky top-0 z-10 bg-[#fbfcff] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                        Action
                      </th>
                      <th className="sticky top-0 z-10 bg-[#fbfcff] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                        Details
                      </th>
                      <th className="sticky top-0 z-10 bg-[#fbfcff] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                        Date
                      </th>
                      <th className="sticky top-0 z-10 bg-[#fbfcff] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineEntries.map((entry) => {
                      const isSelected = entry.id === selectedEntryId;
                      return (
                        <tr
                          key={entry.id}
                          onClick={() => setSelectedEntryId(entry.id)}
                          className={`group cursor-pointer border-b border-[#edf1f7] transition ${
                            isSelected
                              ? "bg-[#e9efff]"
                              : "bg-white hover:bg-[#f5f8ff]"
                          }`}
                        >
                          <td
                            className={`align-middle ${
                              isSelected
                                ? "border-l-4 border-[#4f49e2] pl-4 pr-5 py-4"
                                : "border-l-4 border-transparent px-5 py-4 group-hover:border-[#c7d2fe]"
                            }`}
                          >
                            <span
                              className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                entryIconStyles[entry.source]
                              }`}
                            >
                              {entry.authorLabel}
                            </span>
                          </td>
                          <td
                            className={`align-middle text-sm font-semibold ${
                              isSelected ? "px-5 py-4 text-[#13203a]" : "px-5 py-4 text-[#111827]"
                            }`}
                          >
                            {entry.title}
                          </td>
                          <td className="max-w-0 px-5 py-4 align-middle">
                            <p
                              className={`line-clamp-2 text-sm leading-6 ${
                                isSelected ? "text-[#44506a]" : "text-[#5f677a]"
                              }`}
                            >
                              {entry.preview}
                            </p>
                          </td>
                          <td
                            className={`whitespace-nowrap px-5 py-4 align-middle text-sm ${
                              isSelected ? "text-[#44506a]" : "text-[#5f677a]"
                            }`}
                          >
                            {formatEntryDate(entry.timestamp)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-5 py-4 align-middle text-sm font-medium ${
                              isSelected ? "text-[#334155]" : "text-[#5f677a]"
                            }`}
                          >
                            {formatEntryTime(entry.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="hidden xl:flex flex-col items-center pt-[6.5rem]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d9e2f3] bg-white text-[#4f49e2] shadow-[0_18px_35px_-24px_rgba(15,23,42,0.45)]">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-6">
            <div className="mb-5 flex items-center gap-4">
              <span className="h-px w-full bg-[#dde4f1]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8498]">
                Detail View
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#111827]">
                Event details
              </h2>
            </div>
          </div>

          {isLoading || (selectedSessionId && loadingSessionId === selectedSessionId && !selectedDetail) ? (
            <DetailSkeleton />
          ) : !detailMeta ? (
            <div className="rounded-xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-8 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
              <p className="text-sm text-[#687285]">
                Select an activity event from the left to inspect its full content.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
              <div className="border-b border-[#edf1f7] px-7 py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8498]">
                  {detailMeta.authorLabel}
                </p>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight text-[#111827]">
                  {detailMeta.title}
                </h3>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#687285]">
                  <span>{detailMeta.timestampLabel}</span>
                  <span className="text-[#c8cfdb]">/</span>
                  <span>{selectedSession?.summary}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-[#f8faff] px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      levelStyles[detailMeta.source]
                    }`}
                  >
                    {detailMeta.source}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#a0abc0]">
                    Activity ID
                  </span>
                  <span className="min-w-0 break-all text-sm font-medium text-[#6b7280]">
                    {selectedDetail?.id}
                  </span>
                </div>
              </div>

              <div className="soft-scrollbar max-h-[70vh] overflow-y-auto px-7 py-6">
                <div className="space-y-4 break-words text-sm leading-7 text-[#5f677a]">
                  {renderMarkdownBlocks(detailMeta.text)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
