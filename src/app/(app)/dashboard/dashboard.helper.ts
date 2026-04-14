import {
  AgentSessionDetail,
  AgentLogEntry,
  AgentSessionSummary,
  SessionSummaryResponse,
  SessionDetailResponse,
} from "./dashboard.types";

const DEFAULT_LOGS_API_BASE =
  "https://agent-manager-428716175586.us-central1.run.app/agent-server";

const DEFAULT_APP_NAME = "automation";
const DEFAULT_USER_ID = "user";
const TRUNCATED_SUFFIX = ".....";

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
  if (!Number.isFinite(value) || value <= 0) return "Unknown time";

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
    return { preview: collapsed, isTruncated: false };
  }

  return {
    preview: `${collapsed.slice(0, limit).trimEnd()}${TRUNCATED_SUFFIX}`,
    isTruncated: true,
  };
};

const getAuthorLabel = (author: string, source: AgentLogEntry["source"]) => {
  const normalized = author.trim().toLowerCase();

  if (source === "request") return "Tool request";
  if (normalized === "user") return "Trigger message";
  if (normalized.includes("agent")) return "Agent response";

  return "Agent log";
};

const sortSessions = (sessions: AgentSessionSummary[]) =>
  [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  return (await res.json()) as T;
}

// Fetch Sessions
export async function fetchAgentSessions(
  signal?: AbortSignal,
  baseUrl = DEFAULT_LOGS_API_BASE
) {
  const payload = await fetchJson<SessionSummaryResponse[]>(
    getSessionsUrl(baseUrl),
    signal
  );

  const sessions = (payload || [])
    .map((item) => {
      const id = getTrimmedText(item?.id);
      if (!id) return null;

      const updatedAt = getNumber(item?.lastUpdateTime);
      const summary =
        getTrimmedText(item?.state?.first_message_summary) || "Untitled session";

      return {
        id,
        summary,
        updatedAt,
        updatedAtLabel: formatTimestamp(updatedAt),
      } as AgentSessionSummary;
    })
    .filter(Boolean) as AgentSessionSummary[];

  return sortSessions(sessions);
}

// Fetch Session Detail
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
    const parts = event?.content?.parts || [];
    const author = getTrimmedText(event?.author) || "agent";

    return parts.flatMap((part: any, partIndex: number) => {
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

  return {
    id: getTrimmedText(payload?.id) || sessionId,
    summary,
    updatedAt,
    updatedAtLabel: formatTimestamp(updatedAt),
    entries: entries.sort((a, b) => b.timestamp - a.timestamp),
  } as AgentSessionDetail;
}
