import type { AdkSession } from "../types";
import { getTokenVertexAgent } from "./GetTokenVertexAgent";

type CreateVertexSessionParams = {
  baseUrl: string;
  streamQueryUrl: string;
  userId: string;
};

type VertexCreateSessionResponse = {
  output?: AdkSession;
};

const getVertexQueryUrl = (streamQueryUrl: string) => {
  if (!streamQueryUrl) {
    throw new Error("Vertex stream query URL is missing.");
  }

  return streamQueryUrl.replace(/:streamQuery(?:\?alt=sse)?$/, ":query");
};

export async function createSessionVertexAgent({
  baseUrl,
  streamQueryUrl,
  userId,
}: CreateVertexSessionParams): Promise<AdkSession> {
  const token = await getTokenVertexAgent(baseUrl);
  const response = await fetch(getVertexQueryUrl(streamQueryUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      class_method: "create_session",
      input: {
        user_id: userId,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as VertexCreateSessionResponse | null;
  const session = payload?.output;

  if (!response.ok || !session?.id) {
    throw new Error("Unable to create Vertex session.");
  }

  return session;
}
