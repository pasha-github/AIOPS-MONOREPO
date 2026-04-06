"use client";

import { Bot, X } from "lucide-react";
import { ChatHeaderProps } from "../types";


export default function ChatHeader({
  assistantDisplayName,
  appName,
  selectedSessionLabel,
  onClose,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-[#eef1f7] px-6 py-4 bg-white">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4f49e2] text-white shrink-0">
          <Bot className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h4 className="text-lg font-semibold text-[#111827] truncate">
            {assistantDisplayName}
          </h4>

          <p className="text-sm text-[#6b7280] truncate">
            {appName || "Agent"} • {selectedSessionLabel}
          </p>
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6] transition shrink-0"
          aria-label="Close chat"
          title="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </header>
  );
}