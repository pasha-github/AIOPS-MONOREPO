export type McpToolSchema = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};

export type McpTool = {
  name: string;
  description: string;
  input_schema: McpToolSchema | null;
};

export type McpMetadata = {
  name: string;
  transport: string;
  tool_count: number;
  resource_count: number;
};

export type McpServer = {
  mcp_server_id: string;
  name: string;
  server_url: string;
  description: string;
  auth_type: string;
  auth_username: string;
  has_auth_secret: boolean;
  metadata: McpMetadata;
  tools: McpTool[];
  resources: unknown[];
  created_at: string | null;
  updated_at: string | null;
};

type TestMcpPayloadShape = {
  auth_secret?: string;
  description?: string;
};

const formatText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || "-";
};

const formatNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const normalizeMcpServer = (input: unknown): McpServer | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const metadataRecord =
    record.metadata && typeof record.metadata === "object"
      ? (record.metadata as Record<string, unknown>)
      : {};

  const tools = Array.isArray(record.tools)
    ? record.tools
        .map((tool) => {
          if (!tool || typeof tool !== "object") {
            return null;
          }

          const toolRecord = tool as Record<string, unknown>;
          return {
            name: formatText(toolRecord.name),
            description: formatText(toolRecord.description),
            input_schema:
              toolRecord.input_schema && typeof toolRecord.input_schema === "object"
                ? (toolRecord.input_schema as McpToolSchema)
                : null,
          } satisfies McpTool;
        })
        .filter((tool): tool is McpTool => tool !== null)
    : [];

  return {
    mcp_server_id: formatText(record.mcp_server_id),
    name: formatText(record.name),
    server_url: formatText(record.server_url),
    description: formatText(record.description),
    auth_type: formatText(record.auth_type),
    auth_username: formatText(record.auth_username),
    has_auth_secret: Boolean(record.has_auth_secret),
    metadata: {
      name: formatText(metadataRecord.name),
      transport: formatText(metadataRecord.transport),
      tool_count: formatNumber(metadataRecord.tool_count),
      resource_count: formatNumber(metadataRecord.resource_count),
    },
    tools,
    resources: Array.isArray(record.resources) ? record.resources : [],
    created_at:
      record.created_at === null || record.created_at === undefined
        ? null
        : String(record.created_at),
    updated_at:
      record.updated_at === null || record.updated_at === undefined
        ? null
        : String(record.updated_at),
  };
};

export const normalizeTestMcpServer = (
  input: unknown,
  payload?: TestMcpPayloadShape
): McpServer | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const nextRecord: Record<string, unknown> = {
    ...record,
    mcp_server_id: record.mcp_server_id ?? "test-mcp-server",
    server_url: record.server_url ?? record.url,
    description: record.description ?? payload?.description ?? "-",
    has_auth_secret:
      record.has_auth_secret ??
      Boolean(payload?.auth_secret && String(payload.auth_secret).trim()),
    created_at: record.created_at ?? null,
    updated_at: record.updated_at ?? null,
  };

  return normalizeMcpServer(nextRecord);
};

export const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getMcpErrorMessage = (
  data: unknown,
  fallback: string
): string => {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const record = data as Record<string, unknown>;
  const message = record.message ?? record.detail ?? record.error;
  return typeof message === "string" && message.trim() ? message : fallback;
};

export const getSchemaRequiredFields = (schema: McpToolSchema | null) =>
  Array.isArray(schema?.required) ? schema.required : [];

export const getSchemaPropertyEntries = (schema: McpToolSchema | null) => {
  if (!schema?.properties || typeof schema.properties !== "object") {
    return [];
  }

  return Object.entries(schema.properties).map(([name, value]) => ({
    name,
    definition:
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : ({} as Record<string, unknown>),
  }));
};
