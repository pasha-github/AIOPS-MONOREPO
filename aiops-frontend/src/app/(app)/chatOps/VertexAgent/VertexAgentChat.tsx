import { formatTime } from "../chat_helpers";
import type { ChatMessage } from "../types";
import { getTokenVertexAgent } from "./GetTokenVertexAgent";

type VertexAgentChatParams = {
  baseUrl: string;
  streamQueryUrl: string;
  sessionId: string;
  message: string;
  userId: string;
  onText?: (text: string) => void;
};

type VertexChatPart = {
  text?: string | null;
  function_call?: {
    id?: string | null;
    args?: unknown;
    name?: string | null;
  } | null;
  function_response?: {
    id?: string | null;
    name?: string | null;
    response?: unknown;
  } | null;
};

type VertexChatResponse = {
  id?: string | null;
  timestamp?: number | null;
  author?: string | null;
  partial?: boolean | null;
  finish_reason?: string | null;
  content?: {
    role?: string | null;
    parts?: VertexChatPart[] | null;
  } | null;
};

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const extractCompleteJsonObjects = (rawPayload: string) => {
  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let startIndex = -1;

  for (let index = 0; index < rawPayload.length; index += 1) {
    const character = rawPayload[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0 && startIndex !== -1) {
        objects.push(rawPayload.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return objects;
};

const parseVertexChatEvents = (rawPayload: string): VertexChatResponse[] => {
  const trimmed = rawPayload.trim();
  if (!trimmed) {
    return [];
  }

  const directPayload = parseJson(trimmed);
  if (isRecord(directPayload)) {
    return [directPayload as VertexChatResponse];
  }

  return extractCompleteJsonObjects(trimmed)
    .map((chunk) => parseJson(chunk))
    .filter((item): item is VertexChatResponse => isRecord(item));
};

const extractPartText = (part: VertexChatPart) =>
  typeof part.text === "string" ? part.text : "";

const extractVertexResponseText = (payload: VertexChatResponse) => {
  const parts = Array.isArray(payload.content?.parts) ? payload.content.parts : [];

  return parts
    .map(extractPartText)
    .join("")
    .trim();
};

const hasFunctionActivity = (payload: VertexChatResponse) => {
  const parts = Array.isArray(payload.content?.parts) ? payload.content.parts : [];
  return parts.some(
    (part) => Boolean(part.function_call) || Boolean(part.function_response)
  );
};

const isModelTextEvent = (payload: VertexChatResponse) => {
  const text = extractVertexResponseText(payload);
  const role = String(payload.content?.role ?? "").toLowerCase();
  return text.length > 0 && (role === "model" || !hasFunctionActivity(payload));
};

export async function vertexAgentChat({
  baseUrl,
  streamQueryUrl,
  sessionId,
  message,
  userId,
  onText,
}: VertexAgentChatParams): Promise<ChatMessage> {
  const token = await getTokenVertexAgent(baseUrl);
  const response = await fetch(streamQueryUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: {
        user_id: userId,
        session_id: sessionId,
        message,
      },
    }),
  });

  let rawPayload = "";
  let processedEventCount = 0;
  let latestText = "";

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        rawPayload += decoder.decode(value, { stream: true });
        const events = parseVertexChatEvents(rawPayload);

        if (events.length <= processedEventCount) {
          continue;
        }

        const nextEvents = events.slice(processedEventCount);
        processedEventCount = events.length;

        nextEvents.forEach((event) => {
          if (!isModelTextEvent(event)) {
            return;
          }

          const nextText = extractVertexResponseText(event);
          if (nextText && nextText !== latestText) {
            latestText = nextText;
            onText?.(nextText);
          }
        });
      }

      rawPayload += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  } else {
    rawPayload = await response.text().catch(() => "");
  }

  const events = parseVertexChatEvents(rawPayload);
  const finalTextEvent =
    [...events].reverse().find((event) => isModelTextEvent(event)) ?? null;
  const finalText = finalTextEvent
    ? extractVertexResponseText(finalTextEvent)
    : latestText;

  if (!response.ok || !finalTextEvent || !finalText) {
    throw new Error("Unable to parse Vertex agent response.");
  }

  if (finalText !== latestText) {
    onText?.(finalText);
  }

  return {
    id: String(finalTextEvent.id ?? `vertex-response-${Date.now()}`),
    role: "agent",
    text: finalText,
    timeLabel: formatTime(finalTextEvent.timestamp),
  };
}
