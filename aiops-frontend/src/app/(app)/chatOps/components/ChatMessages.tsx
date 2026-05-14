"use client";

import { Bot, Check, Copy, Mic, Plus, RotateCcw, Send, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { forwardRef } from "react";
import { formatTime, renderMarkdownBlocks, renderMilestones } from "../chat_helpers";
import type { ChatMessagesProps } from "../types";



const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(
  (
    {
      isLoadingMessages,
      isInitialSessionView,
      visibleMessages,
      isStreamingReply,
      streamingText,
      streamSteps,
      messageMilestones,
      expandedMilestones,
      assistantDisplayName,
      copiedMessageId,
      lastUserPrompt,
      isSending,
      sendError,
      draft = "",
      onDraftChange,
      onSend,
      onToggleMilestone,
      onCopyMessage,
      onRetry,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`soft-scrollbar flex-1 min-h-0 overflow-y-auto ${
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
                  className={`flex ${isUserSkeleton ? "justify-end" : "justify-start"}`}
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
          /* ── Welcome / initial-view screen ── matches AgentChatWorkspace exactly */
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-4xl -translate-y-10">
              <h3 className="mb-8 text-center text-4xl font-semibold tracking-tight text-[#111827]">
                What&apos;s on the agenda today?
              </h3>
              <div className="rounded-[2rem] border border-[#dbe2f0] bg-white p-5 shadow-[0_24px_60px_-42px_rgba(16,24,40,0.35)]">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => onDraftChange?.(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.nativeEvent as KeyboardEvent).isComposing) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSend?.();
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
                      onClick={onSend ? () => onSend() : undefined}
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
          /* ── Normal chat message list ── */
          <>
            {visibleMessages.length === 0 && !isStreamingReply ? (
              <p className="text-sm text-[#6b7280]">No messages yet. Start the conversation.</p>
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
                      {isUser ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-3.5 w-3.5" />
                      )}
                      <span>{isUser ? "user" : assistantDisplayName}</span>
                      <span className="text-[#b6bfce]">|</span>
                      <span>{message.timeLabel}</span>
                    </div>

                    {!isUser && milestones.length > 0
                      ? renderMilestones(milestones, expandedMilestones, onToggleMilestone)
                      : null}

                    <div className="space-y-3 break-words">
                      {renderMarkdownBlocks(message.text)}
                    </div>

                    {!isUser ? (
                      <div className="mt-3 flex items-center gap-1 text-[#7b8497]">
                        <button
                          type="button"
                          onClick={() => onCopyMessage(message.id, message.text)}
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
                          onClick={onRetry}
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
                    ? renderMilestones(streamSteps, expandedMilestones, onToggleMilestone)
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
    );
  }
);

ChatMessages.displayName = "ChatMessages";

export default ChatMessages;