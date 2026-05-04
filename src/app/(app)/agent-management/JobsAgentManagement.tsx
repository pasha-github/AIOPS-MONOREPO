"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AgentRecord = {
  agent_id: string | null;
  name: string;
};

type JobRecord = {
  job_id: string;
  agent_id: string;
  prompt: string;
  cron_expression: string;
  interval_seconds: number;
};

type JobDeleteTarget = {
  agentId: string;
  jobId: string;
};

type JobsAgentManagementProps = {
  agent: AgentRecord;
  onClose: () => void;
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return String((payload as { message: string }).message);
  }
  return fallback;
};

export default function JobsAgentManagement({
  agent,
  onClose,
}: JobsAgentManagementProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const agentManagerBaseUrl = trimTrailingSlash(llmManagerApiBaseUrl);
  const [jobPrompt, setJobPrompt] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState("");
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [jobCreateError, setJobCreateError] = useState("");
  const [jobDeleteTarget, setJobDeleteTarget] = useState<JobDeleteTarget | null>(
    null
  );
  const [isDeletingJob, setIsDeletingJob] = useState(false);
  const [jobDeleteError, setJobDeleteError] = useState("");

  const agentId = agent.agent_id?.trim() ?? "";

  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    if (!agentId) {
      setJobsError("Agent ID is missing. Unable to load jobs.");
      return;
    }

    setIsJobsLoading(true);
    setJobsError("");

    try {
      const response = await fetch(
        `${agentManagerBaseUrl}/agent/${encodeURIComponent(agentId)}/jobs`,
        {
          headers: { accept: "application/json" },
          signal,
        }
      );
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) {
        setJobsError(getErrorMessage(data, "Unable to load jobs."));
        return;
      }

      setJobs(
        data
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null;
            }
            const record = item as Record<string, unknown>;
            const jobId = typeof record.job_id === "string" ? record.job_id.trim() : "";
            const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
            const cron =
              typeof record.cron_expression === "string" ? record.cron_expression.trim() : "";
            const interval =
              typeof record.interval_seconds === "number"
                ? record.interval_seconds
                : Number(record.interval_seconds);
            if (!jobId) {
              return null;
            }
            return {
              job_id: jobId,
              agent_id: typeof record.agent_id === "string" ? record.agent_id.trim() : "",
              prompt,
              cron_expression: cron,
              interval_seconds: Number.isFinite(interval) ? interval : 0,
            };
          })
          .filter((item): item is JobRecord => item !== null)
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setJobsError("Unable to load jobs.");
    } finally {
      setIsJobsLoading(false);
    }
  }, [agentId, agentManagerBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    void loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadJobs]);

  const handleCreateJob = async () => {
    if (isCreatingJob) {
      return;
    }

    if (!agentId) {
      setJobCreateError("Agent ID is missing. Unable to create job.");
      return;
    }

    const prompt = jobPrompt.trim();
    const cron = cronExpression.trim();
    const intervalValue = intervalSeconds.trim();
    const interval = intervalValue ? Number(intervalValue) : null;

    if (!prompt) {
      setJobCreateError("Prompt is required.");
      return;
    }
    if (!cron && interval === null) {
      setJobCreateError("Provide a cron expression, interval seconds, or both.");
      return;
    }
    if (interval !== null && (!Number.isFinite(interval) || interval < 0)) {
      setJobCreateError("Interval seconds must be a valid non-negative number.");
      return;
    }

    setIsCreatingJob(true);
    setJobCreateError("");

    try {
      const response = await fetch(
        `${agentManagerBaseUrl}/agent/${encodeURIComponent(agentId)}/jobs?agent_id=${encodeURIComponent(agentId)}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            cron_expression: cron,
            interval_seconds: interval ?? 0,
          }),
        }
      );

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setJobCreateError(getErrorMessage(data, "Unable to create job."));
        return;
      }

      setJobPrompt("");
      setCronExpression("");
      setIntervalSeconds("");
      await loadJobs();
    } catch {
      setJobCreateError("Unable to create job.");
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobDeleteTarget || isDeletingJob) {
      return;
    }

    setIsDeletingJob(true);
    setJobDeleteError("");

    try {
      const deleteUrls = [
        `${agentManagerBaseUrl}/agent/${encodeURIComponent(jobDeleteTarget.agentId)}/jobs/${encodeURIComponent(jobDeleteTarget.jobId)}`,
        `${agentManagerBaseUrl}/agent/${encodeURIComponent(jobDeleteTarget.agentId)}/job/${encodeURIComponent(jobDeleteTarget.jobId)}`,
      ];

      let success = false;
      let lastErrorPayload: unknown = null;

      for (const url of deleteUrls) {
        const response = await fetch(url, {
          method: "DELETE",
          headers: { accept: "application/json" },
        });

        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (response.ok) {
          success = true;
          break;
        }

        lastErrorPayload = data;
      }

      if (!success) {
        setJobDeleteError(getErrorMessage(lastErrorPayload, "Unable to delete job."));
        return;
      }

      setJobDeleteTarget(null);
      setJobs((previous) => previous.filter((item) => item.job_id !== jobDeleteTarget.jobId));
    } catch {
      setJobDeleteError("Unable to delete job.");
    } finally {
      setIsDeletingJob(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-8 backdrop-blur-md">
        <div className="w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.65)]">
          <div className="flex items-start justify-between border-b border-[#eef1f7] px-6 py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-semibold text-[#111827]">Jobs</h4>
                <span className="rounded-full border border-[#dbe3f0] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                  Agent tools
                </span>
              </div>
              <p className="text-sm text-[#6b7280]">{agent.name}</p>
              
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#475569] transition hover:bg-[#f8fafc]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-semibold text-[#111827]">Jobs</h5>
                    <p className="text-xs text-[#64748b]">Create and review jobs for this agent.</p>
                  </div>
                  <span className="rounded-xl border border-[#e5e7eb] px-3 py-2 text-xs font-semibold text-[#374151]">
                    List Jobs
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#eef1f7]">
                  <div className="grid grid-cols-[1.5fr_1.5fr_1fr_0.6fr] bg-[#eaf0f8] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0f172a]">
                    <span>Prompt</span>
                    <span>Cron expression</span>
                    <span>Intervals</span>
                    <span className="text-right">Action</span>
                  </div>
                  {isJobsLoading ? (
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
                      <p className="text-sm font-semibold text-[#111827]">
                        No jobs found
                      </p>
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
                              onClick={() =>
                                setJobDeleteTarget({ agentId, jobId: job.job_id })
                              }
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

              <div className="rounded-2xl border border-[#eef1f7] bg-[#fbfcfe] p-5">
                <div className="mb-5">
                  <h5 className="text-sm font-semibold text-[#111827]">Create Job</h5>
                  <p className="mt-1 text-xs text-[#64748b]">
                    Submit a prompt and schedule fields to create a new job.
                  </p>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#111827]">
                      Prompt
                    </label>
                    <p className="mb-2 text-xs text-[#64748b]">
                      This prompt is stored with the job definition.
                    </p>
                    <textarea
                      value={jobPrompt}
                      onChange={(event) => setJobPrompt(event.target.value)}
                      rows={4}
                      placeholder="Enter job prompt"
                      className="min-h-[140px] w-full rounded-2xl border border-[#dbe3f0] bg-[#fbfcfe] px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#4f49e2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,73,226,0.08)]"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#111827]">
                        Cron expression
                      </label>
                      <input
                        value={cronExpression}
                        onChange={(event) => setCronExpression(event.target.value)}
                        placeholder="*/5 * * * *"
                        className="w-full rounded-2xl border border-[#dbe3f0] bg-[#fbfcfe] px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#4f49e2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,73,226,0.08)]"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#111827]">
                        Interval seconds
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={intervalSeconds}
                        onChange={(event) => setIntervalSeconds(event.target.value)}
                        placeholder="60"
                        className="w-full rounded-2xl border border-[#dbe3f0] bg-[#fbfcfe] px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#4f49e2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,73,226,0.08)]"
                      />
                    </div>
                  </div>

                  {jobCreateError ? (
                    <p className="text-sm text-[#dc2626]">{jobCreateError}</p>
                  ) : null}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] transition hover:bg-[#f8fafc]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateJob}
                      disabled={isCreatingJob}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.8)] transition ${
                        isCreatingJob
                          ? "cursor-not-allowed bg-[#a5b4fc]"
                          : "bg-[#4f49e2] hover:bg-[#4338ca]"
                      }`}
                    >
                    
                      {isCreatingJob ? "Creating..." : "Create Job"}
                    </button>
                  </div>
                </div>
              </div>
              {jobsError ? (
                <div className="mt-4 rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
                  {jobsError}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {jobDeleteTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 px-4 py-8 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#fee2e2] bg-[#fff5f5] px-6 py-4">
              <div className="flex items-center gap-2 text-[#b91c1c]">
                <Trash2 className="h-5 w-5" />
                <h4 className="text-lg font-semibold">Delete Job</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setJobDeleteTarget(null);
                  setJobDeleteError("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b91c1c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#374151]">
                Are you sure you want to delete this job?
              </p>
              <p className="mt-3 text-sm text-[#374151]">
                <span className="font-semibold text-[#0f172a]">Job ID:</span>{" "}
                <span className="rounded-md bg-[#fee2e2] px-2 py-0.5 font-semibold text-[#b91c1c]">
                  {jobDeleteTarget.jobId}
                </span>
              </p>
              <p className="mt-3 text-xs text-[#9b1c1c]">
                This action can&apos;t be undone.
              </p>
              {jobDeleteError ? (
                <p className="mt-3 text-sm text-[#dc2626]">{jobDeleteError}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setJobDeleteTarget(null);
                  setJobDeleteError("");
                }}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] transition hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteJob}
                disabled={isDeletingJob}
                className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] transition ${
                  isDeletingJob
                    ? "cursor-not-allowed bg-[#fca5a5]"
                    : "bg-[#ef4444] hover:bg-[#dc2626]"
                }`}
              >
                {isDeletingJob ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
