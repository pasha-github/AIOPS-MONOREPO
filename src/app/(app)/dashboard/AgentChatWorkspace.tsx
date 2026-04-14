"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AdkSession,
  StreamStep,
  ChatMessage,
  AgentChatWorkspaceProps,
} from "./dashboard.types";

import {
  renderMarkdownBlocks,
  renderMilestones,
  formatTime,
} from "../dashboard/help/help.chat";

import { useSessions } from "../dashboard/help/useSessions";
import { useStreamingChat } from "../dashboard/help/useStreamingChat";
import { useChatActions } from "../dashboard/help/useChatActions";

const DEFAULT_USER_ID = "user";

export default function AgentChatWorkspace({
  agent,
  onClose,
}: AgentChatWorkspaceProps) {
  const { agentAdkBaseUrl } = useRuntimeConfig();
  const adkBaseUrl = trimTrailingSlash(agentAdkBaseUrl);
  const appName = agent.agentId;
  const assistantDisplayName = agent.name?.trim() || appName;
  const userId = DEFAULT_USER_ID;

  // ---------------- STATE ----------------
  const [sessions, setSessions] = useState<AdkSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isDraftSession, setIsDraftSession] = useState(true);
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

  const [pendingUserMessage, setPendingUserMessage] =
    useState<ChatMessage | null>(null);

  const [messageMilestones, setMessageMilestones] = useState<
    Record<string, StreamStep[]>
  >({});
  const [expandedMilestones, setExpandedMilestones] = useState<
    Record<string, boolean>
  >({});

  const [sessionsError, setSessionsError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [sendError, setSendError] = useState("");

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);

  // ---------------- HOOKS ----------------
  const { loadSessions, loadSessionMessages } = useSessions({
    adkBaseUrl,
    appName,
    userId,
    setSessions,
    setSelectedSessionId,
    setIsDraftSession,
    setMessages,
    setMessageMilestones,
    setExpandedMilestones,
    setSessionsError,
    setMessagesError,
    setIsLoadingSessions,
    setIsLoadingMessages,
    selectedSessionIdRef,
  });

  const { runPromptSse, startStreamingState, resetStreamingText } =
    useStreamingChat({
      appName,
      userId,
      adkBaseUrl,
      setStreamingText,
      setStreamSteps,
      setIsStreamingReply,
      setSendError,
    });

  const { createSession, deleteSession, sendPrompt } = useChatActions({
    adkBaseUrl,
    appName,
    userId,
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    setIsDraftSession,
    setMessages,
    setMessageMilestones,
    setExpandedMilestones,
    setSessionsError,
    setDeletingSessionId,
    setOpenMenuSessionId,
    setPendingUserMessage,
    setSendError,
    setIsSending,
    setIsStreamingReply,
    setStreamSteps,
    loadSessionMessages,
    loadSessions,
    runPromptSse,
    startStreamingState,
    resetStreamingText,
  });

  // ---------------- EFFECTS ----------------
  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop =
      messageListRef.current.scrollHeight;
  }, [messages, pendingUserMessage, streamingText]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-session-menu='true']")) return;
      setOpenMenuSessionId(null);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ---------------- ACTIONS ----------------
  const sendMessage = useCallback(async () => {
    setSendError("");
    const prompt = draft.trim();
    if (!prompt || isSending) return;

    setDraft("");
    const sent = await sendPrompt(prompt, { optimisticUser: true });
    if (!sent) setDraft(prompt);
  }, [draft, isSending, sendPrompt]);

  const lastUserPrompt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].text;
    }
    return "";
  }, [messages]);

  const retryLastPrompt = useCallback(async () => {
    if (!lastUserPrompt || isSending) return;
    await sendPrompt(lastUserPrompt);
  }, [lastUserPrompt, isSending, sendPrompt]);

  const copyMessage = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 1400);
  };

  const toggleMilestoneExpansion = useCallback((id: string) => {
    setExpandedMilestones((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const visibleMessages = useMemo(() => {
    if (!pendingUserMessage) return messages;
    return [...messages, pendingUserMessage];
  }, [messages, pendingUserMessage]);

  const isInitialSessionView =
    !isLoadingMessages && !isStreamingReply && visibleMessages.length === 0;

  const startNewChat = () => {
    setSelectedSessionId(null);
    setIsDraftSession(true);
    setMessages([]);
    setMessageMilestones({});
    setExpandedMilestones({});
    setPendingUserMessage(null);
    setIsStreamingReply(false);
    resetStreamingText();
    setStreamSteps([]);
    setDraft("");
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
                    className={`mb-2 rounded-xl border px-3 py-2 ${isActive
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
                          {session.state?.first_message_summary ? (
                            session.state.first_message_summary
                          ) : (
                            <span className="flex items-center gap-2 text-[#9ca3af]">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-[#c7d2fe]" />
                              thinking...
                            </span>
                          )}
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
              aria-label="Close chat"
              title="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#111827]"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={messageListRef}
            className={`soft-scrollbar flex-1 ${isInitialSessionView
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
                      className={`flex ${isUserSkeleton ? "justify-end" : "justify-start"
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
                        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isUser
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
                        {!isUser && milestones.length > 0
                          ? renderMilestones(
                            milestones,
                            expandedMilestones,
                            toggleMilestoneExpansion
                          )
                          : null}
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

                      {streamSteps.length > 0
                        ? renderMilestones(
                          streamSteps,
                          expandedMilestones,
                          toggleMilestoneExpansion
                        )
                        : null}

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
