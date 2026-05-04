"use client";

import { Bot, CheckCircle2, ChevronDown, Loader2, RefreshCw, Zap } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatCellValue,
  getProviderIconSrc,
  type ActionResult,
  type LlmDefaults,
  type LlmDefaultSlot,
  type LLMRecord,
} from "./llmHelpers";

type SelectOption = {
  value: string;
  label: string;
  iconSrc?: string | null;
  helperText?: string;
};

type DefaultSelectorProps = {
  title: string;
  value: string | null;
  options: SelectOption[];
  isLoading: boolean;
  isUpdating: boolean;
  onChange: (value: string) => void;
};

type LLMOverviewSectionProps = {
  llms: LLMRecord[];
  defaults: LlmDefaults | null;
  isLoading: boolean;
  isDefaultsLoading: boolean;
  isRefreshing: boolean;
  defaultsError: string;
  updatingDefaultSlot: LlmDefaultSlot | null;
  onRefresh: () => void | Promise<void>;
  onCreateClick: () => void;
  onDefaultChange: (
    slot: LlmDefaultSlot,
    modelId: string
  ) => Promise<ActionResult>;
};

function DefaultSelector({
  title,
  value,
  options,
  isLoading,
  isUpdating,
  onChange,
}: DefaultSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((option) => option.value === value) ?? null;
  const placeholder = isLoading ? "Loading models..." : "Select model";
  const displayLabel = selectedOption?.label || placeholder;

  return (
    <div className="flex h-full min-h-[190px] flex-col rounded-2xl bg-white p-5 shadow-[0_12px_30px_-28px_rgba(16,24,40,0.45)] ring-1 ring-[#eef1f7]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95ad]">
            {title}
          </p>
          <p className="mt-2 text-sm text-[#5b6476]">
            Choose the {title} model.
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center ">
          {isUpdating ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#4f49e2]" />
          ) : selectedOption?.iconSrc ? (
            <Image
              src={selectedOption.iconSrc}
              alt={`${displayLabel} logo`}
              width={28}
              height={28}
              className="h-9 w-9 object-contain"
            />
          ) : (
            <span className="text-sm font-semibold uppercase text-[#9ca3af]">
              LLM
            </span>
          )}
        </div>
      </div>

      <div ref={containerRef} className="relative mt-auto pt-6">
        <button
          type="button"
          disabled={isLoading || isUpdating || options.length === 0}
          onClick={() => setIsOpen((previous) => !previous)}
          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm outline-none transition focus-within:border-[#4f49e2] focus-within:ring-2 focus-within:ring-[#4f49e2]/20 ${
            isLoading || isUpdating || options.length === 0
              ? "cursor-not-allowed border-[#e0e5f0] bg-white/90"
              : "border-[#e0e5f0] bg-white"
          }`}
        >
          <span
            className={`flex min-w-0 items-center gap-3 ${
              selectedOption ? "text-[#111827]" : "text-[#9ca3af]"
            }`}
          >
            {selectedOption?.iconSrc ? (
              <Image
                src={selectedOption.iconSrc}
                alt={`${displayLabel} logo`}
                width={20}
                height={20}
                className="h-5 w-5 shrink-0 object-contain"
              />
            ) : null}
            <span className="truncate">{displayLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#9ca3af]" />
        </button>

        {isOpen ? (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
            <div className="max-h-64 overflow-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left text-sm ${
                    option.value === value
                      ? "bg-[#eef2ff] text-[#4f49e2]"
                      : "text-[#111827] hover:bg-[#f3f4f6]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {option.iconSrc ? (
                      <Image
                        src={option.iconSrc}
                        alt={`${option.label} logo`}
                        width={20}
                        height={20}
                        className="h-5 w-5 shrink-0 object-contain"
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.helperText ? (
                        <span className="block truncate text-xs text-[#8b95ad]">
                          {option.helperText}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LLMOverviewSection({
  llms,
  defaults,
  isLoading,
  isDefaultsLoading,
  isRefreshing,
  defaultsError,
  updatingDefaultSlot,
  onRefresh,
  onCreateClick,
  onDefaultChange,
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

  const modelOptions = useMemo<SelectOption[]>(
    () =>
      llms
        .filter(
          (item) =>
            formatCellValue(item.model_id) !== "-" &&
            formatCellValue(item.name) !== "-"
        )
        .map((item) => {
          const provider = formatCellValue(item.provider);
          const providerLabel =
            provider === "-"
              ? undefined
              : provider.charAt(0).toUpperCase() + provider.slice(1);
          return {
            value: formatCellValue(item.model_id),
            label: formatCellValue(item.name),
            helperText: providerLabel,
            iconSrc: getProviderIconSrc(provider),
          };
        }),
    [llms]
  );

  const defaultSelectors: Array<{
    slot: LlmDefaultSlot;
    title: string;
    value: string | null;
  }> = [
    {
      slot: "primary",
      title: "Primary LLM",
      value: defaults?.primary_model_id ?? null,
    },
    {
      slot: "secondary",
      title: "Secondary LLM",
      value: defaults?.secondary_model_id ?? null,
    },
    {
      slot: "tertiary",
      title: "Tertiary LLM",
      value: defaults?.tertiary_model_id ?? null,
    },
  ];

  return (
    <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold text-[#111827]">
              LLM Management
            </h2>
            <p className="mt-2 text-sm text-[#5b6476]">
              Model availability, versions, and lifecycle status.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCreateClick}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)] transition hover:bg-[#3f39d6] active:scale-95"
            >
              + Create LLM
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing || isDefaultsLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_10px_20px_-16px_rgba(79,73,226,0.5)] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isRefreshing || isDefaultsLoading ? "animate-spin" : ""
                }`}
              />
              Refresh LLMs
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="flex h-full min-h-[190px] min-w-[220px] flex-col rounded-2xl bg-white p-5 shadow-[0_12px_30px_-28px_rgba(16,24,40,0.45)] ring-1 ring-[#eef1f7]"
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
                <p className="mt-auto pt-6 flex items-center gap-2 text-3xl font-semibold text-[#0f1115]">
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

        <div className="grid gap-4 xl:grid-cols-3">
          {defaultSelectors.map((selector) => (
            <DefaultSelector
              key={selector.slot}
              title={selector.title}
              value={selector.value}
              options={modelOptions}
              isLoading={isDefaultsLoading || isLoading}
              isUpdating={updatingDefaultSlot === selector.slot}
              onChange={(modelId) => {
                void onDefaultChange(selector.slot, modelId);
              }}
            />
          ))}
        </div>

        {defaultsError ? (
          <p className="text-sm font-medium text-[#dc2626]">{defaultsError}</p>
        ) : null}
      </div>
    </section>
  );
}

