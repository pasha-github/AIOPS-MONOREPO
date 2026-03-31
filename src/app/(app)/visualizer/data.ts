export type VisualizerAgent = {
  agent_id: string;
  name: string;
  type: string;
  status: string;
  isEnabled: boolean;
  description: string;
  instruction: string;
  model_id?: string;
  tools?: string | null;
  created_at?: string;
  updated_at?: string;
  connector_config_ids: string[];
  mcp_servers: string[];
  sub_agents: string[];
  tags?: string[] | null;
  model: {
    provider: string;
    name: string;
    model_id?: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    isEnabled?: boolean;
  };
  webhooks: Array<{
    webhook_id: string;
    prompt: string;
  }>;
  jobs?: unknown[];
};

export type VisualizerConnector = {
  connector_config_id: string;
  connector_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  config: Array<{ name: string; value?: string }>;
};

export type VisualizerMcp = {
  name: string;
  url: string;
};

export type VisualizerNode =
  | { id: string; type: "agent"; data: { agent: VisualizerAgent } }
  | { id: string; type: "connector"; data: { connector: VisualizerConnector } }
  | { id: string; type: "mcp"; data: { mcp: VisualizerMcp } };

export type VisualizerEdge = {
  id: string;
  source: string;
  target: string;
};

export type VisualizerResponse = {
  nodes: VisualizerNode[];
  edges: VisualizerEdge[];
};
