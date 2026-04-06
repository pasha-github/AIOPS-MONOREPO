import type { ReactNode } from "react";

const DEFAULT_LOGS_API_BASE =
  "https://agent-manager-428716175586.us-central1.run.app/agent-server";
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
    args?: {
      request?: string;
    };
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
};

export type AgentSessionDetail = {
  id: string;
  summary: string;
  updatedAt: number;
  updatedAtLabel: string;
  entries: AgentLogEntry[];
};

const getSessionsUrl = (baseUrl = DEFAULT_LOGS_API_BASE) =>
  `${baseUrl}/apps/${encodeURIComponent(DEFAULT_APP_NAME)}/users/${encodeURIComponent(
    DEFAULT_USER_ID
  )}/sessions`;

const getSessionDetailUrl = (sessionId: string, baseUrl = DEFAULT_LOGS_API_BASE) =>
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

export async function fetchAgentSessions(
  signal?: AbortSignal,
  baseUrl = DEFAULT_LOGS_API_BASE
) {
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
  baseUrl = DEFAULT_LOGS_API_BASE
) {
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

const renderMarkdownInline = (text: string, keyPrefix = ""): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];
    const start = match.index;
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`md-${keyPrefix}-${key++}`}>{token.slice(2, -2)}</strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={`md-${keyPrefix}-${key++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`md-${keyPrefix}-${key++}`}
          className="rounded bg-black/5 px-1 py-0.5 text-[0.95em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`md-${keyPrefix}-${key++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-[#3b5bdb] underline"
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

const renderInlineWithLineBreaks = (lines: string[], keyPrefix: string): ReactNode[] =>
  lines.flatMap((line, index) => {
    const nodes = renderMarkdownInline(line, `${keyPrefix}-line-${index}`);
    if (index < lines.length - 1) {
      return [...nodes, <br key={`${keyPrefix}-br-${index}`} />];
    }
    return nodes;
  });

const parseTableRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const isTableSeparatorLine = (line: string): boolean => {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

const isHeadingLine = (line: string) => /^(#{1,6})\s+.+$/.test(line.trim());
const isUnorderedListLine = (line: string) => /^[-*]\s+.+$/.test(line.trim());
const isOrderedListLine = (line: string) => /^\d+\.\s+.+$/.test(line.trim());
const isHrLine = (line: string) => /^(\*\*\*|---|___)\s*$/.test(line.trim());
const isCodeFenceLine = (line: string) => line.trim().startsWith("```");

export const renderMarkdownBlocks = (text: string): ReactNode[] => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (isCodeFenceLine(trimmed)) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !isCodeFenceLine(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && isCodeFenceLine(lines[i])) {
        i += 1;
      }
      blocks.push(
        <pre
          key={`block-code-${i}`}
          className="overflow-x-auto rounded-xl bg-black/90 px-3 py-2 text-xs text-white"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const hashes = headingMatch[1].length;
      const headingText = headingMatch[2];
      const content = renderMarkdownInline(headingText, `heading-${i}`);
      if (hashes === 1) {
        blocks.push(
          <h1 key={`block-h1-${i}`} className="text-xl font-bold leading-8">
            {content}
          </h1>
        );
      } else if (hashes === 2) {
        blocks.push(
          <h2 key={`block-h2-${i}`} className="text-lg font-bold leading-7">
            {content}
          </h2>
        );
      } else {
        blocks.push(
          <h3 key={`block-hx-${i}`} className="text-base font-semibold leading-6">
            {content}
          </h3>
        );
      }
      i += 1;
      continue;
    }

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const headers = parseTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i];
        if (!rowLine.trim() || !rowLine.includes("|")) {
          break;
        }
        rows.push(parseTableRow(rowLine));
        i += 1;
      }

      blocks.push(
        <div
          key={`block-table-${i}`}
          className="overflow-x-auto rounded-xl border border-[#dbe2f0] bg-white/70"
        >
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-[#eef2ff] text-[#1f2937]">
              <tr>
                {headers.map((header, headerIndex) => (
                  <th
                    key={`table-head-${i}-${headerIndex}`}
                    className="border-b border-[#dbe2f0] px-3 py-2 font-semibold"
                  >
                    {renderMarkdownInline(header, `table-head-${i}-${headerIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={`table-row-${i}-${rowIndex}`}
                  className="border-b border-[#e8edf7]"
                >
                  {headers.map((_, colIndex) => (
                    <td
                      key={`table-col-${i}-${rowIndex}-${colIndex}`}
                      className="px-3 py-2 align-top"
                    >
                      {renderMarkdownInline(
                        row[colIndex] ?? "",
                        `table-cell-${i}-${rowIndex}-${colIndex}`
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (isUnorderedListLine(line)) {
      const listItems: string[] = [];
      while (i < lines.length && isUnorderedListLine(lines[i])) {
        listItems.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`block-ul-${i}`} className="list-disc space-y-1 pl-5">
          {listItems.map((item, itemIndex) => (
            <li key={`ul-item-${i}-${itemIndex}`}>
              {renderMarkdownInline(item, `ul-${i}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (isOrderedListLine(line)) {
      const listItems: string[] = [];
      while (i < lines.length && isOrderedListLine(lines[i])) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`block-ol-${i}`} className="list-decimal space-y-1 pl-5">
          {listItems.map((item, itemIndex) => (
            <li key={`ol-item-${i}-${itemIndex}`}>
              {renderMarkdownInline(item, `ol-${i}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (isHrLine(line)) {
      blocks.push(<hr key={`block-hr-${i}`} className="border-[#dbe2f0]" />);
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i];
      const currentTrim = current.trim();
      const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
      if (
        !currentTrim ||
        isHeadingLine(current) ||
        isUnorderedListLine(current) ||
        isOrderedListLine(current) ||
        isHrLine(current) ||
        isCodeFenceLine(current) ||
        (current.includes("|") && isTableSeparatorLine(nextLine))
      ) {
        break;
      }
      paragraphLines.push(current);
      i += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(
        <p key={`block-p-${i}`} className="leading-7">
          {renderInlineWithLineBreaks(paragraphLines, `p-${i}`)}
        </p>
      );
      continue;
    }

    i += 1;
  }

  return blocks;
};
