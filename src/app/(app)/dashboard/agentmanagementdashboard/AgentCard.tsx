"use client";

import { Bot, Eye, MessageCircle } from "lucide-react";
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
  const isRunning = agent.status?.toUpperCase() === "STARTED";
  const isMule = (agent.enterprise ?? "").trim().toLowerCase() === "mule";
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
          <span>{isRunning ? "Running" : "Stopped"}</span>
          <button
            type="button"
            disabled
            aria-label={`${isRunning ? "Running" : "Stopped"} status`}
            className={`relative inline-flex h-5 w-10 cursor-default items-center rounded-full ${
              isRunning ? "bg-[#5b4cf0]" : "bg-[#e3e6ee]"
            }`}
          >
            <span
              className={`absolute h-4 w-4 rounded-full bg-white shadow transition ${
                isRunning ? "left-5" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onOpenChat(agent)}
          disabled={!isRunning}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
            isRunning
              ? "bg-[#cfefff] text-[#0b7ed9]"
              : "cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          Chat with agent
        </button>

        <button
          type="button"
          disabled={!isMule}
          className={`flex items-center justify-center gap-2 rounded-xl border border-[#e1e5ef] px-4 py-2 text-sm font-medium text-[#3a4355] ${
            isMule
              ? "bg-white hover:bg-[#f3f4f6]"
              : "cursor-not-allowed bg-[#f9fafb] opacity-60"
          }`}
        >
          View Logs
          <Eye className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

export default AgentCard;
