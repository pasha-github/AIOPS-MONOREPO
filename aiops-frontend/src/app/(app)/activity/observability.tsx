"use client";

export type SessionTokenUsage = {
  agent_id: string;
  session_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

const normalizeTokenValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const normalizeSessionTokenUsage = (payload: unknown): SessionTokenUsage | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const agentId =
    typeof (payload as { agent_id?: unknown }).agent_id === "string"
      ? (payload as { agent_id: string }).agent_id.trim()
      : "";
  const sessionId =
    typeof (payload as { session_id?: unknown }).session_id === "string"
      ? (payload as { session_id: string }).session_id.trim()
      : "";

  if (!agentId || !sessionId) {
    return null;
  }

  return {
    agent_id: agentId,
    session_id: sessionId,
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

export async function fetchSessionTokenUsage(
  agentId: string,
  sessionId: string,
  baseUrl: string,
  signal?: AbortSignal
): Promise<SessionTokenUsage | null> {
  const trimmedAgentId = agentId.trim();
  const trimmedSessionId = sessionId.trim();

  if (!baseUrl || !trimmedAgentId || !trimmedSessionId) {
    return null;
  }

  const response = await fetch(
    `${baseUrl}/observability/token-usage/session/${encodeURIComponent(trimmedAgentId)}/${encodeURIComponent(trimmedSessionId)}`,
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

  return normalizeSessionTokenUsage(data);
}
