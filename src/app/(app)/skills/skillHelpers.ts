"use client";

export type SkillInventoryApiItem = {
  skill_id: string;
  name: string;
  description: string;
  instructions: string;
  tools: string[];
  connector_config_ids: string[];
  mcp_server_ids: string[];
  references: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type SkillInventoryRow = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
};

export type SkillDetail = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tools: string[];
  connectorConfigIds: string[];
  mcpServerIds: string[];
  references: Record<string, string>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type McpLookupOption = {
  id: string;
  name: string;
  serverUrl: string;
  label: string;
  tools: string[];
};

export type ConnectorConfigLookupOption = {
  connectorId: string;
  connectorName: string;
  connectorConfigId: string;
  configName: string;
  label: string;
  tools: string[];
};

const toText = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => toText(item))
    .filter((item) => item.length > 0);
};

const toStringRecord = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => {
      const nextKey = toText(key);
      if (!nextKey) {
        return [];
      }

      if (typeof entryValue === "string") {
        return [[nextKey, entryValue]];
      }

      return [[nextKey, String(entryValue ?? "")]];
    })
  );
};

export const formatSkillDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getSkillErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const detail = record.detail ?? record.message ?? record.error;
  return typeof detail === "string" && detail.trim() ? detail : fallback;
};

export const normalizeSkillDetail = (value: unknown): SkillDetail | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toText(record.skill_id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: toText(record.name),
    description: toText(record.description),
    instructions: toText(record.instructions),
    tools: toStringArray(record.tools),
    connectorConfigIds: toStringArray(record.connector_config_ids),
    mcpServerIds: toStringArray(record.mcp_server_ids),
    references: toStringRecord(record.references),
    createdAt: record.created_at ? String(record.created_at) : null,
    updatedAt: record.updated_at ? String(record.updated_at) : null,
  };
};

export const normalizeSkillInventoryRows = (payload: unknown) => {
  if (!Array.isArray(payload)) {
    return [] as SkillInventoryRow[];
  }

  return payload
    .map(normalizeSkillDetail)
    .filter((item): item is SkillDetail => item !== null)
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      instructions: item.instructions,
      createdAt: formatSkillDate(item.createdAt),
      updatedAt: formatSkillDate(item.updatedAt),
    }));
};

export const buildSkillPatchPayload = (detail: SkillDetail) => ({
  name: detail.name.trim(),
  description: detail.description.trim(),
  instructions: detail.instructions.trim(),
  tools: detail.tools.map((value) => value.trim()).filter(Boolean),
  connector_config_ids: detail.connectorConfigIds
    .map((value) => value.trim())
    .filter(Boolean),
  mcp_server_ids: detail.mcpServerIds
    .map((value) => value.trim())
    .filter(Boolean),
  references: detail.references,
});

export const skillTabs = [
  "Frontmatter",
  "Instructions",
  "MCP & Connector",
  "Tools",
  "References",
] as const;
