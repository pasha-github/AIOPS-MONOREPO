export type SkillInventoryRow = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
};

export const mcpOptions = [
  {
    value: "cruise-mcp",
    label: "Cruise MCP Server | https://saudi-cruise-mcp.example/mcp",
  },
  {
    value: "cloudflare-mcp",
    label: "Cloudflare MCP | https://docs.mcp.cloudflare.com/mcp",
  },
  {
    value: "servicenow-mcp",
    label: "ServiceNow MCP | https://servicenow-mcp.example/mcp",
  },
];



export const toolOptions = [
  "Create Incident",
  "Update Incident",
  "Search Knowledge Base",
  "Send Email",
  "Post Teams Message",
];

export const skillTabs = [
  "Front matter",
  "Instructions",
  "MCP & Connector",
  "Tools",
  "References",
] as const;
