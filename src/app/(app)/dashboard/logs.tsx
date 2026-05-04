import { trimTrailingSlash } from "@/config/agent";
import type { ReactNode } from "react";

const DEFAULT_APP_NAME = "automation";
const DEFAULT_USER_ID = "user";
const TRUNCATED_SUFFIX = ".....";

type SessionState = {
  first_message_summary?: string;
};

type SessionSummaryResponse = {
  id?: string;
  appName?: string;
  userId?: string;
  state?: SessionState;
  lastUpdateTime?: number;
};

type EventPart = {
  text?: string;
  functionCall?: {
    name?: string;
    args?: {
      request?: string;
      [key: string]: unknown;
    };
  };
  functionResponse?: {
    name?: string;
    response?: unknown;
  };
};

type SessionEvent = {
  id?: string;
  author?: string;
  timestamp?: number;
  content?: {
    parts?: EventPart[];
  };
};

type SessionDetailResponse = SessionSummaryResponse & {
  events?: SessionEvent[];
};

export type AgentSessionSummary = {
  id: string;
  summary: string;
  updatedAt: number;
  updatedAtLabel: string;
};

export type AgentLogEntry = {
  id: string;
  title: string;
  authorLabel: string;
  timestamp: number;
  timestampLabel: string;
  text: string;
  preview: string;
  isTruncated: boolean;
  source: "text" | "request";
  tools: {
    id: string;
    name: string;
    label: string;
    kind: "call" | "response";
    payload: unknown;
  }[];
};

export type AgentSessionDetail = {
  id: string;
  summary: string;
  updatedAt: number;
  updatedAtLabel: string;
  entries: AgentLogEntry[];
};

export const resolveLogsApiBase = (baseUrl: string) => {
  const trimmed = trimTrailingSlash(baseUrl.trim());
  if (!trimmed) {
    throw new Error("NEXT_PUBLIC_AGENT_ADK_BASE_URL is not configured.");
  }

  return trimmed.endsWith("/agent-server")
    ? trimmed
    : `${trimmed}/agent-server`;
};

const getSessionsUrl = (baseUrl: string) =>
  `${baseUrl}/apps/${encodeURIComponent(DEFAULT_APP_NAME)}/users/${encodeURIComponent(
    DEFAULT_USER_ID
  )}/sessions`;

const getSessionDetailUrl = (sessionId: string, baseUrl: string) =>
  `${getSessionsUrl(baseUrl)}/${encodeURIComponent(sessionId)}`;

const getNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const getTrimmedText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const formatTimestamp = (value: number, options?: Intl.DateTimeFormatOptions) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(options ?? {}),
  }).format(new Date(value * 1000));
};

const truncateText = (value: string, limit = 220) => {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) {
    return {
      preview: collapsed,
      isTruncated: false,
    };
  }

  return {
    preview: `${collapsed.slice(0, limit).trimEnd()}${TRUNCATED_SUFFIX}`,
    isTruncated: true,
  };
};

const getAuthorLabel = (author: string, source: AgentLogEntry["source"]) => {
  const normalized = author.trim().toLowerCase();
  if (source === "request") {
    return "Tool request";
  }
  if (normalized === "user") {
    return "Trigger message";
  }
  if (normalized.includes("agent")) {
    return "Agent response";
  }
  return "Agent log";
};

const normalizeToolName = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sortSessions = (sessions: AgentSessionSummary[]) =>
  [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function deleteJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: "DELETE",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

export async function fetchAgentSessions(
  signal?: AbortSignal,
  baseUrl = ""
) {
  if (!baseUrl) {
    throw new Error("Agent logs API base URL is not configured.");
  }

  const payload = await fetchJson<SessionSummaryResponse[]>(
    getSessionsUrl(baseUrl),
    signal
  );

  const sessions = Array.isArray(payload)
    ? payload
        .map((item) => {
          const id = getTrimmedText(item?.id);
          if (!id) {
            return null;
          }

          const updatedAt = getNumber(item?.lastUpdateTime);
          const summary =
            getTrimmedText(item?.state?.first_message_summary) || "Untitled session";

          return {
            id,
            summary,
            updatedAt,
            updatedAtLabel: formatTimestamp(updatedAt),
          } satisfies AgentSessionSummary;
        })
        .filter((item): item is AgentSessionSummary => item !== null)
    : [];

  return sortSessions(sessions);
}

export async function fetchAgentSessionDetail(
  sessionId: string,
  signal?: AbortSignal,
  baseUrl = ""
) {
  if (!baseUrl) {
    throw new Error("Agent logs API base URL is not configured.");
  }

  const payload = await fetchJson<SessionDetailResponse>(
    getSessionDetailUrl(sessionId, baseUrl),
    signal
  );

  const updatedAt = getNumber(payload?.lastUpdateTime);
  const summary =
    getTrimmedText(payload?.state?.first_message_summary) || "Untitled session";
  const rawEvents = Array.isArray(payload?.events) ? payload.events : [];

  const entries = rawEvents.flatMap((event, eventIndex) => {
    const timestamp = getNumber(event?.timestamp);
    const parts = Array.isArray(event?.content?.parts) ? event.content.parts : [];
    const author = getTrimmedText(event?.author) || "agent";
    const tools = parts.flatMap((part, partIndex) => {
      const functionCallName = getTrimmedText(part?.functionCall?.name);
      const functionResponseName = getTrimmedText(part?.functionResponse?.name);
      const items: AgentLogEntry["tools"] = [];

      if (functionCallName) {
        items.push({
          id: `${event?.id ?? eventIndex}-tool-call-${partIndex}`,
          name: functionCallName,
          label: `Running ${normalizeToolName(functionCallName)}`,
          kind: "call",
          payload: part?.functionCall?.args ?? {},
        });
      }

      if (functionResponseName) {
        items.push({
          id: `${event?.id ?? eventIndex}-tool-response-${partIndex}`,
          name: functionResponseName,
          label: `Received ${normalizeToolName(functionResponseName)} results`,
          kind: "response",
          payload: part?.functionResponse?.response ?? {},
        });
      }

      return items;
    });

    return parts.flatMap((part, partIndex) => {
      const items: AgentLogEntry[] = [];
      const text = getTrimmedText(part?.text);
      const request = getTrimmedText(part?.functionCall?.args?.request);

      if (text) {
        const { preview, isTruncated } = truncateText(text);
        items.push({
          id: `${event?.id ?? eventIndex}-text-${partIndex}`,
          title: "Agent Log",
          authorLabel: getAuthorLabel(author, "text"),
          timestamp,
          timestampLabel: formatTimestamp(timestamp, {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
          }),
          text,
          preview,
          isTruncated,
          source: "text",
          tools,
        });
      }

      if (request) {
        const { preview, isTruncated } = truncateText(request);
        items.push({
          id: `${event?.id ?? eventIndex}-request-${partIndex}`,
          title: "Agent Request",
          authorLabel: getAuthorLabel(author, "request"),
          timestamp,
          timestampLabel: formatTimestamp(timestamp, {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
          }),
          text: request,
          preview,
          isTruncated,
          source: "request",
          tools,
        });
      }

      return items;
    });
  });

  const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  return {
    id: getTrimmedText(payload?.id) || sessionId,
    summary,
    updatedAt,
    updatedAtLabel: formatTimestamp(updatedAt),
    entries: sortedEntries,
  } satisfies AgentSessionDetail;
}

export async function deleteAgentSession(
  sessionId: string,
  signal?: AbortSignal,
  baseUrl = ""
) {
  if (!baseUrl) {
    throw new Error("Agent logs API base URL is not configured.");
  }

  await deleteJson(getSessionDetailUrl(sessionId, baseUrl), signal);
}

const renderMarkdownInline = (text: string, keyPrefix = ""): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    const token = match[0];
    const start = match.index;

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`md-${keyPrefix}-${key++}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`md-${keyPrefix}-${key++}`}>
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`md-${keyPrefix}-${key++}`}
          className="rounded bg-black/5 px-1 py-0.5 text-[0.95em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      token.startsWith("[") &&
      token.includes("](") &&
      token.endsWith(")")
    ) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`md-${keyPrefix}-${key++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }

    cursor = start + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
};

export const renderMarkdownBlocks = (text: string): ReactNode[] => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Code Block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }

      if (i < lines.length) i++;

      blocks.push(
        <pre
          key={`block-code-${i}`}
          className="overflow-x-auto rounded-xl bg-black text-white px-3 py-2 text-xs"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];

      const Tag = `h${Math.min(level, 3)}` as keyof HTMLElementTagNameMap;

      blocks.push(
        <Tag key={`block-h-${i}`} className="font-semibold">
          {renderMarkdownInline(content, `heading-${i}`)}
        </Tag>
      );

      i++;
      continue;
    }

    //Unordered List
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }

      blocks.push(
        <ul key={`block-ul-${i}`} className="list-disc pl-5 space-y-1">
          {items.map((item, index) => (
            <li key={index}>
              {renderMarkdownInline(item, `ul-${i}-${index}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    //Ordered List
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];

      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }

      blocks.push(
        <ol key={`block-ol-${i}`} className="list-decimal pl-5 space-y-1">
          {items.map((item, index) => (
            <li key={index}>
              {renderMarkdownInline(item, `ol-${i}-${index}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    //Paragraph
    const paragraphLines: string[] = [];

    while (i < lines.length && lines[i].trim()) {
      paragraphLines.push(lines[i]);
      i++;
    }

    blocks.push(
      <p key={`block-p-${i}`} className="leading-7">
        {paragraphLines.map((line, index) => (
          <span key={index}>
            {renderMarkdownInline(line, `p-${i}-${index}`)}
            {index < paragraphLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return blocks;
};