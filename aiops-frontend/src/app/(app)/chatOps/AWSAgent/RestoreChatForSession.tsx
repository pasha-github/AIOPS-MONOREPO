import { trimTrailingSlash } from "@/config/agent";
import { mapEventsToMessages } from "../chat_helpers";
import type { AdkEvent, AdkFunctionCall, AdkFunctionResponse, AdkPart, AdkSession } from "../types";

type RestoreAWSAgentChatParams = {
  baseUrl: string;
  agentId: string;
  sessionId: string;
  userId: string;
};

type AwsAgentFunctionCallPayload = {
  id?: string | null;
  name?: string | null;
  args?: unknown;
};

type AwsAgentFunctionResponsePayload = {
  id?: string | null;
  name?: string | null;
  response?: unknown;
};

type AwsAgentPartPayload = {
  text?: string | null;
  thought?: boolean | null;
  function_call?: AwsAgentFunctionCallPayload | null;
  function_response?: AwsAgentFunctionResponsePayload | null;
};

type AwsAgentContentPayload = {
  role?: string | null;
  parts?: AwsAgentPartPayload[] | null;
};

type AwsAgentEventPayload = {
  id?: string | null;
  timestamp?: number | null;
  author?: string | null;
  content?: AwsAgentContentPayload | null;
};

type AwsAgentSessionPayload = {
  id?: string | null;
  app_name?: string | null;
  user_id?: string | null;
  last_update_time?: number | null;
  state?: {
    first_message_summary?: string | null;
  } | null;
  events?: AwsAgentEventPayload[] | null;
};

const normalizeFunctionCall = (
  functionCall?: AwsAgentFunctionCallPayload | null
): AdkFunctionCall | null => {
  if (!functionCall?.name) {
    return null;
  }

  return {
    id: functionCall.id ?? null,
    name: functionCall.name ?? null,
    args: functionCall.args,
  };
};

const normalizeFunctionResponse = (
  functionResponse?: AwsAgentFunctionResponsePayload | null
): AdkFunctionResponse | null => {
  if (!functionResponse?.name) {
    return null;
  }

  return {
    id: functionResponse.id ?? null,
    name: functionResponse.name ?? null,
    response: functionResponse.response,
  };
};

const normalizePart = (part: AwsAgentPartPayload): AdkPart => ({
  text: part.text ?? null,
  thought: part.thought ?? null,
  functionCall: normalizeFunctionCall(part.function_call),
  functionResponse: normalizeFunctionResponse(part.function_response),
});

const normalizeEvent = (event: AwsAgentEventPayload): AdkEvent => ({
  id: event.id ?? null,
  timestamp: event.timestamp ?? null,
  author: event.author ?? null,
  content: event.content
    ? {
        role: event.content.role ?? null,
        parts: Array.isArray(event.content.parts)
          ? event.content.parts.map(normalizePart)
          : [],
      }
    : null,
});

const normalizeSession = (payload: AwsAgentSessionPayload): AdkSession => ({
  id: String(payload.id ?? ""),
  appName: payload.app_name ?? null,
  userId: payload.user_id ?? null,
  lastUpdateTime: payload.last_update_time ?? null,
  state: payload.state?.first_message_summary
    ? { first_message_summary: payload.state.first_message_summary }
    : null,
  events: Array.isArray(payload.events) ? payload.events.map(normalizeEvent) : [],
});

export async function restoreChatForSessionAWSAgent({
  baseUrl,
  agentId,
  sessionId,
  userId,
}: RestoreAWSAgentChatParams) {
  const response = await fetch(
    `${trimTrailingSlash(baseUrl)}/agent/${encodeURIComponent(agentId)}/chat/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
    }
  );

  const payload = (await response.json().catch(() => null)) as AwsAgentSessionPayload | null;

  if (!response.ok || !payload?.id) {
    throw new Error("Unable to restore AWS AgentCore chat session.");
  }

  const normalizedSession = normalizeSession(payload);
  return mapEventsToMessages(normalizedSession.events);
}
