import { trimTrailingSlash } from "@/config/agent";
import type { AdkSession } from "../types";

type CreateSessionAWSAgentParams = {
  baseUrl: string;
  agentId: string;
  userId: string;
};

type CreateSessionAWSAgentResponse = {
  session_id?: string | null;
};

export async function createSessionAWSAgent({
  baseUrl,
  agentId,
  userId,
}: CreateSessionAWSAgentParams): Promise<AdkSession> {
  const response = await fetch(
    `${trimTrailingSlash(baseUrl)}/agent/${encodeURIComponent(agentId)}/chat/sessions`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
    }
  );

  const payload = (await response.json().catch(() => null)) as CreateSessionAWSAgentResponse | null;
  const sessionId = typeof payload?.session_id === "string" ? payload.session_id.trim() : "";

  if (!response.ok || !sessionId) {
    throw new Error("Unable to create AWS AgentCore session.");
  }

  return {
    id: sessionId,
    userId,
    events: [],
  };
}
