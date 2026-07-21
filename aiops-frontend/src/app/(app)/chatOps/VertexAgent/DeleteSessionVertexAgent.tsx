import { trimTrailingSlash } from "@/config/agent";

type DeleteVertexSessionParams = {
  baseUrl: string;
  agentId: string;
  sessionId: string;
  userId: string;
};

type DeleteVertexSessionResponse = {
  ok?: boolean;
};

export async function deleteSessionVertexAgent({
  baseUrl,
  agentId,
  sessionId,
  userId,
}: DeleteVertexSessionParams): Promise<void> {
  const response = await fetch(
    `${trimTrailingSlash(baseUrl)}/agent/${encodeURIComponent(agentId)}/chat/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
    }
  );

  const payload = (await response.json().catch(() => null)) as DeleteVertexSessionResponse | null;

  if (!response.ok || payload?.ok !== true) {
    throw new Error("Unable to delete Vertex session.");
  }
}
