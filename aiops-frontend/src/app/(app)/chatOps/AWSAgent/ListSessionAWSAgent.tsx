import { trimTrailingSlash } from "@/config/agent";
import type { AdkSession } from "../types";

type ListAwsAgentSessionsParams = {
  baseUrl: string;
  agentId: string;
  userId: string;
};

type AwsAgentSessionPayload = {
  id?: string;
  user_id?: string;
};

export async function listSessionsAWSAgent({
  baseUrl,
  agentId,
  userId,
}: ListAwsAgentSessionsParams): Promise<AdkSession[]> {
  const response = await fetch(
    `${trimTrailingSlash(baseUrl)}/agent/${encodeURIComponent(agentId)}/chat/sessions`,
    {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
    }
  );

  const payload = (await response.json().catch(() => null)) as AwsAgentSessionPayload[] | null;

  if (!response.ok || !Array.isArray(payload)) {
    throw new Error("Unable to load AWS AgentCore sessions.");
  }

  return payload
    .filter((item) => typeof item?.id === "string" && item.id.trim().length > 0)
    .map((item) => ({
      id: item.id!.trim(),
      userId: typeof item.user_id === "string" ? item.user_id.trim() : userId,
    }));
}
