"use client";

import { Bot, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { type AgentLogEntry, type AgentSessionSummary } from "../dashboard/logs";
import type { SessionTokenUsage } from "./observability";

const entryIconStyles = {
  text: "bg-[#ecebff] text-[#5b4cf0]",
  request: "bg-[#fff1e8] text-[#ea580c]",
} as const;

const ROWS_PER_PAGE = 6;

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

function TimelineSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
      <div className="grid grid-cols-[1.2fr_1fr_2.8fr_1fr_1fr] gap-4 border-b border-[#edf1f7] px-6 py-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={`table-head-skeleton-${index}`}
            className="h-3 rounded-full bg-[#e8edf7]"
          />
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

function EmptySessionsState() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] px-6 py-10 text-center shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <Bot className="h-56 w-56 text-[#4f49e2]/[0.06]" strokeWidth={1.2} />
      </div>
      <div className="relative z-10 mx-auto max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[#eef2ff] text-[#4f49e2] shadow-[0_18px_35px_-24px_rgba(79,73,226,0.7)]">
          <Bot className="h-8 w-8" />
        </div>
        <h3 className="mt-6 text-3xl font-semibold tracking-tight text-[#111827]">
          No Sessions Available
        </h3>
        <p className="mt-4 text-base leading-7 text-[#5f677a]">
          Activity sessions will appear here after an agent runs, responds, or
          records tool usage.
        </p>
      </div>
    </div>
  );
}

type UserActivityTableProps = {
  isLoading: boolean;
  loadingSessionId: string | null;
  selectedSessionId: string | null;
  selectedSession: AgentSessionSummary | null;
  isRefreshing: boolean;
  entries: AgentLogEntry[];
  selectedEntryId: string | null;
  sessionTokenUsage: SessionTokenUsage | null;
  isSessionTokenUsageLoading: boolean;
  onRefresh: () => void;
  onSelectEntry: (entryId: string) => void;
};

export default function UserActivityTable({
  isLoading,
  loadingSessionId,
  selectedSessionId,
  selectedSession,
  isRefreshing,
  entries,
  selectedEntryId,
  sessionTokenUsage,
  isSessionTokenUsageLoading,
  onRefresh,
  onSelectEntry,
}: UserActivityTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);

  const totalPages = Math.max(1, Math.ceil(entries.length / ROWS_PER_PAGE));
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedEntries = useMemo(() => {
    const startIndex = (visiblePage - 1) * ROWS_PER_PAGE;
    return entries.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [entries, visiblePage]);

  return (
    <div className="flex h-full min-w-0 flex-col xl:h-[760px]">
      <div className="mb-6">
        <div className="mb-5 flex items-center gap-4">
          <span className="h-px w-full bg-[#dde4f1]" />
        </div>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-4 xl:min-h-[112px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7a8498]">
                Activity Table
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[#111827]">
                User activity
              </h2>
            </div>

            <div className="flex items-center justify-end gap-3">
              {loadingSessionId && selectedSessionId === loadingSessionId ? (
                <div className="inline-flex items-center gap-2 text-sm font-medium text-[#5f677a]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#5b4cf0]" />
                  Syncing logs
                </div>
              ) : null}
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#dbe4f5] bg-white text-[#4f49e2] shadow-[0_14px_30px_-22px_rgba(16,24,40,0.45)] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Refresh activity"
                title="Refresh activity"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <p className="text-sm text-[#5f677a]">
            {isSessionTokenUsageLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#5b4cf0]" />
                Loading token usage
              </span>
            ) : (
              <>
                Input Tokens -{" "}
                <span className="font-semibold text-[#111827]">
                  {sessionTokenUsage
                    ? numberFormatter.format(sessionTokenUsage.input_tokens)
                    : "-"}
                </span>
                , Output Tokens -{" "}
                <span className="font-semibold text-[#111827]">
                  {sessionTokenUsage
                    ? numberFormatter.format(sessionTokenUsage.output_tokens)
                    : "-"}
                </span>
                , Total Tokens -{" "}
                <span className="font-semibold text-[#111827]">
                  {sessionTokenUsage
                    ? numberFormatter.format(sessionTokenUsage.total_tokens)
                    : "-"}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1">
          <TimelineSkeleton />
        </div>
      ) : selectedSessionId && loadingSessionId === selectedSessionId && entries.length === 0 ? (
        <div className="flex-1">
          <TimelineSkeleton />
        </div>
      ) : !selectedSession ? (
        <EmptySessionsState />
      ) : entries.length === 0 ? (
        <div className="flex flex-1 items-center rounded-xl bg-white px-6 py-10 text-sm text-[#687285] shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
          No text or tool request parts were found in this activity.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
          <div className="min-h-0 flex-1 overflow-x-auto">
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
                {paginatedEntries.map((entry) => {
                  const isSelected = entry.id === selectedEntryId;
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => onSelectEntry(entry.id)}
                      className={`group cursor-pointer border-b border-[#edf1f7] transition ${
                        isSelected ? "bg-[#e9efff]" : "bg-white hover:bg-[#f5f8ff]"
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
          <div className="flex items-center justify-between border-t border-[#edf1f7] px-5 py-3">
            <p className="text-sm text-[#687285]">
              Showing {(visiblePage - 1) * ROWS_PER_PAGE + 1}-
              {Math.min(visiblePage * ROWS_PER_PAGE, entries.length)} of {entries.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={visiblePage === 1}
                className="rounded-full border border-[#dbe4f5] px-3 py-1.5 text-sm font-medium text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="min-w-[72px] text-center text-sm font-medium text-[#44506a]">
                Page {visiblePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={visiblePage === totalPages}
                className="rounded-full border border-[#dbe4f5] px-3 py-1.5 text-sm font-medium text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
