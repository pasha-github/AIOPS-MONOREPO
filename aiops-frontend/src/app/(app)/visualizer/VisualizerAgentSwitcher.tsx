"use client";

import { Network, PanelRightClose, PanelRightOpen, RefreshCw } from "lucide-react";

type AgentOption = {
  id: string;
  name: string;
  role: string;
};

type VisualizerAgentSwitcherProps = {
  agents: AgentOption[];
  focusedAgentId: string | null;
  isOpen: boolean;
  isRefreshing: boolean;
  onToggleOpen: () => void;
  onRefresh: () => void;
  onViewAll: () => void;
  onSelectAgent: (agentId: string) => void;
};

export default function VisualizerAgentSwitcher({
  agents,
  focusedAgentId,
  isOpen,
  isRefreshing,
  onToggleOpen,
  onRefresh,
  onViewAll,
  onSelectAgent,
}: VisualizerAgentSwitcherProps) {
  return (
    <aside className="absolute right-6 top-6 z-20 w-[280px] max-h-[calc(100vh-100px)] overflow-hidden rounded-[24px] border border-[#e2e8f3] bg-white/96 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
      <div className="flex items-start justify-between border-b border-[#edf1f7] px-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e8f0ff] text-[#2563eb]">
              <Network className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b94a7]">
                Visualizer
              </p>
              <h3 className="text-[22px] font-semibold leading-none text-[#111827]">
                Agent
              </h3>
            </div>
          </div>
          <div className="mt-3 flex w-full items-center justify-between gap-3">
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4f49e2] shadow-[0_10px_20px_-16px_rgba(79,73,226,0.5)] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-70"
            >
              View All
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4f49e2] shadow-[0_10px_20px_-16px_rgba(79,73,226,0.5)] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e5e7eb] text-[#667085] transition hover:bg-[#f8fafc]"
          aria-label={isOpen ? "Collapse agent switcher" : "Expand agent switcher"}
        >
          {isOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      </div>

      {isOpen ? (
        <>
          

          <div
            className="max-h-[calc(100vh-250px)] overflow-y-auto px-3 py-3 pr-1 pb-5"
            style={{ scrollbarWidth: "thin" }}
          >
            <div className="space-y-1.5">
              {agents.map((agent) => {
                const isActive = agent.id === focusedAgentId;

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onSelectAgent(agent.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                      isActive
                        ? "bg-[#2f63f2] text-white shadow-[0_18px_38px_-24px_rgba(47,99,242,0.9)]"
                        : "text-[#111827] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        isActive ? "bg-white" : "bg-[#10b981]"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold leading-5">{agent.name}</p>
                      <p
                        className={`truncate text-[11px] ${
                          isActive ? "text-white/80" : "text-[#667085]"
                        }`}
                      >
                        {agent.role}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
