"use client";

import { BriefcaseBusiness, Clock, FileText, Plus, Timer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ThemedSingleDropdown } from "../DynamicConnector";
import type {
  ApiCheckMethod,
  ApiCheckRequestPayload,
  ApiCondition,
  ConditionFieldType,
  ConditionMatchMode,
  ConditionOperator,
} from "./types";

type CreateJobsProps = {
  jobPrompt: string;
  cronExpression: string;
  intervalSeconds: string;
  isCreatingJob: boolean;
  jobCreateError: string;
  onJobPromptChange: (value: string) => void;
  onCronExpressionChange: (value: string) => void;
  onIntervalSecondsChange: (value: string) => void;
  onCreateJob: (apiCheckPayload?: ApiCheckRequestPayload) => void;
  onCancel: () => void;
};

const methodOptions: ApiCheckMethod[] = ["GET", "POST", "PUT", "PATCH"];
const conditionFieldOptions: Array<{ value: ConditionFieldType; label: string }> = [
  { value: "status_code", label: "Status Code" },
  { value: "field", label: "Field" },
  { value: "jsonpath", label: "JSONPath" },
];
const operatorOptions: Array<{ value: ConditionOperator; label: string }> = [
  { value: "eq", label: "== (eq)" },
  { value: "ne", label: "!= (ne)" },
  { value: "gt", label: "> (gt)" },
  { value: "gte", label: ">= (gte)" },
  { value: "lt", label: "< (lt)" },
  { value: "lte", label: "<= (lte)" },
  { value: "contains", label: "contains" },
];

const inputClass =
  "w-full rounded-2xl border border-[#dbe3f0] bg-[#fbfcfe] px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#4f49e2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,73,226,0.08)]";
const compactInputClass =
  "rounded-lg border border-[#dbe3f0] bg-white px-2.5 py-2 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:shadow-[0_0_0_3px_rgba(79,73,226,0.08)]";

const parseObjectText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const jsonText = trimmed.startsWith("{") ? trimmed : `{${trimmed}}`;
    const parsed = JSON.parse(jsonText) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const parseConditionValue = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const numericValue = Number(trimmed);
  return trimmed !== "" && Number.isFinite(numericValue) ? numericValue : trimmed;
};

export default function CreateJobs({
  jobPrompt,
  cronExpression,
  intervalSeconds,
  isCreatingJob,
  jobCreateError,
  onJobPromptChange,
  onCronExpressionChange,
  onIntervalSecondsChange,
  onCreateJob,
  onCancel,
}: CreateJobsProps) {
  const [apiCheckEnabled, setApiCheckEnabled] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [method, setMethod] = useState<ApiCheckMethod>("GET");
  const [headersJson, setHeadersJson] = useState('"Content-Type": "application/json"');
  const [requestBodyJson, setRequestBodyJson] = useState("");
  const [matchMode, setMatchMode] = useState<ConditionMatchMode>("ALL");
  const [conditions, setConditions] = useState<ApiCondition[]>([]);

  const showRequestBody = useMemo(
    () => method === "POST" || method === "PUT" || method === "PATCH",
    [method]
  );

  const addCondition = () => {
    setConditions((previous) => [
      ...previous,
      {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${previous.length}`,
        fieldType: "status_code",
        operator: "eq",
        fieldPath: "",
        value: "",
      },
    ]);
  };

  const updateCondition = (id: string, patch: Partial<ApiCondition>) => {
    setConditions((previous) =>
      previous.map((condition) =>
        condition.id === id ? { ...condition, ...patch } : condition
      )
    );
  };

  const removeCondition = (id: string) => {
    setConditions((previous) => previous.filter((condition) => condition.id !== id));
  };

  const buildApiCheckPayload = (): ApiCheckRequestPayload | undefined => {
    if (!apiCheckEnabled) {
      return undefined;
    }

    return {
      url: apiUrl.trim(),
      method,
      headers: parseObjectText(headersJson),
      body: showRequestBody ? parseObjectText(requestBodyJson) : {},
      conditions: conditions.map((condition) => {
        const baseCondition = {
          type: condition.fieldType,
          operator: condition.operator,
          value: parseConditionValue(condition.value),
        };

        if (condition.fieldType === "jsonpath") {
          return { ...baseCondition, path: condition.fieldPath.trim() };
        }

        if (condition.fieldType === "field") {
          return { ...baseCondition, field: condition.fieldPath.trim() };
        }

        return baseCondition;
      }),
      condition_operator: matchMode === "ALL" ? "AND" : "OR",
    };
  };

  return (
    <div className="rounded-2xl border border-[#eef1f7] bg-[#fbfcfe] p-5">
      <div className="mb-5">
        <h5 className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <BriefcaseBusiness className="h-4 w-4 text-[#475569]" />
          Create Job
        </h5>
        <p className="mt-1 text-xs text-[#64748b]">
          Submit a prompt and schedule fields to create a new job.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <FileText className="h-4 w-4 text-[#475569]" />
            Prompt
          </label>
          <p className="mb-2 text-xs text-[#64748b]">
            This prompt is stored with the job definition.
          </p>
          <textarea
            value={jobPrompt}
            onChange={(event) => onJobPromptChange(event.target.value)}
            rows={4}
            placeholder="Enter job prompt"
            className={`${inputClass} min-h-[140px]`}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <Clock className="h-4 w-4 text-[#475569]" />
              Cron expression
            </label>
            <input
              value={cronExpression}
              onChange={(event) => onCronExpressionChange(event.target.value)}
              placeholder="*/5 * * * *"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <Timer className="h-4 w-4 text-[#475569]" />
              Interval seconds
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={intervalSeconds}
              onChange={(event) => onIntervalSecondsChange(event.target.value)}
              placeholder="60"
              className={inputClass}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#e1e8f5] bg-white p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <input
              type="checkbox"
              checked={apiCheckEnabled}
              onChange={(event) => setApiCheckEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-[#cbd5e1] text-[#4f49e2] focus:ring-[#4f49e2]"
            />
            Enable API Check <span className="text-[#64748b]">(optional)</span>
          </label>
          <p className="mt-2 text-xs text-[#64748b]">
            Only trigger the agent when an API response meets your conditions.
          </p>

          {apiCheckEnabled ? (
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">URL</label>
                <input
                  value={apiUrl}
                  onChange={(event) => setApiUrl(event.target.value)}
                  placeholder="https://api.example.com/status"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Method</label>
                <ThemedSingleDropdown
                  value={method}
                  options={methodOptions.map((option) => ({ value: option, label: option }))}
                  placeholder="Select method"
                  onChange={(value) => setMethod(value as ApiCheckMethod)}
                  includePlaceholderOption={false}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">
                  Headers (JSON, optional)
                </label>
                <textarea
                  value={headersJson}
                  onChange={(event) => setHeadersJson(event.target.value)}
                  rows={3}
                  placeholder='{"Authorization":"Bearer token"}'
                  className={inputClass}
                />
              </div>

              {showRequestBody ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">
                    Request Body (JSON, optional)
                  </label>
                  <textarea
                    value={requestBodyJson}
                    onChange={(event) => setRequestBodyJson(event.target.value)}
                    rows={3}
                    placeholder='{"key":"value"}'
                    className={inputClass}
                  />
                </div>
              ) : null}

              <div className="p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-[#111827]">Conditions</span>
                  <span className="text-[#64748b]">Match</span>
                  <div className="w-[140px]">
                    <ThemedSingleDropdown
                    value={matchMode}
                    options={[
                      { value: "ALL", label: "ALL (AND)" },
                      { value: "ANY", label: "ANY (OR)" },
                    ]}
                    placeholder="Match"
                    onChange={(value) => setMatchMode(value as ConditionMatchMode)}
                    includePlaceholderOption={false}
                  />
                  </div>
                  <span className="text-[#64748b]">of the following</span>
                </div>

                <div className="mt-3 space-y-2">
                  {conditions.map((condition) => (
                    <div
                      key={condition.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <div className="min-w-[128px] flex-1">
                      <ThemedSingleDropdown
                        value={condition.fieldType}
                        options={conditionFieldOptions}
                        placeholder="Field"
                        onChange={(value) =>
                          updateCondition(condition.id, {
                            fieldType: value as ConditionFieldType,
                            fieldPath: "",
                          })
                        }
                        includePlaceholderOption={false}
                      />
                      </div>
                      {condition.fieldType !== "status_code" ? (
                        <input
                          value={condition.fieldPath}
                          onChange={(event) =>
                            updateCondition(condition.id, { fieldPath: event.target.value })
                          }
                          placeholder={condition.fieldType === "jsonpath" ? "$.token_type" : "token_type"}
                          className={`${compactInputClass} min-w-[150px] flex-1`}
                        />
                      ) : null}
                      <div className="min-w-[118px] flex-1">
                      <ThemedSingleDropdown
                        value={condition.operator}
                        options={operatorOptions}
                        placeholder="Operator"
                        onChange={(value) =>
                          updateCondition(condition.id, {
                            operator: value as ConditionOperator,
                          })
                        }
                        includePlaceholderOption={false}
                      />
                      </div>
                      <input
                        value={condition.value}
                        onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                        placeholder="value"
                        className={`${compactInputClass} min-w-[150px] flex-[1.25]`}
                      />
                      <button
                        type="button"
                        onClick={() => removeCondition(condition.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                        aria-label="Remove condition"
                        title="Remove condition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addCondition}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.8)] transition hover:bg-[#4338ca]"
                >
                  <Plus className="h-4 w-4" />
                  Add Condition
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {jobCreateError ? <p className="text-sm text-[#dc2626]">{jobCreateError}</p> : null}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] transition hover:bg-[#f8fafc]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreateJob(buildApiCheckPayload())}
            disabled={isCreatingJob}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.8)] transition ${
              isCreatingJob ? "cursor-not-allowed bg-[#a5b4fc]" : "bg-[#4f49e2] hover:bg-[#4338ca]"
            }`}
          >
            {isCreatingJob ? "Creating..." : "Create Job"}
          </button>
        </div>
      </div>
    </div>
  );
}
