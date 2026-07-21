"use client";

import { Bot, Check } from "lucide-react";
import { renderMarkdownBlocks, type AgentLogEntry, type AgentSessionDetail } from "../dashboard/logs";

const formatToolPayload = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

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

type AgentLogDetailsProps = {
  isLoading: boolean;
  loadingSessionId: string | null;
  selectedSessionId: string | null;
  selectedSessionSummary: string | undefined;
  selectedDetail: AgentSessionDetail | null;
  selectedEntry: AgentLogEntry | null;
};

export default function AgentLogDetails({
  isLoading,
  loadingSessionId,
  selectedSessionId,
  selectedSessionSummary,
  selectedDetail,
  selectedEntry,
}: AgentLogDetailsProps) {
  return (
      <div className="flex h-full min-w-0 flex-col xl:h-[760px]">
        <div className="mb-6">
          <div className="mb-5 flex items-center gap-4">
            <span className="h-px w-full bg-[#dde4f1]" />
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4 xl:min-h-[112px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7a8498]">
                Detail View
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[#111827]">
                Event details
              </h2>
            </div>
            <div />
          </div>
        </div>

        {isLoading || (selectedSessionId && loadingSessionId === selectedSessionId && !selectedDetail) ? (
          <div className="flex-1">
            <DetailSkeleton />
          </div>
        ) : !selectedEntry ? (
          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-8 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden="true"
            >
              <Bot className="h-56 w-56 text-[#4f49e2]/[0.06]" strokeWidth={1.2} />
            </div>
            <div className="relative z-10 mx-auto max-w-md text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[#eef2ff] text-[#4f49e2] shadow-[0_18px_35px_-24px_rgba(79,73,226,0.7)]">
                <Bot className="h-8 w-8" />
              </div>
              <h3 className="mt-6 text-3xl font-semibold tracking-tight text-[#111827]">
                No Activity Selected
              </h3>
              <p className="mt-4 text-base leading-7 text-[#5f677a]">
                Select a user activity from the table to view the full event
                details, tool usage, and response content here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
            <div className="border-b border-[#edf1f7] px-7 py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8498]">
                {selectedEntry.authorLabel}
              </p>
              <h3 className="mt-2 text-3xl font-semibold tracking-tight text-[#111827]">
                {selectedEntry.title}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#687285]">
                <span>{selectedEntry.timestampLabel}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-3">
                
                <span className="text-[11px] uppercase tracking-[0.16em] text-[#a0abc0]">
                  Activity ID
                </span>
                <span className="min-w-0 break-all text-sm font-medium text-[#6b7280]">
                  {selectedDetail?.id}
                </span>
              </div>
            </div>

            <div className="soft-scrollbar min-h-0 flex-1 overflow-y-auto px-7 py-6">
              {selectedEntry.tools.length > 0 ? (
                <div className="mb-6  p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                    Tools used
                  </p>
                  <div className="mt-3 space-y-3">
                    {selectedEntry.tools.map((tool) => (
                      <div
                        key={tool.id}
                        className="rounded-xl border border-[#d9e2f3] bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#dcfce7] text-[#16a34a]">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-medium text-[#24324a]">{tool.label}</span>
                        </div>
                        <pre className="mt-3 overflow-x-auto px-4 py-3 text-xs leading-6 text-[#24324a]">
                          <code>{formatToolPayload(tool.payload)}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4 break-words text-sm leading-7 text-[#5f677a]">
                {renderMarkdownBlocks(selectedEntry.text)}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
