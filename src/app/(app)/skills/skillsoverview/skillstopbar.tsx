"use client";

import { Plus, Sparkles } from "lucide-react";

type SkillsTopbarProps = {
  totalSkills: number;
  totalTools: number;
  totalConnectors: number;
  totalMcpInUse: number;
  isLoading?: boolean;
  onCreate: () => void;
};

export default function SkillsTopbar({
  totalSkills,
  totalTools,
  totalConnectors,
  totalMcpInUse,
  isLoading = false,
  onCreate,
}: SkillsTopbarProps) {
  const summaryItems = [
    { label: "Total skills", value: totalSkills },
    { label: "Total tools", value: totalTools },
    { label: "Connectors in use", value: totalConnectors },
    { label: "MCP in use", value: totalMcpInUse },
  ];

  return (
    <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl space-y-4">
          <h2 className="flex items-center gap-3 text-2xl font-semibold text-[#111827]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#efeefe] text-[#4f49e2]">
              <Sparkles className="h-5 w-5" />
            </span>
            Skills
          </h2>
          <p className="text-sm leading-6 text-[#5b6476]">
            Create and manage reusable skills with front matter, instructions,
            dependencies, tools, and references.
          </p>
        </div>

        <div className="flex items-start gap-6">
          <div className="flex flex-wrap">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="min-w-[120px] border-r border-[#e8edf7] px-5 last:border-r-0"
              >
                <p className="text-xs font-medium text-[#8b95ad]">{item.label}</p>
                <div className="mt-1 min-h-[40px]">
                  {isLoading ? (
                    <div className="h-9 w-16 animate-pulse rounded-lg bg-[#edf2f9]" />
                  ) : (
                    <p className="text-3xl font-semibold tracking-tight text-[#111827]">
                      {item.value}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)] transition hover:bg-[#3f39d6] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Create Skill
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
