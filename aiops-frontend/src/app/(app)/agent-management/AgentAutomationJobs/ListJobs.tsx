"use client";

import { Plus, Trash2 } from "lucide-react";
import type { JobRecord } from "./types";

type ListJobsProps = {
  jobs: JobRecord[];
  isLoading: boolean;
  agentId: string;
  onDeleteRequest: (target: { agentId: string; jobId: string }) => void;
};

export default function ListJobs({
  jobs,
  isLoading,
  agentId,
  onDeleteRequest,
}: ListJobsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-sm font-semibold text-[#111827]">Jobs</h5>
          <p className="text-xs text-[#64748b]">Create and review jobs for this agent.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#eef1f7]">
        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_0.6fr] bg-[#eaf0f8] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0f172a]">
          <span>Prompt</span>
          <span>Cron expression</span>
          <span>Intervals</span>
          <span className="text-right">Action</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-[#eef1f7] bg-white">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`job-skeleton-${index}`}
                className="grid animate-pulse grid-cols-[1.5fr_1.5fr_1fr_0.6fr] px-4 py-4"
              >
                {Array.from({ length: 3 }).map((__, cellIndex) => (
                  <span
                    key={`job-skeleton-cell-${index}-${cellIndex}`}
                    className="mr-4 h-4 rounded bg-[#edf2f9]"
                  />
                ))}
                <span className="ml-auto h-8 w-8 rounded-xl bg-[#edf2f9]" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 bg-white px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
              <Plus className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-[#111827]">No jobs found</p>
            <p className="max-w-sm text-sm text-[#6b7280]">
              Create the first job to schedule work for this agent.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#eef1f7] bg-white">
            {jobs.map((job) => (
              <div
                key={job.job_id}
                className="grid grid-cols-[1.5fr_1.5fr_1fr_0.6fr] px-4 py-4 text-sm text-[#2b3341]"
              >
                <div className="break-words whitespace-normal leading-snug text-[#334155]">
                  {job.prompt}
                </div>
                <div className="break-words whitespace-normal leading-snug text-[#334155]">
                  {job.cron_expression || "-"}
                </div>
                <div className="break-words whitespace-normal leading-snug text-[#334155]">
                  {job.interval_seconds}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onDeleteRequest({ agentId, jobId: job.job_id })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#f3c7c7] text-[#ef4444] transition hover:bg-[#fff1f2] hover:shadow-[0_10px_18px_-14px_rgba(239,68,68,0.45)]"
                    aria-label={`Delete job ${job.job_id}`}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
