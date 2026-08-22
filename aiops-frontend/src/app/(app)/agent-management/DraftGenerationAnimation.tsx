"use client";

import { Bot, Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const DEFAULT_DRAFT_STEPS = [
  "Understanding agent intent",
  "Drafting identity and description",
  "Preparing prompt instructions",
  "Mapping integrations and capabilities",
];

export function DraftGenerationProgress({ steps = DEFAULT_DRAFT_STEPS }: { steps?: string[] }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-4 py-3 text-center sm:min-h-[340px] sm:py-5">
      <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 shadow-[0_18px_38px_-28px_rgba(79,73,226,0.8)] sm:mb-7 sm:h-16 sm:w-16">
        <Sparkles className="h-6 w-6 animate-pulse sm:h-7 sm:w-7" />
        <span className="absolute inset-0 rounded-3xl border border-indigo-200/80 draft-orbit" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-indigo-500 shadow-[0_0_0_6px_rgba(99,91,255,0.14)]" />
      </div>

      <div className="mb-5 sm:mb-7">
        <p className="text-base font-semibold text-[#344054]">
          Generating agent draft
        </p>
        <p className="mt-1 text-sm font-medium text-[#8a94a6]">
          Reading the prompt and preparing editable fields.
        </p>
      </div>

      <div className="w-full max-w-xl text-left">
        {steps.map((step, index) => {
          const delay = index * 6.25;
          return (
            <div key={step} className="relative flex min-h-[58px] gap-4 last:min-h-0 sm:min-h-[68px]">
              {index < steps.length - 1 ? (
                <span
                  className="absolute left-[15px] top-9 h-[calc(100%-36px)] w-px origin-top bg-indigo-200"
                  style={{
                    animation: "draftLineGrow 1.15s ease-out forwards",
                    animationDelay: `${delay + 4.65}s`,
                    transform: "scaleY(0)",
                  }}
                />
              ) : null}

              <span
                className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-500 ring-4 ring-white"
                style={{
                  animation: "draftDotActive 0.55s ease-out forwards",
                  animationDelay: `${delay}s`,
                }}
              >
                <Check
                  className="h-4 w-4 opacity-0"
                  style={{
                    animation: "draftCheckIn 0.38s ease-out forwards",
                    animationDelay: `${delay + 4.1}s`,
                  }}
                />
              </span>

              <div className="min-w-0 pt-1">
                <span
                  className="block max-w-max overflow-hidden whitespace-nowrap text-sm font-semibold text-[#475467]"
                  style={{
                    animation: "draftTyping 3.75s steps(42, end) forwards",
                    animationDelay: `${delay + 0.45}s`,
                    width: 0,
                  }}
                >
                  {step}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-sm font-semibold text-indigo-600 opacity-0 draft-please-wait sm:mt-3">
        Finalizing the draft. Please wait...
      </p>

      <style jsx>{`
        @keyframes draftTyping {
          from {
            width: 0;
          }
          to {
            width: 100%;
          }
        }

        @keyframes draftCheckIn {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes draftDotActive {
          to {
            background: #635bff;
            color: white;
            box-shadow: 0 12px 26px -16px rgba(79, 73, 226, 0.9);
          }
        }

        @keyframes draftLineGrow {
          to {
            transform: scaleY(1);
          }
        }

        @keyframes draftOrbit {
          from {
            transform: rotate(0deg) scale(1);
            opacity: 0.9;
          }
          to {
            transform: rotate(360deg) scale(1.08);
            opacity: 0.35;
          }
        }

        @keyframes draftPleaseWait {
          0%,
          100% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
        }

        .draft-orbit {
          animation: draftOrbit 1.8s linear infinite;
        }

        .draft-please-wait {
          animation: draftPleaseWait 2s ease-in-out 25s infinite;
        }
      `}</style>
    </div>
  );
}

export function DraftHighlightedField({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl transition-all duration-700 ${
        active
          ? "bg-indigo-50/70 p-3 shadow-[0_18px_38px_-30px_rgba(79,73,226,0.75)] ring-2 ring-indigo-200/80"
          : ""
      }`}
    >
      {children}
    </div>
  );
}

export function DraftGeneratingButtonIcon({ active }: { active: boolean }) {
  if (!active) {
    return <Sparkles className="h-4 w-4" />;
  }

  return (
    <span className="relative flex h-4 w-4 items-center justify-center">
      <Bot className="h-4 w-4 animate-pulse" />
      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-white/90" />
    </span>
  );
}
