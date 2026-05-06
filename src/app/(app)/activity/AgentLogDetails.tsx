"use client";

import { ArrowRight, Check } from "lucide-react";
import { renderMarkdownBlocks, type AgentLogEntry, type AgentSessionDetail } from "../dashboard/logs";

const levelStyles = {
  text: "bg-[#eef2ff] text-[#4338ca]",
  request: "bg-[#fff7ed] text-[#ea580c]",
} as const;

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
    <>
      <div className="hidden self-start justify-center pt-40 xl:flex">
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
        ) : !selectedEntry ? (
          <div className="rounded-xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-8 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
            <p className="text-sm text-[#687285]">
              Select an activity event from the left to inspect its full content.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
            <div className="border-b border-[#edf1f7] px-7 py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8498]">
                {selectedEntry.authorLabel}
              </p>
              <h3 className="mt-2 text-3xl font-semibold tracking-tight text-[#111827]">
                {selectedEntry.title}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#687285]">
                <span>{selectedEntry.timestampLabel}</span>
                <span className="text-[#c8cfdb]">/</span>
                <div>{renderMarkdownBlocks(selectedSessionSummary ?? "")}</div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    levelStyles[selectedEntry.source]
                  }`}
                >
                  {selectedEntry.source}
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
    </>
  );
}
