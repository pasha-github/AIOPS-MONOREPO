export type ConnectorItem = {
  id: number;
  connector_type: string;
  provider_code: string;
  is_active: "Y" | "N" | string;
  created_at: string;
  updated_at: string;
};

export type ConnectorSchemaField = {
  field: string;
  type: string;
  label: string;
  value?: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export const STATIC_CONNECTORS: ConnectorItem[] = [
  {
    id: 101,
    connector_type: "integration",
    provider_code: "ServiceNow",
    is_active: "Y",
    created_at: "2026-03-18 11:22:00",
    updated_at: "2026-03-22 10:18:00",
  },
  {
    id: 102,
    connector_type: "integration",
    provider_code: "Mule",
    is_active: "Y",
    created_at: "2026-03-19 09:08:00",
    updated_at: "2026-03-23 01:16:00",
  },
  {
    id: 103,
    connector_type: "collaboration",
    provider_code: "Teams",
    is_active: "N",
    created_at: "2026-03-20 02:50:00",
    updated_at: "2026-03-23 08:45:00",
  },
];

export const AGENT_TYPE_OPTIONS: SelectOption[] = [
  { value: "integration", label: "Integration" },
  { value: "collaboration", label: "Collaboration" },
];

export const ENTERPRISE_OPTIONS_BY_AGENT_TYPE: Record<string, SelectOption[]> = {
  integration: [
    { value: "ServiceNow", label: "ServiceNow" },
    { value: "Mule", label: "Mule" },
    { value: "SAP", label: "SAP" },
  ],
  collaboration: [
    { value: "Teams", label: "Teams" },
    { value: "Slack", label: "Slack" },
    { value: "Zoom", label: "Zoom" },
  ],
};

export const SCHEMA_BY_PROVIDER: Record<string, ConnectorSchemaField[]> = {
  ServiceNow: [
    { field: "instance_url", type: "text", label: "Instance URL" },
    { field: "username", type: "text", label: "Username" },
    { field: "password", type: "password", label: "Password" },
  ],
  Mule: [
    { field: "base_url", type: "text", label: "Base URL" },
    { field: "client_id", type: "text", label: "Client ID" },
    { field: "client_secret", type: "password", label: "Client Secret" },
  ],
  SAP: [
    { field: "host", type: "text", label: "Host" },
    { field: "client", type: "text", label: "Client" },
    { field: "password", type: "password", label: "Password" },
  ],
  Teams: [
    { field: "tenant_id", type: "text", label: "Tenant ID" },
    { field: "app_id", type: "text", label: "App ID" },
    { field: "app_secret", type: "password", label: "App Secret" },
  ],
  Slack: [
    { field: "workspace", type: "text", label: "Workspace" },
    { field: "bot_token", type: "password", label: "Bot Token" },
  ],
  Zoom: [
    { field: "account_id", type: "text", label: "Account ID" },
    { field: "client_id", type: "text", label: "Client ID" },
    { field: "client_secret", type: "password", label: "Client Secret" },
  ],
};
