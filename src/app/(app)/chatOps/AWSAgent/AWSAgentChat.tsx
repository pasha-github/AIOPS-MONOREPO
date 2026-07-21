import { trimTrailingSlash } from "@/config/agent";
import { formatTime } from "../chat_helpers";
import type { ChatMessage } from "../types";

type AWSAgentChatParams = {
  baseUrl: string;
  agentId: string;
  sessionId: string;
  message: string;
  userId: string;
  onText?: (text: string) => void;
};

type AWSAgentChatEvent = {
  result?: string | null;
  session_id?: string | null;
};

type AWSAgentChatResponse = {
  session_id?: string | null;
  text?: string | null;
  events?: AWSAgentChatEvent[] | null;
};

const resolveResponseText = (payload: AWSAgentChatResponse | null) => {
  const directText = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (directText) {
    return directText;
  }

  const eventText = Array.isArray(payload?.events)
    ? payload.events
        .map((event) => (typeof event?.result === "string" ? event.result.trim() : ""))
        .find((value) => value.length > 0) ?? ""
    : "";

  return eventText;
};

export async function awsAgentChat({
  baseUrl,
  agentId,
  sessionId,
  message,
  userId,
  onText,
}: AWSAgentChatParams): Promise<ChatMessage> {
  const response = await fetch(
    `${trimTrailingSlash(baseUrl)}/agent/${encodeURIComponent(agentId)}/chat`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as AWSAgentChatResponse | null;
  const text = resolveResponseText(payload);

  if (!response.ok || !text) {
    throw new Error("Unable to parse AWS AgentCore response.");
  }

  onText?.(text);

  return {
    id: `aws-agent-response-${sessionId}-${Date.now()}`,
    role: "agent",
    text,
    timeLabel: formatTime(),
  };
}
