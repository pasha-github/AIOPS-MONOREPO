import { LLMRecord } from "./helps/llm.types";

export type LlmDefaultSlot = "primary" | "secondary" | "tertiary";

export type LlmDefaults = {
  id: number | null;
  primary_model_id: string | null;
  secondary_model_id: string | null;
  tertiary_model_id: string | null;
};

export const formatCellValue = (
  value: string | number | boolean | null | undefined
) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
};

export const normalizeLlmRecord = (value: unknown): LLMRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const normalized: LLMRecord = {};
  for (const [key, rawValue] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      normalized[key] = rawValue;
      continue;
    }

    if (rawValue === undefined) {
      normalized[key] = null;
      continue;
    }

    normalized[key] = JSON.stringify(rawValue);
  }

  return normalized;
};

export const getErrorMessage = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }
  return fallback;
};

export const normalizeLlmDefaults = (value: unknown): LlmDefaults | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const getModelId = (key: keyof Omit<LlmDefaults, "id">) => {
    const rawValue = payload[key];
    return typeof rawValue === "string" ? rawValue : null;
  };

  return {
    id: typeof payload.id === "number" ? payload.id : null,
    primary_model_id: getModelId("primary_model_id"),
    secondary_model_id: getModelId("secondary_model_id"),
    tertiary_model_id: getModelId("tertiary_model_id"),
  };
};

export const formatHeaderLabel = (header: string) =>
  header
    .split("_")
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "id") {
        return "ID";
      }
      return part.length > 0
        ? part[0].toUpperCase() + part.slice(1).toLowerCase()
        : part;
    })
    .join(" ");

export const formatDateTime = (
  rawValue: string | number | boolean | null | undefined
) => {
  const value = formatCellValue(rawValue);
  if (value === "-") {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const getProviderIconSrc = (
  providerValue: string | number | boolean | null | undefined
) => {
  const normalized = formatCellValue(providerValue).toLowerCase();
  const supportedProviders = ["google", "openai", "anthropic", "groq", "bedrock"];
  return supportedProviders.includes(normalized) ? `/img/${normalized}.webp` : null;
};

