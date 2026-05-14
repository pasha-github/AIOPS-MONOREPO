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

export interface StreamStep {
    id: string;
    label: string;
    status: "running" | "done";
    details?: string;
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
};

export interface AdkContent {
    role?: string | null;
    parts?: AdkPart[] | null;
};

export interface AdkEvent  {
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

export interface SessionState {
    first_message_summary?: string;
};

export interface ChatMessage {
    id: string;
    role: "user" | "agent";
    text: string;
    timeLabel: string;
};

export interface AdkSsePayload {
    partial?: boolean;
    error?: string;
    content?: AdkContent | null;
    actions?: {
        requestedToolConfirmations?: Record<string, unknown> | null;
    } | null;
};

export interface AgentSidebarProps {
  assistantDisplayName: string;
  appName: string;
  apps: AppItem[];
  selectedApp: AppItem | null;
  onSelectApp: (app: AppItem) => void;
};
export interface ChatHeaderProps {
  assistantDisplayName: string;
  appName: string;
  selectedSessionLabel: string;
  onClose?: () => void;
}
export interface ChatInputProps {
  draft: string;
  isSending: boolean;
  messagesError: string;
  sendError: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};
export interface ChatMessagesProps {
  isLoadingMessages: boolean;
  isInitialSessionView: boolean;
  visibleMessages: ChatMessage[];
  isStreamingReply: boolean;
  streamingText: string;
  streamSteps: StreamStep[];
  messageMilestones: Record<string, StreamStep[]>;
  expandedMilestones: Record<string, boolean>;
  assistantDisplayName: string;
  copiedMessageId: string | null;
  lastUserPrompt: string;
  isSending: boolean;
  sendError?: string;

  // initial-view input props (required when isInitialSessionView may be true)
  draft?: string;
  onDraftChange?: (value: string) => void;
  onSend?: () => void;

  onToggleMilestone: (stepId: string) => void;
  onCopyMessage: (messageId: string, text: string) => Promise<void>;
  onRetry: () => void;
};
export interface ChatSidebarProps {
    sessions: AdkSession[];
    selectedSessionId: string | null;
    isLoadingSessions: boolean;
    sessionsError: string;
    isSending: boolean;
    onNewChat: () => void;
    onSelectSession: (sessionId: string) => void;
    onDeleteSession: (sessionId: string) => void;
};
export interface AppItem {
  agent_id: string;
  name: string;
  type?: string | null;
};
