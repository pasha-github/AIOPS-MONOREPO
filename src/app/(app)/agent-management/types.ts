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
