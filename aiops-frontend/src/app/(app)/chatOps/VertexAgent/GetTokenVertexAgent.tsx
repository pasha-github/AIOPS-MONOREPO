import { trimTrailingSlash } from "@/config/agent";

type VertexTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_at?: string;
};

export async function getTokenVertexAgent(baseUrl: string) {
  const tokenUrl = `/api/vertex-token?baseUrl=${encodeURIComponent(trimTrailingSlash(baseUrl))}`;
  const response = await fetch(tokenUrl, {
    headers: {
      accept: "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as VertexTokenResponse | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error("Unable to get Vertex access token.");
  }

  return payload.access_token;
}
