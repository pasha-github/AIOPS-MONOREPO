"use client";
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type AgentSessionSummary, type AutomationAgentOption } from "../dashboard/logs";

const stripMarkdown = (value: string) =>
  value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

function SessionDropdownSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-[linear-gradient(135deg,#ffffff_0%,#f7f9ff_100%)] p-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <span className="block h-3 w-24 rounded-full bg-[#e8edf7]" />
          <span className="block h-12 w-full rounded-xl bg-[#e8edf7]" />
        </div>
        <div className="flex items-center justify-end gap-3">
          <span className="h-11 w-11 rounded-full bg-[#e8edf7]" />
          <span className="h-10 w-28 rounded-full bg-[#e8edf7]" />
        </div>
      </div>
    </div>
  );
}

type TopBarProps = {
  agents: AutomationAgentOption[];
  selectedAgentId: string | null;
  sessions: AgentSessionSummary[];
  selectedSession: AgentSessionSummary | null;
  isAgentsLoading: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  deletingSessionId: string | null;
  onRefresh: () => void;
  onAgentChange: (agentId: string) => void;
  onSessionChange: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export default function TopBar({
  agents,
  selectedAgentId,
  sessions,
  selectedSession,
  isAgentsLoading,
  isLoading,
  isRefreshing,
  deletingSessionId,
  onRefresh,
  onAgentChange,
  onSessionChange,
  onDeleteSession,
}: TopBarProps) {
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const selectedSessionSummary = selectedSession
    ? stripMarkdown(selectedSession.summary)
    : null;

  useEffect(() => {
    if (!isAgentMenuOpen && !isSessionMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuContainerRef.current?.contains(event.target as Node)) {
        setIsSessionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isAgentMenuOpen, isSessionMenuOpen]);

  return (
    <section className="overflow-visible rounded-xl bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f7f8fd_48%,#eef3ff_100%)] px-8 py-7 shadow-[0_32px_80px_-52px_rgba(15,23,42,0.5)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-[860px]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-[#4f49e2] shadow-[0_12px_28px_-24px_rgba(79,73,226,0.55)]">
                <Activity className="h-6 w-6" />
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-[#10131a]">
                Activity Explorer
              </h1>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-[#5f677a]">
              Review session history for the default automation app and inspect
              individual events without leaving the activity stream.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_14px_30px_-22px_rgba(16,24,40,0.45)] backdrop-blur"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh Activity
          </button>
        </div>

        {isLoading ? (
          <SessionDropdownSkeleton />
        ) : (
          <div ref={menuContainerRef} className="relative overflow-visible p-5">
            <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative min-w-0">
                <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <div className="relative min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsAgentMenuOpen((current) => !current)}
                      disabled={isAgentsLoading || agents.length === 0}
                      className="flex w-full items-center justify-between gap-4 rounded-xl border border-[#dfe6f5] bg-white/80 px-4 py-4 text-left shadow-[0_18px_34px_-28px_rgba(15,23,42,0.35)] transition hover:border-[#cfd8ee] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7d2fe] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
                          Automation agent
                        </p>
                        <p className="mt-1 truncate text-xl font-semibold leading-tight text-[#111827]">
                          {selectedAgent?.name ?? "Select an automation agent"}
                        </p>
                        <p className="mt-1 truncate text-sm text-[#687285]">
                          {selectedAgent?.description || "Choose which automation app to inspect"}
                        </p>
                      </div>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2] shadow-[0_10px_20px_-18px_rgba(79,73,226,0.65)]">
                        {isAgentsLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Bot
                            className={`h-5 w-5 transition-transform ${
                              isAgentMenuOpen ? "scale-105" : ""
                            }`}
                          />
                        )}
                      </span>
                    </button>

                    {isAgentMenuOpen && agents.length > 0 ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-xl border border-[#e4ebf8] bg-white p-3 shadow-[0_28px_60px_-34px_rgba(15,23,42,0.35)]">
                        <div className="max-h-[320px] overflow-y-auto pr-1">
                          {agents.map((agent) => {
                            const isActive = agent.id === selectedAgentId;
                            return (
                              <button
                                key={agent.id}
                                type="button"
                                onClick={() => {
                                  onAgentChange(agent.id);
                                  setIsAgentMenuOpen(false);
                                  setIsSessionMenuOpen(false);
                                }}
                                className={`flex w-full items-center justify-between gap-4 rounded-lg px-4 py-3 text-left transition ${
                                  isActive
                                    ? "bg-[#eef2ff] text-[#24324a]"
                                    : "text-[#5f677a] hover:bg-[#f8faff]"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-[#111827]">
                                    {agent.name}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-[#7a8498]">
                                    {agent.id}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="relative min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsSessionMenuOpen((current) => !current)}
                      disabled={!selectedAgentId}
                      className="flex w-full items-center justify-between gap-4 rounded-xl border border-[#dfe6f5] bg-white/80 px-4 py-4 text-left shadow-[0_18px_34px_-28px_rgba(15,23,42,0.35)] transition hover:border-[#cfd8ee] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7d2fe] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
                          {selectedSession ? "Selected session" : "Select session"}
                        </p>
                        <p className="mt-1 truncate text-[2rem] font-semibold leading-tight text-[#111827]">
                          {selectedSessionSummary ?? "Select a session"}
                        </p>
                        <p className="mt-1 text-sm text-[#687285]">
                          {selectedSession
                            ? `Last updated ${selectedSession.updatedAtLabel}`
                            : selectedAgentId
                              ? "No sessions available"
                              : "Select an automation agent first"}
                        </p>
                      </div>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2] shadow-[0_10px_20px_-18px_rgba(79,73,226,0.65)]">
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${
                            isSessionMenuOpen ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </button>

                    {isSessionMenuOpen && sessions.length > 0 ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-xl border border-[#e4ebf8] bg-white p-3 shadow-[0_28px_60px_-34px_rgba(15,23,42,0.35)]">
                        <div className="max-h-[320px] overflow-y-auto pr-1">
                          {sessions.map((session) => {
                            const isActive = session.id === selectedSession?.id;
                            return (
                              <div
                                key={session.id}
                                className={`flex w-full items-center justify-between gap-4 rounded-lg px-4 py-3 transition ${
                                  isActive
                                    ? "bg-[#eef2ff] text-[#24324a]"
                                    : "text-[#5f677a] hover:bg-[#f8faff]"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSessionChange(session.id);
                                    setIsSessionMenuOpen(false);
                                  }}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="truncate text-sm font-semibold text-[#111827]">
                                    {stripMarkdown(session.summary)}
                                  </p>
                                  <p className="mt-1 text-xs text-[#7a8498]">
                                    Last updated {session.updatedAtLabel}
                                  </p>
                                </button>
                                <div className="flex shrink-0 items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => void onDeleteSession(session.id)}
                                    disabled={deletingSessionId === session.id}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#ef4444] transition hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label={`Delete ${stripMarkdown(session.summary)}`}
                                  >
                                    {deletingSessionId === session.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 px-4 py-4 text-sm text-[#5f677a]">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f0ff] text-[#3662ff]">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="text-left">
                  <p className="text-2xl font-semibold leading-none text-[#111827]">
                    {sessions.length}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#7a8498]">
                    Sessions
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
