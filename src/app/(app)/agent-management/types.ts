"use client";

export type AgentRecord = {
  agentId: number;
  name: string;
  port: number | null;
  status: string;
  type: string;
  enterprise: string;
  start_time: string | null;
  stop_time: string | null;
  agent_id: string | null;
  description: string | null;
  instruction: string | null;
  model_id: string | null;
  modelName: string | null;
  modelProvider: string | null;
  created_at: string | null;
  updated_at: string | null;
  tools: string[] | string;
  mcp_servers: string[];
  connector_config_ids: string[];
  sub_agents: string[];
  isEnabled: boolean | null;
};
export type DropdownOption = {
  value: string;
  label: string;
};
export interface DynamicDropdownFieldProps {
  label: string;
  hint?: string;
  values: string[];
  options: { value: string; label: string }[];
  placeholder?: string;
  configDataMap?: Record<string, any>;  // ← was: configData?: any
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, v: string) => void;
}
export interface DynamicListFieldProps {
  label: string;
  hint?: string;
  values: string[];
  placeholder: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, v: string) => void;
};

export type CreateNewAgentProps = {
  onCreateSuccess?: () => void | Promise<void>;
};

export type ModelTemplate = {
  template_id: string;
  name: string;
  description?: string;
  instruction?: string;
  model_id?: string;
};