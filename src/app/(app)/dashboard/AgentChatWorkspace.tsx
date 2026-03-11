"use client";

import { AGENT_ADK_BASE_URL } from "@/config/agent";
import { Bot, MessageSquare, Plus, Send, Trash2, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [sessionsError, setSessionsError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [sendError, setSendError] = useState("");

  const messageListRef = useRef<HTMLDivElement | null>(null);

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

  const loadSessions = useCallback(async () => {
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

      const nextSessionId =
        sorted.find((item) => item.id === selectedSessionId)?.id ?? sorted[0]?.id ?? null;
      setSelectedSessionId(nextSessionId);

      if (nextSessionId) {
        await loadSessionMessages(nextSessionId);
      } else {
        setMessages([]);
      }
    } catch {
      setSessions([]);
      setSelectedSessionId(null);
      setMessages([]);
      setSessionsError("Unable to load sessions.");
    } finally {
      setIsLoadingSessions(false);
    }
  }, [appName, userId, selectedSessionId, loadSessionMessages]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(
    async (forceSessionId?: string) => {
      setIsCreatingSession(true);
      setSessionsError("");
      try {
        const generatedId =
          forceSessionId ?? `session-${Math.floor(Date.now() / 1000)}`;
        const response = await fetch(getSessionsUrl(appName, userId), {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: generatedId }),
        });
        const payload = (await response.json()) as AdkSession;
        if (!response.ok || !payload?.id) {
          setSessionsError("Unable to create session.");
          return null;
        }

        setSessions((prev) => sortSessions([payload, ...prev.filter((item) => item.id !== payload.id)]));
        setSelectedSessionId(payload.id);
        setMessages(mapEventsToMessages(payload.events));
        return payload.id;
      } catch {
        setSessionsError("Unable to create session.");
        return null;
      } finally {
        setIsCreatingSession(false);
      }
    },
    [appName, userId]
  );

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
        if (selectedSessionId === sessionId) {
          const nextId = nextSessions[0]?.id ?? null;
          setSelectedSessionId(nextId);
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
      await loadSessions();
    } catch {
      setSendError("Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }, [appName, createSession, draft, isSending, loadSessionMessages, loadSessions, selectedSessionId, userId]);

  const selectedSessionLabel = useMemo(
    () => (selectedSessionId ? `Thread ${selectedSessionId}` : "No thread selected"),
    [selectedSessionId]
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
      <div className="flex h-[88vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.7)]">
        <aside className="flex w-[290px] shrink-0 flex-col border-r border-[#e8ecf4] bg-[#f9fbff]">
          <div className="border-b border-[#e8ecf4] p-4">
            <button
              type="button"
              onClick={() => void createSession()}
              disabled={isCreatingSession}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Plus className="h-4 w-4" />
              New session
            </button>
            <p className="mt-3 text-xs text-[#6b7280]">User ID: {userId}</p>
          </div>

          <div className="soft-scrollbar flex-1 overflow-y-auto p-3">
            {isLoadingSessions ? (
              <p className="px-2 py-3 text-sm text-[#6b7280]">Loading sessions...</p>
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
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        void loadSessionMessages(session.id);
                      }}
                      className="flex w-full items-start gap-2 text-left"
                    >
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#4f49e2]" />
                      <span className="line-clamp-2 text-xs font-semibold text-[#1f2937]">
                        {session.id}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSession(session.id)}
                      disabled={deletingSessionId === session.id}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
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
              <p className="text-sm text-[#6b7280]">Loading conversation...</p>
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
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
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
