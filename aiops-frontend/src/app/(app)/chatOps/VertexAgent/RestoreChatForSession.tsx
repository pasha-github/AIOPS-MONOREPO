import { trimTrailingSlash } from "@/config/agent";
import { extractVisibleTextFromParts, formatTime } from "../chat_helpers";
import type { AdkEvent, AdkSession, ChatMessage, StreamStep } from "../types";

type RestoreVertexChatParams = {
  baseUrl: string;
  agentId: string;
  sessionId: string;
  userId: string;
};

const userRoleLabel = "user";

type VertexEventWithInvocation = AdkEvent & {
  invocation_id?: string | null;
  invocationId?: string | null;
};

const getVertexRole = (event: AdkEvent): ChatMessage["role"] | null => {
  const contentRole = String(event.content?.role ?? "").toLowerCase();
  if (contentRole === "user") return "user";
  if (contentRole === "model") return "agent";

  const author = String(event.author ?? "").toLowerCase();
  if (author === userRoleLabel) return "user";
  if (author) return "agent";
  return null;
};

export function mapVertexSessionToMessages(session: AdkSession) {
  const events = Array.isArray(session.events) ? session.events : [];
  const standaloneMessages: Array<{ index: number; message: ChatMessage }> = [];
  const groupedTurns = new Map<
    string,
    {
      firstIndex: number;
      userMessage: ChatMessage | null;
      agentMessage: ChatMessage | null;
    }
  >();
  const milestonesByMessageId: Record<string, StreamStep[]> = {};

  events.forEach((event, index) => {
    const parts = Array.isArray(event.content?.parts) ? event.content.parts : [];
    const text = extractVisibleTextFromParts(parts).trim();
    const role = getVertexRole(event);
    const invocationId =
      (event as VertexEventWithInvocation).invocation_id ??
      (event as VertexEventWithInvocation).invocationId ??
      null;

    if (!text || !role) {
      return;
    }

    const message: ChatMessage = {
      id: String(event.id ?? `${role}-${index}`),
      role,
      text,
      timeLabel: formatTime(event.timestamp),
    };

    if (!invocationId) {
      standaloneMessages.push({ index, message });
      return;
    }

    const existingTurn = groupedTurns.get(invocationId) ?? {
      firstIndex: index,
      userMessage: null,
      agentMessage: null,
    };

    if (role === "user") {
      existingTurn.userMessage ??= message;
    } else {
      existingTurn.agentMessage = message;
    }

    groupedTurns.set(invocationId, existingTurn);
  });

  const orderedEntries: Array<{ index: number; messages: ChatMessage[] }> = [
    ...standaloneMessages.map((item) => ({
      index: item.index,
      messages: [item.message],
    })),
    ...Array.from(groupedTurns.values()).map((turn) => ({
      index: turn.firstIndex,
      messages: [
        ...(turn.userMessage ? [turn.userMessage] : []),
        ...(turn.agentMessage ? [turn.agentMessage] : []),
      ],
    })),
  ];

  const messages = orderedEntries
    .sort((left, right) => left.index - right.index)
    .flatMap((entry) => entry.messages);

  return { messages, milestonesByMessageId };
}

export async function restoreChatForSession({
  baseUrl,
  agentId,
  sessionId,
  userId,
}: RestoreVertexChatParams) {
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

  const payload = (await response.json().catch(() => null)) as AdkSession | null;

  if (!response.ok || !payload) {
    throw new Error("Unable to restore Vertex chat session.");
  }

  return mapVertexSessionToMessages(payload);
}
