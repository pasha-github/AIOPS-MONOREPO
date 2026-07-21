"use client";

import { Bot, MessageCircle } from "lucide-react";
import { forwardRef } from "react";

import { formatUpdatedAt } from "./helpers";
import type { AgentRecord } from "./types";

type AgentCardProps = {
  agent: AgentRecord;
  onOpenChat: (agent: AgentRecord) => void;
};

const AgentCard = forwardRef<HTMLDivElement, AgentCardProps>(function AgentCard(
  { agent, onOpenChat },
  ref
) {
  const isActive = agent.status?.toUpperCase() === "STARTED";
  const updatedAt = formatUpdatedAt(agent.updated_at);

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-4 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">{agent.name}</p>
            <p className="text-xs text-[#647087]">Updated at: {updatedAt}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#647087]">
          <span className={isActive ? "text-[#4b5563]" : "text-[#f97316]"}>
            {isActive ? "Active" : "Inactive"}
          </span>
          <button
            type="button"
            disabled
            aria-label={`${isActive ? "Active" : "Inactive"} status`}
            className={`relative inline-flex h-5 w-10 cursor-default items-center rounded-full ${
              isActive ? "bg-[#16a34a]" : "bg-[#f97316]"
            }`}
          >
            <span
              className={`absolute h-4 w-4 rounded-full bg-white shadow transition ${
                isActive ? "left-5" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => onOpenChat(agent)}
          disabled={!isActive}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-medium transition active:scale-[0.98] ${
            isActive
              ? "bg-[#cfefff] text-[#0b7ed9] hover:bg-[#bfe7ff] shadow-[0_12px_24px_-18px_rgba(11,126,217,0.45)]"
              : "cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          Chat with agent
        </button>
      </div>
    </div>
  );
});

export default AgentCard;
