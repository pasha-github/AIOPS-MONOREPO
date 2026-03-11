"use client";

import { AGENT_ADK_BASE_URL } from "@/config/agent";
import {
  Bot,
  Check,
  Copy,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ChatAgent = {
  agentId: string;
  name: string;
};

type AgentChatWorkspaceProps = {
  agent: ChatAgent;
  onClose: () => void;
};

type AdkFunctionCall = {
  id?: string | null;
  name?: string | null;
  args?: unknown;
};

type AdkFunctionResponse = {
  id?: string | null;
  name?: string | null;
  response?: unknown;
};

type AdkPart = {
  text?: string | null;
  thought?: boolean | null;
  functionCall?: AdkFunctionCall | null;
  functionResponse?: AdkFunctionResponse | null;
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

const getRunSseUrl = () => `${ADK_BASE_URL}/run_sse`;

type StreamStep = {
  id: string;
  label: string;
  status: "running" | "done";
};

const renderMilestones = (steps: StreamStep[]) => (
  <div className="mb-3 rounded-xl border border-[#d4dcf6] bg-white/60 px-3 py-2">
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex gap-2">
          <div className="flex w-4 shrink-0 flex-col items-center">
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                step.status === "done"
                  ? "bg-[#dcfce7] text-[#16a34a]"
                  : "bg-[#e0e7ff] text-[#4f49e2]"
              }`}
            >
              {step.status === "done" ? (
                <Check className="h-2.5 w-2.5" />
              ) : (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              )}
            </span>
            {index < steps.length - 1 ? (
              <span className="mt-1 h-4 w-px bg-[#c5d0f5]" />
            ) : null}
          </div>
          <span
            className={`text-xs ${
              step.status === "done" ? "text-[#374151]" : "font-semibold text-[#1f2937]"
            }`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const mergeStreamingText = (currentText: string, incomingText: string): string => {
  if (!incomingText) {
    return currentText;
  }
  if (!currentText) {
    return incomingText;
  }
  if (incomingText.startsWith(currentText)) {
    return incomingText;
  }
  if (currentText.endsWith(incomingText)) {
    return currentText;
  }
  return `${currentText}${incomingText}`;
};

type AdkSsePayload = {
  partial?: boolean;
  error?: string;
  content?: AdkContent | null;
  actions?: {
    requestedToolConfirmations?: Record<string, unknown> | null;
  } | null;
};

const parseSsePayload = (rawData: string): AdkSsePayload | null => {
  try {
    return JSON.parse(rawData) as AdkSsePayload;
  } catch {
    return null;
  }
};

const normalizeToolName = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractVisibleTextFromParts = (parts: AdkPart[]) =>
  parts
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text ?? "")
    .join("");

const extractFunctionCallNames = (parts: AdkPart[]) =>
  parts
    .map((part) => part.functionCall?.name ?? "")
    .filter((name): name is string => Boolean(name));

const extractFunctionResponseNames = (parts: AdkPart[]) =>
  parts
    .map((part) => part.functionResponse?.name ?? "")
    .filter((name): name is string => Boolean(name));

const summarizeStreamError = (errorText: string) => {
  const compact = errorText.replace(/\s+/g, " ").trim();
  if (compact.toLowerCase().includes("reasoning_content")) {
    return "Model rejected reasoning content from a prior step. Start a new session and try again.";
  }
  if (compact.length <= 180) {
    return compact;
  }
  return "Agent failed while generating a response.";
};

const formatTime = (timestamp?: number | null) => {
  if (!timestamp || Number.isNaN(timestamp)) {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const value = timestamp > 9999999999 ? timestamp : timestamp * 1000;
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const milestonesByMessageId: Record<string, StreamStep[]> = {};
  let pendingMilestones: StreamStep[] = [];
  let stepCounter = 0;

  const addPendingMilestone = (label: string) => {
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      return;
    }
    stepCounter += 1;
    pendingMilestones.push({
      id: `history-step-${stepCounter}`,
      label: cleanLabel,
      status: "done",
    });
  };

  source.forEach((event, index) => {
    const parts = Array.isArray(event.content?.parts) ? event.content.parts : [];
    const functionCalls = extractFunctionCallNames(parts);
    const functionResponses = extractFunctionResponseNames(parts);
    functionCalls.forEach((toolName) => {
      addPendingMilestone(`Running ${normalizeToolName(toolName)}`);
    });
    functionResponses.forEach((toolName) => {
      addPendingMilestone(`Received ${normalizeToolName(toolName)} results`);
    });

    const text = extractVisibleTextFromParts(parts).trim();
    const role = normalizeRole(event);
    if (!text || !role) {
      return;
    }

    const messageId = String(event.id ?? `${role}-${index}`);
    messages.push({
      id: messageId,
      role,
      text,
      timeLabel: formatTime(event.timestamp),
    });

    if (role === "agent" && pendingMilestones.length > 0) {
      milestonesByMessageId[messageId] = pendingMilestones.map((step) => ({
        ...step,
        id: `${messageId}-${step.id}`,
      }));
      pendingMilestones = [];
    }
  });

  return {
    messages,
    milestonesByMessageId,
  };
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
  const assistantDisplayName = agent.name?.trim() || appName;
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
  const [isStreamingReply, setIsStreamingReply] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamSteps, setStreamSteps] = useState<StreamStep[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = useState<ChatMessage | null>(null);
  const [messageMilestones, setMessageMilestones] = useState<Record<string, StreamStep[]>>({});

  const [sessionsError, setSessionsError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [sendError, setSendError] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const streamStepCounterRef = useRef(0);
  const streamStepsRef = useRef<StreamStep[]>([]);
  const streamTargetTextRef = useRef("");
  const streamRenderedTextRef = useRef("");
  const streamAnimationFrameRef = useRef<number | null>(null);

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
  }, [messages, pendingUserMessage, streamingText, isSending]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      if (streamAnimationFrameRef.current) {
        window.cancelAnimationFrame(streamAnimationFrameRef.current);
      }
    };
  }, []);

  const loadSessionMessages = useCallback(
    async (sessionId: string, options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setIsLoadingMessages(true);
      }
      setMessagesError("");
      try {
        const response = await fetch(getSessionUrl(appName, userId, sessionId), {
          headers: { accept: "application/json" },
        });
        const payload = (await response.json()) as AdkSession;
        if (!response.ok) {
          if (!silent) {
            setMessages([]);
            setMessageMilestones({});
          }
          setMessagesError("Unable to load session messages.");
          return [] as ChatMessage[];
        }
        const mapped = mapEventsToMessages(payload.events);
        setMessages(mapped.messages);
        setMessageMilestones(mapped.milestonesByMessageId);
        return mapped.messages;
      } catch {
        if (!silent) {
          setMessages([]);
          setMessageMilestones({});
        }
        setMessagesError("Unable to load session messages.");
        return [] as ChatMessage[];
      } finally {
        if (!silent) {
          setIsLoadingMessages(false);
        }
      }
    },
    [appName, userId]
  );

  const loadSessions = useCallback(async (options?: { preferredSessionId?: string | null; silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setIsLoadingSessions(true);
    }
    setSessionsError("");
    try {
      const response = await fetch(getSessionsUrl(appName, userId), {
        headers: { accept: "application/json" },
      });
      const payload = (await response.json()) as AdkSession[];
      if (!response.ok || !Array.isArray(payload)) {
        if (!silent) {
          setSessions([]);
          setSelectedSessionId(null);
          setMessages([]);
          setMessageMilestones({});
        }
        setSessionsError("Unable to load sessions.");
        return [] as ChatMessage[];
      }

      const sorted = sortSessions(payload);
      setSessions(sorted);

      const selectedIdToKeep = options?.preferredSessionId ?? selectedSessionIdRef.current;
      const nextSessionId =
        sorted.find((item) => item.id === selectedIdToKeep)?.id ??
        sorted[0]?.id ??
        null;
      setSelectedSessionId(nextSessionId);
      setIsDraftSession(false);

      if (nextSessionId) {
        return await loadSessionMessages(nextSessionId, { silent });
      } else {
        if (!silent) {
          setMessages([]);
          setMessageMilestones({});
        }
        return [] as ChatMessage[];
      }
    } catch {
      if (!silent) {
        setSessions([]);
        setSelectedSessionId(null);
        setIsDraftSession(false);
        setMessages([]);
        setMessageMilestones({});
      }
      setSessionsError("Unable to load sessions.");
      return [] as ChatMessage[];
    } finally {
      if (!silent) {
        setIsLoadingSessions(false);
      }
    }
  }, [appName, userId, loadSessionMessages]);

  const resetStreamingText = useCallback(() => {
    if (streamAnimationFrameRef.current) {
      window.cancelAnimationFrame(streamAnimationFrameRef.current);
      streamAnimationFrameRef.current = null;
    }
    streamTargetTextRef.current = "";
    streamRenderedTextRef.current = "";
    setStreamingText("");
  }, []);

  const animateStreamingText = useCallback(() => {
    if (streamAnimationFrameRef.current) {
      return;
    }

    const tick = () => {
      const target = streamTargetTextRef.current;
      const current = streamRenderedTextRef.current;
      if (current === target) {
        streamAnimationFrameRef.current = null;
        return;
      }

      const remaining = Math.max(0, target.length - current.length);
      const step = Math.max(12, Math.min(220, Math.ceil(Math.max(target.length, remaining) / 35)));
      const next = target.slice(0, current.length + step);
      streamRenderedTextRef.current = next;
      setStreamingText(next);

      if (next === target) {
        streamAnimationFrameRef.current = null;
        return;
      }
      streamAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    streamAnimationFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const updateStreamingTargetText = useCallback(
    (nextText: string, options?: { immediate?: boolean }) => {
      streamTargetTextRef.current = nextText;

      if (options?.immediate) {
        if (streamAnimationFrameRef.current) {
          window.cancelAnimationFrame(streamAnimationFrameRef.current);
          streamAnimationFrameRef.current = null;
        }
        streamRenderedTextRef.current = nextText;
        setStreamingText(nextText);
        return;
      }

      animateStreamingText();
    },
    [animateStreamingText]
  );

  const startStreamingState = useCallback(() => {
    streamStepCounterRef.current = 0;
    resetStreamingText();
    const initialSteps: StreamStep[] = [];
    streamStepsRef.current = initialSteps;
    setStreamSteps(initialSteps);
    setIsStreamingReply(true);
  }, [resetStreamingText]);

  const addRunningStep = useCallback((label: string) => {
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      return;
    }

    setStreamSteps((prev) => {
      if (prev.length === 0) {
        streamStepCounterRef.current += 1;
        const created: StreamStep[] = [
          {
            id: `stream-step-${streamStepCounterRef.current}`,
            label: cleanLabel,
            status: "running",
          },
        ];
        streamStepsRef.current = created;
        return created;
      }

      const next = [...prev];
      const lastIndex = next.length - 1;
      const lastStep = next[lastIndex];

      if (lastStep.label === cleanLabel) {
        if (lastStep.status === "done") {
          next[lastIndex] = { ...lastStep, status: "running" };
        }
        return next;
      }

      if (lastStep.status === "running") {
        next[lastIndex] = { ...lastStep, status: "done" };
      }

      streamStepCounterRef.current += 1;
      next.push({
        id: `stream-step-${streamStepCounterRef.current}`,
        label: cleanLabel,
        status: "running",
      });
      streamStepsRef.current = next;
      return next;
    });
  }, []);

  const completeLastRunningStep = useCallback(() => {
    setStreamSteps((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = [...prev];
      const lastIndex = next.length - 1;
      if (next[lastIndex].status === "running") {
        next[lastIndex] = { ...next[lastIndex], status: "done" };
      }
      streamStepsRef.current = next;
      return next;
    });
  }, []);

  const processSseFrame = useCallback((frame: string): boolean => {
    const lines = frame.split("\n");
    const dataLines: string[] = [];

    lines.forEach((line) => {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    });

    const rawData = dataLines.join("\n").trim();
    if (!rawData) {
      return true;
    }
    if (rawData === "[DONE]") {
      completeLastRunningStep();
      return true;
    }

    const payload = parseSsePayload(rawData);
    if (!payload) {
      return true;
    }

    if (payload.error) {
      addRunningStep("Request failed");
      completeLastRunningStep();
      setSendError(summarizeStreamError(payload.error));
      return false;
    }

    const parts = Array.isArray(payload.content?.parts) ? payload.content.parts : [];
    const visibleText = extractVisibleTextFromParts(parts);
    const functionCalls = extractFunctionCallNames(parts);
    const functionResponses = extractFunctionResponseNames(parts);

    functionCalls.forEach((toolName) => {
      addRunningStep(`Running ${normalizeToolName(toolName)}`);
    });

    const confirmations = payload.actions?.requestedToolConfirmations;
    if (
      confirmations &&
      Object.keys(confirmations).length > 0 &&
      functionCalls.length === 0
    ) {
      addRunningStep("Awaiting tool confirmation");
    }

    functionResponses.forEach((toolName) => {
      addRunningStep(`Received ${normalizeToolName(toolName)} results`);
    });

    if (visibleText) {
      const mergedText = mergeStreamingText(streamTargetTextRef.current, visibleText);
      if (payload.partial === false) {
        updateStreamingTargetText(mergedText);
        completeLastRunningStep();
      } else {
        updateStreamingTargetText(mergedText);
      }
    } else if (payload.partial === false && functionCalls.length === 0) {
      completeLastRunningStep();
    }

    return true;
  }, [addRunningStep, completeLastRunningStep, updateStreamingTargetText]);

  const runPromptSse = useCallback(async (sessionId: string, prompt: string) => {
    const response = await fetch(getRunSseUrl(), {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appName,
        userId,
        sessionId,
        streaming: true,
        newMessage: {
          role: "user",
          parts: [{ text: prompt }],
        },
      }),
    });

    if (!response.ok || !response.body) {
      return false;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamOk = true;
    let shouldStop = false;

    while (!shouldStop) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let separatorIndex = buffer.indexOf("\n\n");

      while (separatorIndex !== -1) {
        const frame = buffer.slice(0, separatorIndex).trim();
        buffer = buffer.slice(separatorIndex + 2);
        if (frame) {
          const frameOk = processSseFrame(frame);
          if (!frameOk) {
            streamOk = false;
            shouldStop = true;
            break;
          }
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    if (shouldStop) {
      try {
        await reader.cancel();
      } catch {
        // no-op
      }
    } else {
      const tail = buffer.trim();
      if (tail) {
        const tailOk = processSseFrame(tail);
        if (!tailOk) {
          streamOk = false;
        }
      }
    }

    completeLastRunningStep();
    return streamOk;
  }, [appName, completeLastRunningStep, processSseFrame, userId]);

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
        const mapped = mapEventsToMessages(payload.events);
        setMessages(mapped.messages);
        setMessageMilestones(mapped.milestonesByMessageId);
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
    setMessageMilestones({});
    setPendingUserMessage(null);
    setIsStreamingReply(false);
    resetStreamingText();
    streamStepsRef.current = [];
    setStreamSteps([]);
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
            setMessageMilestones({});
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

  const sendPrompt = useCallback(
    async (prompt: string, options?: { optimisticUser?: boolean }) => {
      const text = prompt.trim();
      if (!text || isSending) {
        return false;
      }

      if (options?.optimisticUser) {
        setPendingUserMessage({
          id: `pending-user-${Date.now()}`,
          role: "user",
          text,
          timeLabel: formatTime(),
        });
      }

      setSendError("");
      setIsSending(true);
      startStreamingState();

      try {
        let sessionId = selectedSessionId;
        if (!sessionId) {
          sessionId = await createSession();
        }
        if (!sessionId) {
          setSendError("No session available. Create a new session first.");
          setPendingUserMessage(null);
          return false;
        }

        const streamed = await runPromptSse(sessionId, text);

        if (!streamed) {
          setSendError((prev) => prev || "Unable to send message.");
          setPendingUserMessage(null);
          return false;
        }

        await loadSessions({ preferredSessionId: sessionId, silent: true });
        setPendingUserMessage(null);
        return true;
      } catch {
        setSendError("Unable to send message.");
        setPendingUserMessage(null);
        return false;
      } finally {
        setIsSending(false);
        setIsStreamingReply(false);
        resetStreamingText();
        streamStepsRef.current = [];
        setStreamSteps([]);
      }
    },
    [
      createSession,
      isSending,
      loadSessions,
      resetStreamingText,
      runPromptSse,
      selectedSessionId,
      startStreamingState,
    ]
  );

  const sendMessage = useCallback(async () => {
    setSendError("");
    const prompt = draft.trim();
    if (!prompt || isSending) {
      return;
    }

    setDraft("");
    const sent = await sendPrompt(prompt, { optimisticUser: true });
    if (!sent) {
      setDraft(prompt);
    }
  }, [draft, isSending, sendPrompt]);

  const lastUserPrompt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        return messages[i].text;
      }
    }
    return "";
  }, [messages]);

  const retryLastPrompt = useCallback(async () => {
    if (!lastUserPrompt || isSending) {
      return;
    }
    await sendPrompt(lastUserPrompt);
  }, [isSending, lastUserPrompt, sendPrompt]);

  const copyMessage = async (messageId: string, text: string) => {
    if (!navigator?.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1400);
    } catch {
      // no-op
    }
  };

  const selectedSessionLabel = useMemo(
    () =>
      selectedSessionId
        ? selectedSessionId
        : isDraftSession
          ? "New chat"
          : "No session selected",
    [selectedSessionId, isDraftSession]
  );

  const visibleMessages = useMemo(() => {
    if (!pendingUserMessage) {
      return messages;
    }
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user" && lastMessage.text === pendingUserMessage.text) {
      return messages;
    }
    return [...messages, pendingUserMessage];
  }, [messages, pendingUserMessage]);

  const isInitialSessionView =
    !isLoadingMessages && !isStreamingReply && visibleMessages.length === 0;

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
            className={`soft-scrollbar flex-1 ${
              isInitialSessionView
                ? "overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,#eef2ff_0%,#f7f8fc_45%,#f7f8fc_100%)] px-8 py-8"
                : "space-y-4 overflow-y-auto bg-[#f7f8fc] px-6 py-5"
            }`}
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
            ) : isInitialSessionView ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-4xl -translate-y-10">
                  <h3 className="mb-8 text-center text-4xl font-semibold tracking-tight text-[#111827]">
                    What&apos;s on the agenda today?
                  </h3>
                  <div className="rounded-[2rem] border border-[#dbe2f0] bg-white p-5 shadow-[0_24px_60px_-42px_rgba(16,24,40,0.35)]">
                    <input
                      type="text"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.nativeEvent as KeyboardEvent).isComposing) {
                          return;
                        }
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Ask anything"
                      className="w-full bg-transparent text-3xl text-[#111827] outline-none placeholder:text-[#9ca3af]"
                    />
                    <div className="mt-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#f3f4f6]"
                          aria-label="Add"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Voice"
                          title="Voice"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e1e5ef] bg-white text-[#6b7280] transition hover:bg-[#f3f4f6]"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void sendMessage()}
                          disabled={isSending || draft.trim().length === 0}
                          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#4f49e2] text-white shadow-[0_14px_30px_-18px_rgba(79,73,226,0.7)] transition hover:bg-[#433ccf] disabled:cursor-not-allowed disabled:opacity-45"
                          aria-label="Send"
                          title="Send"
                        >
                          <Send className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {sendError ? (
                    <p className="mt-3 text-center text-xs font-semibold text-[#b91c1c]">{sendError}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                {visibleMessages.length === 0 && !isStreamingReply ? (
                  <p className="text-sm text-[#6b7280]">
                    No messages yet. Start the conversation.
                  </p>
                ) : null}

                {visibleMessages.map((message) => {
                  const isUser = message.role === "user";
                  const milestones = !isUser ? messageMilestones[message.id] ?? [] : [];
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
                        <div className="mb-1 flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold text-[#8a94a6]">
                          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                          <span>{isUser ? "user" : assistantDisplayName}</span>
                          <span className="text-[#b6bfce]">|</span>
                          <span>{message.timeLabel}</span>
                        </div>
                        {!isUser && milestones.length > 0 ? renderMilestones(milestones) : null}
                        <div className="space-y-3 break-words">
                          {renderMarkdownBlocks(message.text)}
                        </div>
                        {!isUser ? (
                          <div className="mt-3 flex items-center gap-1 text-[#7b8497]">
                            <button
                              type="button"
                              onClick={() => void copyMessage(message.id, message.text)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/65"
                              aria-label="Copy response"
                              title="Copy response"
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="h-4 w-4 text-[#16a34a]" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/65"
                              aria-label="Thumbs up"
                              title="Thumbs up"
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/65"
                              aria-label="Thumbs down"
                              title="Thumbs down"
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void retryLastPrompt()}
                              disabled={!lastUserPrompt || isSending}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Retry"
                              title="Retry"
                            >
                              <RotateCcw className={`h-4 w-4 ${isSending ? "animate-spin" : ""}`} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {isStreamingReply ? (
                  <div className="flex justify-start">
                    <div className="max-w-[78%] rounded-2xl bg-[#e9edff] px-4 py-3 text-sm text-[#1f2937] shadow-sm">
                      <div className="mb-1 flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold text-[#8a94a6]">
                        <Bot className="h-3.5 w-3.5" />
                        <span>{assistantDisplayName}</span>
                        <span className="text-[#b6bfce]">|</span>
                        <span>{formatTime()}</span>
                      </div>

                      {streamSteps.length > 0 ? renderMilestones(streamSteps) : null}

                      <div className="space-y-3 break-words">
                        {streamingText ? (
                          renderMarkdownBlocks(streamingText)
                        ) : (
                          <p className="text-sm text-[#6b7280]">Processing...</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {!isInitialSessionView ? (
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
                    if ((event.nativeEvent as KeyboardEvent).isComposing) {
                      return;
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ask Anything"
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
          ) : null}
        </section>
      </div>
    </div>
  );
}
