"use client";

export type JobRecord = {
  job_id: string;
  agent_id: string;
  prompt: string;
  cron_expression: string;
  interval_seconds: number;
};

export type JobDeleteTarget = {
  agentId: string;
  jobId: string;
};

export type ApiCheckMethod = "GET" | "POST" | "PUT" | "PATCH";
export type ConditionMatchMode = "ALL" | "ANY";
export type ConditionFieldType = "status_code" | "field" | "jsonpath";
export type ConditionOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains";

export type ApiCondition = {
  id: string;
  fieldType: ConditionFieldType;
  operator: ConditionOperator;
  fieldPath: string;
  value: string;
};

export type ApiCheckRequestCondition = {
  type: ConditionFieldType;
  operator: ConditionOperator;
  value: string | number | boolean;
  field?: string;
  path?: string;
};

export type ApiCheckRequestPayload = {
  url: string;
  method: ApiCheckMethod;
  headers: Record<string, unknown>;
  body: Record<string, unknown>;
  conditions: ApiCheckRequestCondition[];
  condition_operator: "AND" | "OR";
};
