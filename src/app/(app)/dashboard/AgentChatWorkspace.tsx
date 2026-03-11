"use client";

import { AGENT_ADK_BASE_URL } from "@/config/agent";
import {
  Bot,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type ChatAgent = {
  agentId: string;
  name: string;
};

type AgentChatWorkspaceProps = {
  agent: ChatAgent;
  onClose: () => void;
};

type AdkPart = {
  text?: string | null;
};

type AdkContent = {
  role?: string | null;
  parts?: AdkPart[] | null;
};

type AdkEvent = {
  id?: string | null;
  timestamp?: number | null;
  author?: string | null;
  content?: AdkContent | null;
};

type AdkSession = {
  id: string;
  appName?: string | null;
  userId?: string | null;
  events?: AdkEvent[] | null;
  lastUpdateTime?: number | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  timeLabel: string;
};

const DEFAULT_USER_ID = "user";

const ADK_BASE_URL = AGENT_ADK_BASE_URL.endsWith("/")
  ? AGENT_ADK_BASE_URL.slice(0, -1)
  : AGENT_ADK_BASE_URL;

const getSessionsUrl = (appName: string, userId: string) =>
  `${ADK_BASE_URL}/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(
    userId
  )}/sessions`;

const getSessionUrl = (appName: string, userId: string, sessionId: string) =>
  `${getSessionsUrl(appName, userId)}/${encodeURIComponent(sessionId)}`;

const getRunUrl = () => `${ADK_BASE_URL}/run`;

const formatTime = (timestamp?: number | null) => {
  if (!timestamp || Number.isNaN(timestamp)) {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const value = timestamp > 9999999999 ? timestamp : timestamp * 1000;
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const extractText = (event: AdkEvent) => {
  const parts = event.content?.parts ?? [];
  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
  return text;
};

const normalizeRole = (event: AdkEvent): ChatMessage["role"] | null => {
  const contentRole = String(event.content?.role ?? "").toLowerCase();
  if (contentRole === "user") {
    return "user";
  }
  if (contentRole === "model") {
    return "agent";
  }
  const author = String(event.author ?? "").toLowerCase();
  if (author.includes("user")) {
    return "user";
  }
  if (author) {
    return "agent";
  }
  return null;
};

const mapEventsToMessages = (events: AdkEvent[] | null | undefined) => {
  const source = Array.isArray(events) ? events : [];
  const messages: ChatMessage[] = [];

  source.forEach((event, index) => {
    const text = extractText(event);
    const role = normalizeRole(event);
    if (!text || !role) {
      return;
    }
    messages.push({
      id: String(event.id ?? `${role}-${index}`),
      role,
      text,
      timeLabel: formatTime(event.timestamp),
    });
  });

  return messages;
};

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

const renderMarkdownBlocks = (text: string): ReactNode[] => {
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
        <div key={`block-table-${i}`} className="overflow-x-auto rounded-xl border border-[#dbe2f0] bg-white/70">
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
                <tr key={`table-row-${i}-${rowIndex}`} className="border-b border-[#e8edf7]">
                  {headers.map((_, colIndex) => (
                    <td key={`table-col-${i}-${rowIndex}-${colIndex}`} className="px-3 py-2 align-top">
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

const sortSessions = (sessions: AdkSession[]) =>
  [...sessions].sort((a, b) => {
    const aTime = Number(a.lastUpdateTime ?? 0);
    const bTime = Number(b.lastUpdateTime ?? 0);
    return bTime - aTime;
  });

export default function AgentChatWorkspace({
  agent,
  onClose,
}: AgentChatWorkspaceProps) {
  const appName = agent.agentId;
  const userId = DEFAULT_USER_ID;

  const [sessions, setSessions] = useState<AdkSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isDraftSession, setIsDraftSession] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [sessionsError, setSessionsError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [sendError, setSendError] = useState("");

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-session-menu='true']")) {
        return;
      }
      setOpenMenuSessionId(null);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages, isSending]);

  const loadSessionMessages = useCallback(
    async (sessionId: string) => {
      setIsLoadingMessages(true);
      setMessagesError("");
      try {
        const response = await fetch(getSessionUrl(appName, userId, sessionId), {
          headers: { accept: "application/json" },
        });
        const payload = (await response.json()) as AdkSession;
        if (!response.ok) {
          setMessages([]);
          setMessagesError("Unable to load session messages.");
          return;
        }
        setMessages(mapEventsToMessages(payload.events));
      } catch {
        setMessages([]);
        setMessagesError("Unable to load session messages.");
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [appName, userId]
  );

  const loadSessions = useCallback(async (preferredSessionId?: string | null) => {
    setIsLoadingSessions(true);
    setSessionsError("");
    try {
      const response = await fetch(getSessionsUrl(appName, userId), {
        headers: { accept: "application/json" },
      });
      const payload = (await response.json()) as AdkSession[];
      if (!response.ok || !Array.isArray(payload)) {
        setSessions([]);
        setSelectedSessionId(null);
        setMessages([]);
        setSessionsError("Unable to load sessions.");
        return;
      }

      const sorted = sortSessions(payload);
      setSessions(sorted);

      const selectedIdToKeep = preferredSessionId ?? selectedSessionIdRef.current;
      const nextSessionId =
        sorted.find((item) => item.id === selectedIdToKeep)?.id ??
        sorted[0]?.id ??
        null;
      setSelectedSessionId(nextSessionId);
      setIsDraftSession(false);

      if (nextSessionId) {
        await loadSessionMessages(nextSessionId);
      } else {
        setMessages([]);
      }
    } catch {
      setSessions([]);
      setSelectedSessionId(null);
      setIsDraftSession(false);
      setMessages([]);
      setSessionsError("Unable to load sessions.");
    } finally {
      setIsLoadingSessions(false);
    }
  }, [appName, userId, loadSessionMessages]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(
    async () => {
      setSessionsError("");
      try {
        const response = await fetch(getSessionsUrl(appName, userId), {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const payload = (await response.json()) as AdkSession;
        if (!response.ok || !payload?.id) {
          setSessionsError("Unable to create session.");
          return null;
        }

        setSessions((prev) => sortSessions([payload, ...prev.filter((item) => item.id !== payload.id)]));
        setSelectedSessionId(payload.id);
        setIsDraftSession(false);
        setMessages(mapEventsToMessages(payload.events));
        return payload.id;
      } catch {
        setSessionsError("Unable to create session.");
        return null;
      }
    },
    [appName, userId]
  );

  const startNewChat = () => {
    setSelectedSessionId(null);
    setIsDraftSession(true);
    setOpenMenuSessionId(null);
    setMessages([]);
    setMessagesError("");
    setSendError("");
    setDraft("");
  };

  const deleteSession = useCallback(
    async (sessionId: string) => {
      setDeletingSessionId(sessionId);
      setSessionsError("");
      try {
        const response = await fetch(getSessionUrl(appName, userId, sessionId), {
          method: "DELETE",
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          setSessionsError("Unable to delete session.");
          return;
        }

        const nextSessions = sessions.filter((item) => item.id !== sessionId);
        setSessions(nextSessions);
        setOpenMenuSessionId(null);
        if (selectedSessionId === sessionId) {
          const nextId = nextSessions[0]?.id ?? null;
          setSelectedSessionId(nextId);
          setIsDraftSession(false);
          if (nextId) {
            await loadSessionMessages(nextId);
          } else {
            setMessages([]);
          }
        }
      } catch {
        setSessionsError("Unable to delete session.");
      } finally {
        setDeletingSessionId(null);
      }
    },
    [appName, userId, sessions, selectedSessionId, loadSessionMessages]
  );

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }

    setSendError("");
    setIsSending(true);

    try {
      let sessionId = selectedSessionId;
      if (!sessionId) {
        sessionId = await createSession();
      }
      if (!sessionId) {
        setSendError("No session available. Create a new session first.");
        return;
      }

      const response = await fetch(getRunUrl(), {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appName,
          userId,
          sessionId,
          streaming: false,
          newMessage: {
            role: "user",
            parts: [{ text }],
          },
        }),
      });

      if (!response.ok) {
        setSendError("Unable to send message.");
        return;
      }

      setDraft("");
      await loadSessionMessages(sessionId);
      await loadSessions(sessionId);
    } catch {
      setSendError("Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }, [appName, createSession, draft, isSending, loadSessionMessages, loadSessions, selectedSessionId, userId]);

  const selectedSessionLabel = useMemo(
    () =>
      selectedSessionId
        ? selectedSessionId
        : isDraftSession
          ? "New chat"
          : "No session selected",
    [selectedSessionId, isDraftSession]
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
      <div className="flex h-[88vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.7)]">
        <aside className="flex h-full min-h-0 w-[290px] shrink-0 flex-col border-r border-[#e8ecf4] bg-[#f9fbff]">
          <div className="border-b border-[#e8ecf4] p-4">
            <button
              type="button"
              onClick={startNewChat}
              disabled={isSending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Plus className="h-4 w-4" />
              New session
            </button>
            <p className="mt-3 text-xs text-[#6b7280]">User ID: {userId}</p>
          </div>

          <div className="soft-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
            {isLoadingSessions ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`session-skeleton-${index}`}
                    className="flex items-start gap-2 rounded-xl border border-[#e8ecf4] bg-white px-3 py-3 animate-pulse"
                  >
                    <span className="mt-0.5 h-4 w-4 rounded bg-[#edf2f9]" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-11/12 rounded bg-[#edf2f9]" />
                      <div className="h-3 w-7/12 rounded bg-[#edf2f9]" />
                    </div>
                    <span className="h-6 w-6 rounded-full bg-[#edf2f9]" />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="px-2 py-3 text-sm text-[#6b7280]">No sessions yet.</p>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === selectedSessionId;
                return (
                  <div
                    key={session.id}
                    className={`mb-2 rounded-xl border px-3 py-2 ${
                      isActive
                        ? "border-[#c9d1ff] bg-[#eef2ff]"
                        : "border-[#e8ecf4] bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSessionId(session.id);
                          setIsDraftSession(false);
                          setOpenMenuSessionId(null);
                          void loadSessionMessages(session.id);
                        }}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      >
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#4f49e2]" />
                        <span className="line-clamp-2 text-xs font-semibold text-[#1f2937]">
                          {session.id}
                        </span>
                      </button>
                      <div className="relative" data-session-menu="true">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuSessionId((prev) =>
                              prev === session.id ? null : session.id
                            )
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#eef2ff] hover:text-[#4f49e2]"
                          aria-label="Session actions"
                          title="Session actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openMenuSessionId === session.id ? (
                          <div className="absolute right-0 z-20 mt-1 w-28 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
                            <button
                              type="button"
                              onClick={() => void deleteSession(session.id)}
                              disabled={deletingSessionId === session.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#b91c1c] hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {sessionsError ? (
            <p className="border-t border-[#e8ecf4] px-3 py-2 text-xs text-[#b91c1c]">
              {sessionsError}
            </p>
          ) : null}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[#eef1f7] px-6 py-4">
            <div className="min-w-0">
              <h4 className="truncate text-lg font-semibold text-[#111827]">{agent.name}</h4>
              <p className="truncate text-sm text-[#6b7280]">
                App name: <span className="font-semibold">{appName}</span> | {selectedSessionLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#111827]"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={messageListRef}
            className="soft-scrollbar flex-1 space-y-4 overflow-y-auto bg-[#f7f8fc] px-6 py-5"
          >
            {isLoadingMessages ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => {
                  const isUserSkeleton = index % 2 === 1;
                  return (
                    <div
                      key={`message-skeleton-${index}`}
                      className={`flex ${
                        isUserSkeleton ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div className="max-w-[78%] rounded-2xl border border-[#dbe2f0] bg-white px-4 py-3 animate-pulse">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-[#edf2f9]" />
                          <span className="h-3 w-20 rounded bg-[#edf2f9]" />
                          <span className="h-3 w-14 rounded bg-[#edf2f9]" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 w-full rounded bg-[#edf2f9]" />
                          <div className="h-3 w-5/6 rounded bg-[#edf2f9]" />
                          <div className="h-3 w-2/3 rounded bg-[#edf2f9]" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-[#6b7280]">
                No messages yet. Start the conversation.
              </p>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        isUser
                          ? "border border-[#dbe2f0] bg-white text-[#111827]"
                          : "bg-[#e9edff] text-[#1f2937]"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-[#8a94a6]">
                        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                        <span>{isUser ? "user" : appName}</span>
                        <span className="text-[#b6bfce]">|</span>
                        <span>{message.timeLabel}</span>
                      </div>
                      <div className="space-y-3 break-words">
                        {renderMarkdownBlocks(message.text)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <footer className="border-t border-[#eef1f7] bg-white px-6 py-4">
            {messagesError ? (
              <p className="mb-2 text-xs font-semibold text-[#b91c1c]">{messagesError}</p>
            ) : null}
            {sendError ? (
              <p className="mb-2 text-xs font-semibold text-[#b91c1c]">{sendError}</p>
            ) : null}

            <div className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-[#f7f8fc] px-4 py-3">
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Message the agent..."
                className="flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9ca3af]"
              />
              <button
                type="button"
                aria-label="Voice"
                title="Voice"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e1e5ef] bg-white text-[#6b7280]"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={isSending || draft.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send"}
                <Send className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
