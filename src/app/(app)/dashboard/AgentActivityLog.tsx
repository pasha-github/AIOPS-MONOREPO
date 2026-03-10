import { Activity, Bell, Maximize2, RefreshCw, Sparkles } from "lucide-react";

import { websocketLogs } from "./staticData";

const levelStyles = {
  INFO: "bg-[#eef2ff] text-[#4338ca]",
  WARN: "bg-[#fff1e7] text-[#f97316]",
  SUCCESS: "bg-[#e6f9ee] text-[#16a34a]",
} as const;

export default function AgentActivityLog() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e6f9ee] text-[#16a34a]">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">MuleSoft Agent</h3>
            <p className="mt-1 text-sm text-[#5b6476]">
              Static websocket logs preview.
            </p>
          </div>
        </div>
        <div className="mt-1 inline-flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e3e7f2] bg-white text-[#6b7280] shadow-[0_8px_16px_-14px_rgba(16,24,40,0.4)]"
            aria-label="Maximize logs"
            title="Maximize logs"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e3e7f2] bg-white text-[#6b7280] shadow-[0_8px_16px_-14px_rgba(16,24,40,0.4)]"
            aria-label="Refresh logs"
            title="Refresh logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="soft-scrollbar mt-6 max-h-[520px] space-y-6 overflow-y-auto pr-2">
        {websocketLogs.map((entry) => (
          <div key={entry.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="mt-2 h-full w-px bg-[#e6eaf3]" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Agent Log</p>
                  <p className="mt-1 text-sm text-[#5f677a]">{entry.message}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#8a94a6]">
                  <Bell className="h-3.5 w-3.5" />
                  {entry.time}
                </div>
              </div>
              <span
                className={`mt-3 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  levelStyles[entry.level]
                }`}
              >
                {entry.level.toLowerCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
