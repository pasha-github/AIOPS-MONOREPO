"use client";

import CreateJobs from "./CreateJobs";
import ListJobs from "./ListJobs";
import type { ApiCheckRequestPayload, JobDeleteTarget, JobRecord } from "./types";

type AgentAutomationJobsPageProps = {
  jobs?: JobRecord[];
  isJobsLoading?: boolean;
  jobsError?: string;
  agentId?: string;
  jobPrompt?: string;
  cronExpression?: string;
  intervalSeconds?: string;
  isCreatingJob?: boolean;
  jobCreateError?: string;
  onDeleteRequest?: (target: JobDeleteTarget) => void;
  onJobPromptChange?: (value: string) => void;
  onCronExpressionChange?: (value: string) => void;
  onIntervalSecondsChange?: (value: string) => void;
  onCreateJob?: (apiCheckPayload?: ApiCheckRequestPayload) => void;
  onCancel?: () => void;
};

export default function AgentAutomationJobsPage({
  jobs = [],
  isJobsLoading = false,
  jobsError = "",
  agentId = "",
  jobPrompt = "",
  cronExpression = "",
  intervalSeconds = "",
  isCreatingJob = false,
  jobCreateError = "",
  onDeleteRequest = () => undefined,
  onJobPromptChange = () => undefined,
  onCronExpressionChange = () => undefined,
  onIntervalSecondsChange = () => undefined,
  onCreateJob = () => undefined,
  onCancel = () => undefined,
}: AgentAutomationJobsPageProps) {
  return (
    <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[minmax(620px,1.35fr)_minmax(480px,0.95fr)]">
      <div className="h-full min-h-0 overflow-y-auto pr-1">
        <ListJobs
          jobs={jobs}
          isLoading={isJobsLoading}
          agentId={agentId}
          onDeleteRequest={onDeleteRequest}
        />
        {jobsError ? (
          <div className="mt-4 rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
            {jobsError}
          </div>
        ) : null}
      </div>

      <div className="h-full min-h-0 overflow-y-auto pr-1">
        <CreateJobs
          jobPrompt={jobPrompt}
          cronExpression={cronExpression}
          intervalSeconds={intervalSeconds}
          isCreatingJob={isCreatingJob}
          jobCreateError={jobCreateError}
          onJobPromptChange={onJobPromptChange}
          onCronExpressionChange={onCronExpressionChange}
          onIntervalSecondsChange={onIntervalSecondsChange}
          onCreateJob={onCreateJob}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
