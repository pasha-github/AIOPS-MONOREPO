import { deleteSessionVertexAgent } from "../VertexAgent/DeleteSessionVertexAgent";

type DeleteSessionAWSAgentParams = {
  baseUrl: string;
  agentId: string;
  sessionId: string;
  userId: string;
};

export async function deleteSessionAWSAgent(params: DeleteSessionAWSAgentParams) {
  return deleteSessionVertexAgent(params);
}
