import { trimTrailingSlash } from "@/config/agent";
import type { AdkSession } from "../types";

type ListVertexSessionsParams = {
  baseUrl: string;
  agentId: string;
  userId: string;
};

export async function listSessionsVertexAgent({
  baseUrl,
  agentId,
  userId,
}: ListVertexSessionsParams): Promise<AdkSession[]> {
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

  const payload = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(payload)) {
    throw new Error("Unable to load Vertex sessions.");
  }

  return payload as AdkSession[];
}
