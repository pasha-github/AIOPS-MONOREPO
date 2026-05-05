"use client";

import { type AgentLogEntry, type AgentSessionSummary } from "../dashboard/logs";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

const entryIconStyles = {
  text: "bg-[#ecebff] text-[#5b4cf0]",
  request: "bg-[#fff1e8] text-[#ea580c]",
} as const;

const ROWS_PER_PAGE = 5;

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

type UserActivityTableProps = {
  isLoading: boolean;
  loadingSessionId: string | null;
  selectedSessionId: string | null;
  selectedSession: AgentSessionSummary | null;
  entries: AgentLogEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entryId: string) => void;
};

export default function UserActivityTable({
  isLoading,
  loadingSessionId,
  selectedSessionId,
  selectedSession,
  entries,
  selectedEntryId,
  onSelectEntry,
}: UserActivityTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(entries.length / ROWS_PER_PAGE));
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedEntries = useMemo(() => {
    const startIndex = (visiblePage - 1) * ROWS_PER_PAGE;
    return entries.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [entries, visiblePage]);

  return (
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
      ) : selectedSessionId && loadingSessionId === selectedSessionId && entries.length === 0 ? (
        <TimelineSkeleton />
      ) : !selectedSession ? (
        <div className="py-10 text-sm text-[#687285]">No sessions available.</div>
      ) : entries.length === 0 ? (
        <div className="py-10 text-sm text-[#687285]">
          No text or tool request parts were found in this activity.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
          <div className="overflow-x-auto">
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
