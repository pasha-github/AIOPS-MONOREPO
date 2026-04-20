"use client";

import { Mic, Send } from "lucide-react";
import { ChatInputProps } from "../types";

export default function ChatInput({
  draft,
  isSending,
  messagesError,
  sendError,
  onDraftChange,
  onSend,
}: ChatInputProps) {
  return (
    <footer className="shrink-0 border-t border-[#eef1f7] bg-white px-6 py-4">
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
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.nativeEvent as KeyboardEvent).isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              onSend();
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
          onClick={onSend}
          disabled={isSending || draft.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send"}
          <Send className="h-4 w-4" />
        </button>
      </div>
    </footer>
  );
}
