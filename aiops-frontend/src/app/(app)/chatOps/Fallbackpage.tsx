"use client";

import { Bot, LockIcon, MessageCircle, MessageSquareOff, Power, Timer } from "lucide-react";

type FallbackpageProps = {
  disabledAgentCount: number;
};

const guidanceItems = [
  {
    icon: Power,
    title: "Enable an agent",
    description:
      "Turn at least one agent back on from Agent Management before starting a new conversation.",
  },
  {
    icon: Timer,
    title: "Wait for a live status",
    description:
      "ChatOps unlocks when an agent reaches an active, deployed, online, or started state.",
  },
  {
    icon: MessageCircle,
    title: "Sessions stay paused",
    description:
      "Existing sessions and new message input remain unavailable while every visible agent is offline.",
  },
];

export default function Fallbackpage({
  disabledAgentCount,
}: FallbackpageProps) {
  return (
    <>
      <aside className="relative flex h-full min-h-0 w-[290px] shrink-0 flex-col overflow-hidden border-r border-[#e8ecf4] bg-[#f9fbff]">
        <div className="border-b border-[#e8ecf4] p-4">
          <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe5f5] bg-white px-4 py-2 text-sm font-semibold text-[#9aa4b2]">
            <MessageSquareOff className="h-4 w-4" />
            New session unavailable
          </div>
          <p className="mt-3 text-xs text-[#6b7280]">User ID: user</p>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-5">
          <div className="w-full px-5 py-8 text-center ">
            <div className="mx-auto flex h-16 w-16 items-center justify-center text-[#4f49e2] ">
              <LockIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-base font-semibold text-[#111827]">
              Sessions are locked
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              There are no active agents available for ChatOps. Enable an agent
              to restore session history and new chat creation.
            </p>
            <div className="mt-5 rounded-2xl bg-[#f8fafc] px-4 py-3 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center text-[#4f49e2] ">
              <Bot className="h-7 w-7" />
            </div>
              <p className="mt-2 text-sm font-medium text-[#1f2937]">
                {disabledAgentCount} disabled agents detected
              </p>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,73,226,0.09),_transparent_30%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)]">
        <div className="border-b border-[#e8ecf4] bg-white/90 px-8 py-6 backdrop-blur">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ecebff] text-[#4f49e2] shadow-[0_18px_35px_-28px_rgba(79,73,226,0.55)]">
              <Bot className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7c86a2]">
                ChatOps unavailable
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">
                All agents are currently offline
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b6476]">
                ChatOps needs at least one enabled agent to load sessions, open
                chat history, and accept new prompts. The right sidebar remains
                available so you can inspect which agents are disabled.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
            <div className="rounded-[28px] ">
              <div className="mt-5 space-y-4">
                {guidanceItems.map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="flex items-start gap-4 rounded-2xl border border-[#eef2f7] bg-[#fbfcff] px-4 py-4"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f5f7ff] text-[#4f49e2]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#0f172a]">
                        {title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#64748b]">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] p-7 ">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b08968]">
                Recommended next steps
              </p>
                <ol className="mt-5 space-y-4 text-sm leading-6 text-[#64748b]">
                <li className="rounded-2xl border border-[#f6ddc4] bg-white/85 px-4 py-4">
                  <span className="font-semibold text-[#9a3412]">1.</span>{" "}
                  Go to Agent Management and enable the agent you want to use.
                </li>
                <li className="rounded-2xl border border-[#f6ddc4] bg-white/85 px-4 py-4">
                  <span className="font-semibold text-[#9a3412]">2.</span>{" "}
                  Confirm its status returns to an operable state such as active
                  or deployed.
                </li>
                <li className="rounded-2xl border border-[#f6ddc4] bg-white/85 px-4 py-4">
                  <span className="font-semibold text-[#9a3412]">3.</span>{" "}
                  Re-open ChatOps and resume session work once the agent is back
                  online.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
