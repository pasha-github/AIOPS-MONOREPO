import { TriangleAlert } from "lucide-react";

import { incidentRecords } from "./staticData";

const openCount = incidentRecords.filter((item) => item.status === "Open").length;
const closedCount = incidentRecords.filter(
  (item) => item.status === "Closed"
).length;

export default function IncidentDetails() {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ffe9e1] text-[#ff7a45]">
              <TriangleAlert className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-semibold text-[#111827]">Incident details</h3>
            <span className="rounded-md border border-[#cbd2ff] px-2 py-0.5 text-xs font-semibold text-[#5b4cf0]">
              {incidentRecords.length}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#5b6476]">
            Last refreshed: March 10, 2026 11:42 AM
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e0e5f0] bg-white px-3 py-1 text-xs font-semibold text-[#4f49e2]">
          <span>Open: {openCount}</span>
          <span className="text-[#9ca3af]">|</span>
          <span>Closed: {closedCount}</span>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#eef1f7]">
        <div className="grid grid-cols-[1.1fr_3fr_0.8fr_1.2fr_0.8fr_0.8fr] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold text-[#111827]">
          <span>Incident ID</span>
          <span>Description</span>
          <span>State</span>
          <span>Opened At</span>
          <span>Priority</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-[#eef1f7] bg-white">
          {incidentRecords.map((row) => (
            <div
              key={row.number}
              className="grid grid-cols-[1.1fr_3fr_0.8fr_1.2fr_0.8fr_0.8fr] items-center px-4 py-4 text-sm text-[#2b3341]"
            >
              <span className="font-semibold text-[#1c2330]">{row.number}</span>
              <span>{row.shortDescription}</span>
              <span>{row.state}</span>
              <span>{row.openedAt}</span>
              <span>{row.priority}</span>
              <span
                className={
                  row.status === "Open" ? "text-[#16a34a]" : "text-[#ef4444]"
                }
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
