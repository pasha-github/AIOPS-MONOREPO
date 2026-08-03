"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Bot, BriefcaseBusiness, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AgentAutomationJobsPage from "./AgentAutomationJobs/page";
import type {
  ApiCheckRequestPayload,
  JobDeleteTarget,
  JobRecord,
} from "./AgentAutomationJobs/types";

type AgentRecord = {
  agent_id: string | null;
  name: string;
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

  const handleCreateJob = async (apiCheckPayload?: ApiCheckRequestPayload) => {
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
            ...(apiCheckPayload ?? {}),
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
        <div className="flex h-[720px] max-h-[calc(100vh-48px)] w-full max-w-[1480px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.65)]">
          <div className="flex items-start justify-between bg-[#4f49e2] px-6 py-4 text-white">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
                  <BriefcaseBusiness className="h-4 w-4" />
                </span>
                <h4 className="text-lg font-semibold">Jobs</h4>
              </div>
              <p className="flex items-center gap-2 text-sm text-white/85">
                <Bot className="h-4 w-4" />
                {agent.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
            <AgentAutomationJobsPage
              jobs={jobs}
              isJobsLoading={isJobsLoading}
              jobsError={jobsError}
              agentId={agentId}
              jobPrompt={jobPrompt}
              cronExpression={cronExpression}
              intervalSeconds={intervalSeconds}
              isCreatingJob={isCreatingJob}
              jobCreateError={jobCreateError}
              onDeleteRequest={setJobDeleteTarget}
              onJobPromptChange={setJobPrompt}
              onCronExpressionChange={setCronExpression}
              onIntervalSecondsChange={setIntervalSeconds}
              onCreateJob={handleCreateJob}
              onCancel={onClose}
            />
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
