"use client";

import type { Ref } from "react";

import AgentCard from "./AgentCard";
import type { AgentRecord } from "./types";

type AgentListProps = {
  agents: AgentRecord[];
  isLoading: boolean;
  error: string;
  layout: "stack" | "grid";
  onOpenChat: (agent: AgentRecord) => void;
  firstItemRef?: Ref<HTMLDivElement>;
};

const renderSkeletons = (layout: "stack" | "grid") => {
  const count = layout === "grid" ? 4 : 2;
  const wrapperClass = layout === "grid" ? "grid gap-4 md:grid-cols-2" : "space-y-4";

  return (
    <div className={wrapperClass}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`agent-skeleton-${layout}-${index}`}
          className="animate-pulse rounded-2xl border border-[#eef1f7] bg-white px-5 py-4 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-2xl bg-[#edf2f9]" />
              <div className="space-y-2">
                <span className="block h-4 w-32 rounded bg-[#edf2f9]" />
                <span className="block h-3 w-44 rounded bg-[#edf2f9]" />
              </div>
            </div>
            <span className="h-5 w-24 rounded bg-[#edf2f9]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <span className="h-10 rounded-xl bg-[#edf2f9]" />
            <span className="h-10 rounded-xl bg-[#edf2f9]" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default function AgentList({
  agents,
  isLoading,
  error,
  layout,
  onOpenChat,
  firstItemRef,
}: AgentListProps) {
  if (isLoading) {
    return renderSkeletons(layout);
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-6 text-sm text-[#b91c1c] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
        {error}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-6 text-sm text-[#647087] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
        No agents yet.
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <AgentCard
            key={agent.agentId}
            agent={agent}
            onOpenChat={onOpenChat}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {agents.map((agent, index) => (
        <AgentCard
          key={agent.agentId}
          ref={index === 0 ? firstItemRef : undefined}
          agent={agent}
          onOpenChat={onOpenChat}
        />
      ))}
    </div>
  );
}
