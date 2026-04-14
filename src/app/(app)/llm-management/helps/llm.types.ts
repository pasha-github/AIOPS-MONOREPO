// import { ActionResult, LLMRecord } from "../llmHelpers";

export interface LLMTableSectionProps {
  llms: LLMRecord[];
  isLoading: boolean;
  loadError: string;
  onDeleteModel: (modelId: string) => Promise<ActionResult>;
};

export interface SelectOption {
  value: string;
  label: string;
  iconSrc?: string;
}
export interface RoundedSelectProps {
  value: string;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
  leadingIconSrc?: string;
  leadingIconAlt?: string;
  onChange: (value: string) => void;
};

export interface CreateLlmPayload {
  model_id: string;
  provider: string;
  name: string;
  description: string;
  api_key: string;
};

export interface CreateLlmModalProps {
  onClose: () => void;
  onCreate: (payload: CreateLlmPayload) => Promise<ActionResult>;
};

export interface RoundedSelectProps {
    value: string;
    options: SelectOption[];
    placeholder: string;
    disabled?: boolean;
    leadingIconSrc?: string;
    leadingIconAlt?: string;
    onChange: (value: string) => void;
};

export interface LlmRecord {
    model_id: string;
    provider: string;
    name: string;
    description: string;
    api_key?: string;
};

export interface UpdateLlmPayload {
    model_id: string;
    provider: string;
    name: string;
    description: string;
    api_key?: string;
};

export interface UpdateLlmModalProps {
    llm: LlmRecord;
    onClose: () => void;
};

export interface SelectOption {
    value: string;
    label: string;
    iconSrc?: string;
}
export interface LLMOverviewSectionProps {
  llms: LLMRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  onCreateClick: () => void;
};

export interface LLMRecord {
  [key: string]: string | number | boolean | null;
}

export interface ActionResult  {
  ok: boolean;
  error?: string;
};