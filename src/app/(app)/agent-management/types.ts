"use client";

import { LucideIcon } from "lucide-react";

export type AgentRecord = {
  agentId: number;
  name: string;
  port: number | null;
  status: string;
  type: string;
  deployment_target?: string | null;
  aws_credential_id?: string | null;
  memory_enabled?: boolean | null;
  memory_tool_type?: string | null;
  vertex_deployment_status?: string | null;
  vertex_deployment_error?: string | null;
  vertex_resource_name?: string | null;
  enterprise: string;
  start_time: string | null;
  stop_time: string | null;
  agent_id: string | null;
  description: string | null;
  instruction: string | null;
  prompt_role?: string | null;
  prompt_objectives?: string | null;
  prompt_behavior?: string | null;
  prompt_output_format?: string | null;
  prompt_constraints?: string | null;
  prompt_safety?: string | null;
  prompt_tools_instructions?: string | null;
  prompt_policy?: string | null;
  prompt_examples?: string | null;
  prompt_additional_info?: string | null;
  model_id: string | null;
  modelName: string | null;
  modelProvider: string | null;
  primary_use_global?: boolean | null;
  primary_model_id?: string | null;
  primary_model_name?: string | null;
  primary_model_provider?: string | null;
  secondary_use_global?: boolean | null;
  secondary_model_id?: string | null;
  secondary_model_name?: string | null;
  secondary_model_provider?: string | null;
  tertiary_use_global?: boolean | null;
  tertiary_model_id?: string | null;
  tertiary_model_name?: string | null;
  tertiary_model_provider?: string | null;
  created_at: string | null;
  updated_at: string | null;
  tools: string[] | string;
  skill_ids: string[];
  mcp_server_ids?: string[];
  mcp_servers: string[];
  connector_config_ids: string[];
  sub_agents: string[];
  knowledge_file_ids?: string[];
  isEnabled: boolean | null;
  guardrail_sensitive_data?: boolean | null;
  guardrails_config?: {
    pii_patterns?: string[] | null;
    sensitive_patterns?: string[] | null;
    harmful_keywords?: string[] | null;
  } | null;
};

export type DropdownOption = {
  value: string;
  label: string;
};

export type KeyValueOption = {
  key: string;
  value: string;
};

export type BooleanKeyValueOption = {
  key: string;
  value: boolean;
};

export type PromptFieldKey =
  | "prompt_role"
  | "prompt_objectives"
  | "prompt_behavior"
  | "prompt_output_format"
  | "prompt_constraints"
  | "prompt_safety"
  | "prompt_tools_instructions"
  | "prompt_policy"
  | "prompt_examples"
  | "prompt_additional_info";

export type PromptFieldDefinition = {
  key: PromptFieldKey;
  label: string;
  required: boolean;
};

export type AgentLookupOption = {
  id: string;
  name: string;
  description?: string;
};

export const DEPLOYMENT_TARGET_OPTIONS: KeyValueOption[] = [
  {
    key: "Internal Runtime",
    value: "internal",
  },
  {
    key: "Vertex AI Agent Engine",
    value: "vertex",
  },
  {
    key: "AWS AgentCore",
    value: "bedrock_agentcore",
  },
];

export const AGENT_TYPE_OPTIONS: KeyValueOption[] = [
  {
    key: "Automation",
    value: "automation",
  },
  {
    key: "Agent",
    value: "agent",
  },
];

export const MEMORY_BANK_OPTIONS: BooleanKeyValueOption[] = [
  {
    key: "Enabled",
    value: true,
  },
  {
    key: "Disabled",
    value: false,
  },
];

export const MEMORY_RETRIEVAL_OPTIONS: KeyValueOption[] = [
  {
    key: "Load Memory Tool (Agent decides)",
    value: "load",
  },
  {
    key: "Preload Memory Tool (auto every turn)",
    value: "preload",
  },
];

export const PROMPT_FIELD_DEFINITIONS: PromptFieldDefinition[] = [
  { key: "prompt_role", label: "Role", required: false },
  { key: "prompt_objectives", label: "Objectives", required: false },
  { key: "prompt_behavior", label: "Behavior", required: false },
  { key: "prompt_output_format", label: "Output Format", required: false },
  { key: "prompt_constraints", label: "Constraints", required: false },
  { key: "prompt_safety", label: "Safety", required: false },
  {
    key: "prompt_tools_instructions",
    label: "Tool Instructions",
    required: false,
  },
  { key: "prompt_policy", label: "Policy", required: false },
  { key: "prompt_examples", label: "Examples", required: false },
  {
    key: "prompt_additional_info",
    label: "Additional Information",
    required: false,
  },
];

export interface DynamicDropdownFieldProps {
  Logo?: LucideIcon;
  label: string;
  hint?: string;
  values: string[][];
  options: { value: string; label: string }[];
  placeholder?: string;
  configDataMap?: Record<string, unknown>;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, v: string[] | string) => void;
}

export interface DynamicListFieldProps {
  label: string;
  hint?: string;
  values: string[];
  placeholder: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, v: string) => void;
}

export type CreateNewAgentProps = {
  onCreateSuccess?: () => void | Promise<void>;
};

export type ModelTemplate = {
  template_id: string;
  name: string;
  description?: string;
  instruction?: string;
  prompt_role?: string;
  prompt_objectives?: string;
  prompt_behavior?: string;
  prompt_output_format?: string;
  prompt_constraints?: string;
  prompt_safety?: string;
  prompt_tools_instructions?: string;
  prompt_policy?: string;
  prompt_examples?: string;
  prompt_additional_info?: string;
  model_id?: string;
};
