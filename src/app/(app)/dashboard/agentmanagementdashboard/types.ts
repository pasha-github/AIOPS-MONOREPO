export type AgentRecord = {
  agentId: string;
  name: string;
  port: number | null;
  status: string;
  enterprise: string;
  start_time: string | null;
  stop_time: string | null;
  updated_at: string | null;
};

export type AgentListApiResponseItem = {
  name?: string | null;
  agent_id?: string | null;
  updated_at?: string | null;
  status?: string | null;
  type?: string | null;
};

export type AgentFilter = "all" | "running" | "stopped";
