import { ReactNode } from "react";

export interface AgentRecord {
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
export interface DropdownOption {
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

export interface CreateNewAgentProps {
  onCreateSuccess?: () => void | Promise<void>;
}

export interface ModelTemplate {
  template_id: string;
  name: string;
  description?: string;
  instruction?: string;
  model_id?: string;
};
export interface OptionItem {
  label: string;
  value: string;
};

export interface Props {
  value: string[];
  options: OptionItem[];
  configDataMap?: Record<string, any>;
  placeholder?: string;
  onChange: (val: string[]) => void; // ✅ return all IDs
};
export interface UpdateAgentProps {
    agent: any;
    isOpen: boolean;
    onClose: () => void;
    onUpdateSuccess?: () => void;
};

export interface ModelOption {
    value: string;
    label: string;
    secondary: string;
    iconSrc: string | null;
};

export interface UpdateAgentForm {
    agentName: string;
    description: string;
    instruction: string;
    modelId: string;
    tools: string;
    mcpServers: string;
    connectorConfigIds: string;
    subAgents: string;
    isEnabled: boolean;
};
export interface ModelSelectProps {
  value: string;
  options: ModelOption[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
}

export interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}