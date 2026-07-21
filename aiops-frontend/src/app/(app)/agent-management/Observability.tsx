"use client";

export type AgentTokenUsage = {
  agent_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type ModelTokenUsage = {
  llm_model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  pricing: {
    input_cost_per_million_tokens: number;
    output_cost_per_million_tokens: number;
  } | null;
};

const normalizeTokenValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const normalizeTokenUsage = (payload: unknown): AgentTokenUsage | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const agentId =
    typeof (payload as { agent_id?: unknown }).agent_id === "string"
      ? (payload as { agent_id: string }).agent_id.trim()
      : "";

  if (!agentId) {
    return null;
  }

  return {
    agent_id: agentId,
    input_tokens: normalizeTokenValue(
      (payload as { input_tokens?: unknown }).input_tokens
    ),
    output_tokens: normalizeTokenValue(
      (payload as { output_tokens?: unknown }).output_tokens
    ),
    total_tokens: normalizeTokenValue(
      (payload as { total_tokens?: unknown }).total_tokens
    ),
  };
};

export async function fetchAgentTokenUsage(
  agentId: string,
  baseUrl: string,
  signal?: AbortSignal
): Promise<AgentTokenUsage | null> {
  const trimmedAgentId = agentId.trim();
  if (!baseUrl || !trimmedAgentId) {
    return null;
  }

  const response = await fetch(
    `${baseUrl}/observability/token-usage/agent/${encodeURIComponent(trimmedAgentId)}`,
    {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
    }
  );

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    return null;
  }

  return normalizeTokenUsage(data);
}

export async function fetchAgentTokenUsageMap(
  agentIds: string[],
  baseUrl: string,
  signal?: AbortSignal
): Promise<Record<string, AgentTokenUsage>> {
  const uniqueAgentIds = Array.from(
    new Set(agentIds.map((agentId) => agentId.trim()).filter(Boolean))
  );

  const tokenEntries = await Promise.all(
    uniqueAgentIds.map(async (agentId) => {
      try {
        const usage = await fetchAgentTokenUsage(agentId, baseUrl, signal);
        return usage ? ([agentId, usage] as const) : null;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        return null;
      }
    })
  );

  return Object.fromEntries(
    tokenEntries.filter(
      (entry): entry is readonly [string, AgentTokenUsage] => entry !== null
    )
  );
}

const normalizeModelTokenUsage = (payload: unknown): ModelTokenUsage | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const modelId =
    typeof (payload as { llm_model?: unknown }).llm_model === "string"
      ? (payload as { llm_model: string }).llm_model.trim()
      : "";

  if (!modelId) {
    return null;
  }

  const pricingRaw = (payload as { pricing?: unknown }).pricing;
  const pricing =
    pricingRaw && typeof pricingRaw === "object" && !Array.isArray(pricingRaw)
      ? {
          input_cost_per_million_tokens: normalizeTokenValue(
            (pricingRaw as { input_cost_per_million_tokens?: unknown })
              .input_cost_per_million_tokens
          ),
          output_cost_per_million_tokens: normalizeTokenValue(
            (pricingRaw as { output_cost_per_million_tokens?: unknown })
              .output_cost_per_million_tokens
          ),
        }
      : null;

  return {
    llm_model: modelId,
    input_tokens: normalizeTokenValue(
      (payload as { input_tokens?: unknown }).input_tokens
    ),
    output_tokens: normalizeTokenValue(
      (payload as { output_tokens?: unknown }).output_tokens
    ),
    total_tokens: normalizeTokenValue(
      (payload as { total_tokens?: unknown }).total_tokens
    ),
    input_cost: normalizeTokenValue((payload as { input_cost?: unknown }).input_cost),
    output_cost: normalizeTokenValue(
      (payload as { output_cost?: unknown }).output_cost
    ),
    total_cost: normalizeTokenValue((payload as { total_cost?: unknown }).total_cost),
    pricing,
  };
};

export async function fetchModelTokenUsageMap(
  baseUrl: string,
  days?: number,
  signal?: AbortSignal
): Promise<Record<string, ModelTokenUsage>> {
  if (!baseUrl) {
    return {};
  }

  const query = new URLSearchParams();
  if (typeof days === "number" && Number.isFinite(days) && Number.isInteger(days)) {
    query.set("days", String(days));
  }

  const url = `${baseUrl}/observability/token-usage/models${query.size ? `?${query.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    signal,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !Array.isArray(data)) {
    return {};
  }

  return Object.fromEntries(
    data
      .map(normalizeModelTokenUsage)
      .filter((entry): entry is ModelTokenUsage => entry !== null)
      .map((entry) => [entry.llm_model, entry] as const)
  );
}
