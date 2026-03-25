"use client";

import { useMemo } from "react";
import { Bot, CheckCircle2, Loader2, RefreshCw, Zap } from "lucide-react";
import { formatCellValue, type LLMRecord } from "./llmHelpers";

type LLMOverviewSectionProps = {
  llms: LLMRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  onCreateClick: () => void;
};

export default function LLMOverviewSection({
  llms,
  isLoading,
  isRefreshing,
  onRefresh,
  onCreateClick,
}: LLMOverviewSectionProps) {
  const { totalCount, providerCount, describedCount } = useMemo(() => {
    const total = llms.length;
    const providers = new Set(
      llms
        .map((item) => formatCellValue(item.provider).toLowerCase())
        .filter((provider) => provider !== "-")
    ).size;
    const described = llms.filter((item) => {
      const descriptionValue = item.description;
      return Boolean(
        descriptionValue && String(descriptionValue).trim().length > 0
      );
    }).length;
    return {
      totalCount: total,
      providerCount: providers,
      describedCount: described,
    };
  }, [llms]);

  const statCards = [
    {
      title: "Providers",
      value: providerCount,
      note: "Model sources",
      icon: CheckCircle2,
      tone: "from-[#18c964] to-[#00b56c]",
      noteColor: "text-[#16a34a]",
    },
    {
      title: "With description",
      value: describedCount,
      note: "Documented models",
      icon: Zap,
      tone: "from-[#2f80ff] to-[#1aa7ff]",
      noteColor: "text-[#3b82f6]",
    },
    {
      title: "Total LLMs",
      value: totalCount,
      note: "Available now",
      icon: Bot,
      tone: "from-[#b45cff] to-[#ff5ac8]",
      noteColor: "text-[#e11d8d]",
    },
  ];

  return (
    <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-md space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[#111827]">
              LLM management
            </h2>
            <p className="mt-2 text-sm text-[#5b6476]">
              Model availability, versions, and lifecycle status.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)] transition hover:bg-[#3f39d6] active:scale-95"
          >
            + Create LLM
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_10px_20px_-16px_rgba(79,73,226,0.5)] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh LLMs
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="min-w-[220px] rounded-2xl bg-white p-5 shadow-[0_12px_30px_-28px_rgba(16,24,40,0.45)] ring-1 ring-[#eef1f7]"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.tone} text-white shadow-[0_10px_20px_-12px_rgba(0,0,0,0.45)]`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-xs font-semibold ${card.noteColor}`}>
                      {card.note}
                    </span>
                  </div>
                  <p className="mt-5 text-sm font-semibold text-[#5a6476]">
                    {card.title}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-[#0f1115]">
                    {isLoading || isRefreshing ? (
                      <Loader2 className="h-6 w-6 animate-spin text-[#5b4cf0]" />
                    ) : (
                      card.value
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

