

export interface SessionState {
  first_message_summary?: string;
};

export interface SessionSummaryResponse {
  id?: string;
  appName?: string;
  userId?: string;
  state?: SessionState;
  lastUpdateTime?: number;
};

export interface EventPart {
  text?: string;
  functionCall?: {
    args?: {
      request?: string;
    };
  };
};

export interface SessionEvent {
  id?: string;
  author?: string;
  timestamp?: number;
  content?: {
    parts?: EventPart[];
  };
};

export interface SessionDetailResponse extends SessionSummaryResponse {
  events?: SessionEvent[];
};

export interface AgentSessionSummary {
  id: string;
  summary: string;
  updatedAt: number;
  updatedAtLabel: string;
};

export interface AgentLogEntry {
  id: string;
  title: string;
  authorLabel: string;
  timestamp: number;
  timestampLabel: string;
  text: string;
  preview: string;
  isTruncated: boolean;
  source: "text" | "request";
};

export interface AgentSessionDetail {
  id: string;
  summary: string;
  updatedAt: number;
  updatedAtLabel: string;
  entries: AgentLogEntry[];
};

export interface ChatAgent {
  agentId: string;
  name: string;
};

export interface AgentChatWorkspaceProps {
  agent: ChatAgent;
  onClose: () => void;
};

export interface AdkFunctionCall {
  id?: string | null;
  name?: string | null;
  args?: unknown;
};

export interface AdkFunctionResponse {
  id?: string | null;
  name?: string | null;
  response?: unknown;
};

export interface AdkPart {
  text?: string | null;
  thought?: boolean | null;
  functionCall?: AdkFunctionCall | null;
  functionResponse?: AdkFunctionResponse | null;
}

export interface AdkContent {
  role?: string | null;
  parts?: AdkPart[] | null;
};

export interface AdkEvent {
  id?: string | null;
  timestamp?: number | null;
  author?: string | null;
  content?: AdkContent | null;
};

export interface AdkSession {
  id: string;
  appName?: string | null;
  userId?: string | null;
  events?: AdkEvent[] | null;
  lastUpdateTime?: number | null;
  state?: SessionState | null;
};

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timeLabel: string;
};
export interface StreamStep {
  id: string;
  label: string;
  status: "running" | "done";
  details?: string;
};
export interface AdkSsePayload {
  partial?: boolean;
  error?: string;
  content?: AdkContent | null;
  actions?: {
    requestedToolConfirmations?: Record<string, unknown> | null;
  } | null;
};
export interface AgentRecord {
  agentId: string;
  name: string;
  port: number | null;
  status: string;
  enterprise: string;
  start_time: string | null;
  stop_time: string | null;
  updated_at: string | null;
};

export interface AgentListApiResponseItem {
  name?: string | null;
  agent_id?: string | null;
  updated_at?: string | null;
  status?: string | null;
  type?: string | null;
};

