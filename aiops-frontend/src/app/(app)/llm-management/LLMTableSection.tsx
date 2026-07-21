"use client";

import Searchbar from "@/components/Searchbar";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Bot, Loader2, Pencil, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  fetchModelTokenUsageMap,
  type ModelTokenUsage,
} from "../agent-management/Observability";
import {
  formatCellValue,
  formatDateTime,
  formatHeaderLabel,
  formatProviderValue,
  getProviderIconSrc,
  type ActionResult,
  type LLMRecord,
} from "./llmHelpers";
import UpdateLlm, { type LlmRecord } from "./updatellm";

const SORTABLE_HEADERS = ["provider", "created_at", "name"] as const;
type SortableHeader = (typeof SORTABLE_HEADERS)[number];

type LLMTableSectionProps = {
  llms: LLMRecord[];
  isLoading: boolean;
  loadError: string;
  onDeleteModel: (modelId: string) => Promise<ActionResult>;
};

const isSortableHeader = (header: string): header is SortableHeader =>
  (SORTABLE_HEADERS as readonly string[]).includes(header);

export default function LLMTableSection({
  llms,
  isLoading,
  loadError,
  onDeleteModel,
}: LLMTableSectionProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const llmApiBase = trimTrailingSlash(llmManagerApiBaseUrl);
  const [searchValue, setSearchValue] = useState("");
  const [daysInput, setDaysInput] = useState("30");
  const [days, setDays] = useState(30);
  const [daysError, setDaysError] = useState("");
  const [sortKey, setSortKey] = useState<SortableHeader>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [deleteTarget, setDeleteTarget] = useState<LLMRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [updateTarget, setUpdateTarget] = useState<LlmRecord | null>(null);
  const [tokenUsageByModelId, setTokenUsageByModelId] = useState<
    Record<string, ModelTokenUsage>
  >({});
  const [isTokenUsageLoading, setIsTokenUsageLoading] = useState(false);
  const isUpdateModalOpen = updateTarget !== null;
  const getHeaderLabel = (header: string) =>
    header === "name"
      ? "Name"
      : header === "token"
        ? "Tokens"
        : header === "pricing"
          ? "Pricing (USD)"
        : formatHeaderLabel(header);
 

  const tableHeaders = useMemo(() => {
    const headerSet = new Set<string>();
    llms.forEach((item) => {
      Object.keys(item).forEach((key) => headerSet.add(key));
    });

    headerSet.delete("model_id");
    const preferredOrder = ["name", "provider", "created_at", "description"];
    const ordered = preferredOrder.filter((key) => headerSet.has(key));
    const extras = Array.from(headerSet).filter(
      (key) => !preferredOrder.includes(key)
    );
    return [...ordered, ...extras];
  }, [llms]);

  const visibleHeaders = useMemo(() => {
    const headersWithoutDescription = tableHeaders.filter(
      (header) => header !== "description"
    );
    return [...headersWithoutDescription, "token", "pricing", "description"];
  }, [tableHeaders]);
  const loadingHeaders =
    visibleHeaders.length > 0
      ? visibleHeaders
      : ["name", "provider", "created_at", "token", "pricing", "description"];

  const handleSort = (header: SortableHeader) => {
    if (sortKey === header) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(header);
    setSortDirection(header === "created_at" ? "desc" : "asc");
  };

  const filteredLlms = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) {
      return llms;
    }
    return llms.filter((item) =>
      Object.values(item).some((value) =>
        formatCellValue(value).toLowerCase().includes(normalizedSearch)
      )
    );
  }, [llms, searchValue]);

  const sortedLlms = useMemo(() => {
    const rows = [...filteredLlms];
    rows.sort((left, right) => {
      const leftRaw = left[sortKey];
      const rightRaw = right[sortKey];

      if (sortKey === "created_at") {
        const leftTime = new Date(formatCellValue(leftRaw)).getTime();
        const rightTime = new Date(formatCellValue(rightRaw)).getTime();
        const leftSafe = Number.isNaN(leftTime) ? 0 : leftTime;
        const rightSafe = Number.isNaN(rightTime) ? 0 : rightTime;
        return sortDirection === "asc"
          ? leftSafe - rightSafe
          : rightSafe - leftSafe;
      }

      const leftText = formatCellValue(leftRaw);
      const rightText = formatCellValue(rightRaw);
      const compare = leftText.localeCompare(rightText, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? compare : -compare;
    });
    return rows;
  }, [filteredLlms, sortDirection, sortKey]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 6,
      }),
    []
  );

  const renderTokenUsage = (modelName: string) => {
    const tokenUsage = tokenUsageByModelId[modelName];
    const rows = [
      {
        label: "Input Tokens",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.input_tokens)
            ? numberFormatter.format(tokenUsage.input_tokens)
            : "-",
      },
      {
        label: "Output Tokens",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.output_tokens)
            ? numberFormatter.format(tokenUsage.output_tokens)
            : "-",
      },
      {
        label: "Total Tokens",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.total_tokens)
            ? numberFormatter.format(tokenUsage.total_tokens)
            : "-",
      },
    ];

    if (isTokenUsageLoading && !tokenUsage) {
      return (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={`${modelName}-${row.label}`} className="space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                {row.label}
              </span>
              <span className="block h-4 w-20 animate-pulse rounded bg-[#edf2f9]" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={`${modelName}-${row.label}`} className="min-w-0 text-left">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
              {row.label}
            </span>
            <span className="block break-words whitespace-normal font-semibold leading-snug text-[#0f172a]">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderPricingUsage = (modelName: string) => {
    const tokenUsage = tokenUsageByModelId[modelName];
    const rows = [
      {
        label: "Input Cost",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.input_cost)
            ? currencyFormatter.format(tokenUsage.input_cost)
            : "-",
      },
      {
        label: "Output Cost",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.output_cost)
            ? currencyFormatter.format(tokenUsage.output_cost)
            : "-",
      },
      {
        label: "Total Cost",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.total_cost)
            ? currencyFormatter.format(tokenUsage.total_cost)
            : "-",
      },
    ];

    if (isTokenUsageLoading && !tokenUsage) {
      return (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={`${modelName}-${row.label}`} className="space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                {row.label}
              </span>
              <span className="block h-4 w-20 animate-pulse rounded bg-[#edf2f9]" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={`${modelName}-${row.label}`} className="min-w-0 text-left">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
              {row.label}
            </span>
            <span className="block break-words whitespace-normal font-semibold leading-snug text-[#0f172a]">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderExtraConfig = (
    extraConfigValue: string | number | boolean | null | undefined
  ) => {
    const formattedValue = formatCellValue(extraConfigValue);

    if (formattedValue === "-") {
      return <span className="text-[#2b3341]">None</span>;
    }

    try {
      const parsed = JSON.parse(formattedValue) as Record<string, unknown>;
      const entries = Object.entries(parsed).filter(
        ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
      );

      if (entries.length === 0) {
        return <span className="text-[#2b3341]">-</span>;
      }

      return (
        <div className="grid gap-2">
          {entries.map(([key, value]) => (
            <div key={key} className="min-w-0 text-left">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                {formatHeaderLabel(key)}
              </span>
              <span className="block break-words whitespace-normal leading-snug text-[#0f172a]">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      );
    } catch {
      return (
        <span
          className="block break-words whitespace-normal text-[#2b3341]"
          title={formattedValue}
        >
          {formattedValue}
        </span>
      );
    }
  };

  useEffect(() => {
    if (!llmApiBase) {
      return;
    }

    const controller = new AbortController();

    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) {
          setIsTokenUsageLoading(true);
        }
      })
      .then(() =>
        fetchModelTokenUsageMap(llmApiBase, days, controller.signal)
      )
      .then((nextTokenUsageByModelId) => {
        setTokenUsageByModelId(nextTokenUsageByModelId);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setTokenUsageByModelId({});
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsTokenUsageLoading(false);
        }
      });

    return () => controller.abort();
  }, [days, llmApiBase]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) {
      return;
    }
    const modelId = String(deleteTarget.model_id ?? "").trim();
    if (!modelId || modelId === "-") {
      setDeleteError("Model ID is missing. Unable to delete this LLM.");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    const result = await onDeleteModel(modelId);
    if (!result.ok) {
      setDeleteError(result.error || "Unable to delete LLM.");
      setIsDeleting(false);
      return;
    }

    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-[#111827]">
            Large Language Models
          </h3>
          <span className="rounded-md border border-[#cbd2ff] px-2 py-0.5 text-xs font-semibold text-[#5b4cf0]">
            {llms.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form
            className="flex flex-wrap items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (isUpdateModalOpen) {
                return;
              }

              const nextDays = Number.parseInt(daysInput.trim(), 10);
              if (
                !Number.isFinite(nextDays) ||
                !Number.isInteger(nextDays) ||
                nextDays <= 0
              ) {
                setDaysError("Days must be a positive integer.");
                return;
              }

              setDaysError("");
              setDays(nextDays);
            }}
          >
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl bg-[#eef2ff] px-4 py-2 text-sm text-[#4f49e2]">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f49e2]">
                  Days
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={daysInput}
                  onChange={(event) => {
                    if (isUpdateModalOpen) {
                      return;
                    }
                    setDaysInput(event.target.value);
                    setDaysError("");
                  }}
                  placeholder="30"
                  name="token_usage_days"
                  autoComplete="off"
                  readOnly={isUpdateModalOpen}
                  className="w-20 bg-transparent text-sm font-semibold text-[#4f49e2] placeholder:text-[#4f49e2]/70 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={isUpdateModalOpen}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_26px_-20px_rgba(79,73,226,0.9)] ${isUpdateModalOpen ? "cursor-not-allowed bg-[#a5b4fc]" : "bg-[#4f49e2] hover:bg-[#4338ca]"}`}
              >
                Get Tokens & Pricing
              </button>
            </div>
          </form>
          <Searchbar
            value={searchValue}
            onChange={(nextValue) => {
              if (isUpdateModalOpen) {
                return;
              }
              setSearchValue(nextValue);
            }}
            placeholder="Search Models.."
            name="llm_model_search"
            autoComplete="new-password"
            readOnly={isUpdateModalOpen}
            collapsedWidthClass="w-52"
            expandedWidthClass="w-72"
          />
        </div>
      </div>

      {daysError ? (
        <p className="mt-3 text-sm font-semibold text-[#dc2626]">{daysError}</p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-[#eef1f7]">
        {isLoading ? (
          <div className="bg-white">
            <div
              className="grid divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold tracking-[0.08em] text-[#111827]"
              style={{
                gridTemplateColumns: `repeat(${loadingHeaders.length}, minmax(0, 1fr)) 96px`,
              }}
            >
              {loadingHeaders.map((header) => (
                <span
                  key={`loading-header-${header}`}
                  className="flex h-full items-center justify-center px-3 text-center break-words whitespace-normal leading-tight capitalize"
                >
                  {getHeaderLabel(header)}
                </span>
              ))}
              <span className="flex h-full items-center justify-center px-3 text-center break-words whitespace-normal leading-tight capitalize">
                Action
              </span>
            </div>
            <div className="hidden divide-y divide-[#eef1f7] md:block">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`desktop-skeleton-${index}`}
                  className="grid animate-pulse items-center divide-x divide-[#e8eef7] px-4 py-4"
                  style={{
                    gridTemplateColumns: `repeat(${loadingHeaders.length}, minmax(0, 1fr)) 96px`,
                  }}
                >
                  {loadingHeaders.map((header) => (
                    <span
                      key={`desktop-skeleton-cell-${index}-${header}`}
                      className="mx-3 h-4 rounded bg-[#edf2f9]"
                    />
                  ))}
                  <span className="ml-auto mr-3 h-8 w-10 rounded-lg bg-[#edf2f9]" />
                </div>
              ))}
            </div>
            <div className="divide-y divide-[#eef1f7] md:hidden">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`mobile-skeleton-${index}`}
                  className="animate-pulse space-y-3 px-4 py-4"
                >
                  <div className="h-4 w-2/5 rounded bg-[#edf2f9]" />
                  <div className="h-3 w-full rounded bg-[#edf2f9]" />
                  <div className="h-3 w-4/5 rounded bg-[#edf2f9]" />
                  <div className="h-8 w-full rounded-xl bg-[#edf2f9]" />
                </div>
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 bg-white px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fee2e2] text-[#ef4444] shadow-[0_12px_24px_-20px_rgba(239,68,68,0.55)]">
              <Bot className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-[#111827]">
              Unable to load LLMs
            </p>
            <p className="text-sm text-[#6b7280]">{loadError}</p>
          </div>
        ) : visibleHeaders.length === 0 || sortedLlms.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 bg-white px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2] shadow-[0_12px_24px_-20px_rgba(79,73,226,0.8)]">
              <Bot className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-[#111827]">
              {llms.length === 0 ? "No LLMs found" : "No matching LLMs found"}
            </p>
          </div>
        ) : (
          <div className="min-w-[1100px]">
            <div
              className="sticky top-0 z-10 grid divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold tracking-[0.08em] text-[#111827]"
              style={{
                gridTemplateColumns: `repeat(${visibleHeaders.length}, minmax(0, 1fr)) 96px`,
              }}
            >
              {visibleHeaders.map((header) => {
                if (!isSortableHeader(header)) {
                  return (
                    <span
                      key={header}
                      className="flex h-full items-center justify-center px-3 text-center leading-tight whitespace-normal break-words capitalize"
                    >
                      {getHeaderLabel(header)}
                    </span>
                  );
                }
                const isActiveSort = sortKey === header;
                return (
                  <button
                    key={header}
                    type="button"
                    onClick={() => handleSort(header)}
                    className="inline-flex h-full w-full items-center justify-center gap-1 px-3 text-center leading-tight whitespace-normal break-words capitalize text-[#111827] transition"
                  >
                    {getHeaderLabel(header)}
              
                  </button>
                );
              })}
              <span className="flex h-full items-center justify-center px-3 text-center leading-tight whitespace-normal break-words capitalize">
                Action
              </span>
            </div>
            <div className="divide-y divide-[#eef1f7] bg-white">
              {sortedLlms.map((item, index) => {
                const rowKey = `${formatCellValue(item.model_id)}-${index}`;
                const modelId = formatCellValue(item.model_id);
                const modelName = formatCellValue(item.name);
                return (
                  <div
                    key={rowKey}
                    className="grid items-center divide-x divide-[#e8eef7] px-4 py-4 text-sm text-[#2b3341] transition-colors hover:bg-[#f8f9fd]"
                    style={{
                      gridTemplateColumns: `repeat(${visibleHeaders.length}, minmax(0, 1fr)) 96px`,
                    }}
                  >
                    {visibleHeaders.map((header, headerIndex) => {
                      if (header === "model_id") {
                        return (
                          <span
                            key={`${header}-${index}`}
                            className="max-w-[360px] px-3 break-all whitespace-normal font-semibold text-[#1c2330]"
                            title={modelId}
                          >
                            {modelId}
                          </span>
                        );
                      }

                      if (header === "provider") {
                        const providerValue = formatProviderValue(item[header]);
                        const providerIcon = getProviderIconSrc(item[header]);
                        return (
                          <span key={`${header}-${index}`} className="px-3">
                            <span className="inline-flex max-w-full items-center gap-2.5">
                              {providerIcon ? (
                                <Image
                                  src={providerIcon}
                                  alt={`${providerValue} logo`}
                                  width={22}
                                  height={22}
                                  className="h-[22px] w-[22px] object-contain"
                                />
                              ) : null}
                              <span className="break-words whitespace-normal">
                                {providerValue}
                              </span>
                            </span>
                          </span>
                        );
                      }

                      if (header === "extra_config") {
                        return (
                          <div key={`${header}-${index}`} className="px-3">
                            {renderExtraConfig(item[header])}
                          </div>
                        );
                      }

                      if (header === "created_at") {
                        const rawValue = formatCellValue(item[header]);
                        const formattedDate = formatDateTime(item[header]);
                        return (
                          <span
                            key={`${header}-${index}`}
                            className={`${headerIndex === 0 ? "font-semibold text-[#1c2330]" : "text-[#2b3341]"} px-3 break-words whitespace-normal`}
                            title={`${formattedDate}${rawValue !== "-" ? ` (${rawValue})` : ""}`}
                          >
                            {formattedDate}
                          </span>
                        );
                      }

                      if (header === "token") {
                        return (
                          <div key={`${header}-${index}`} className="px-3">
                            {renderTokenUsage(modelName)}
                          </div>
                        );
                      }

                      if (header === "pricing") {
                        return (
                          <div key={`${header}-${index}`} className="px-3">
                            {renderPricingUsage(modelName)}
                          </div>
                        );
                      }

                      if (header === "description") {
                        return (
                          <span
                            key={`${header}-${index}`}
                            className="px-3 break-words whitespace-normal text-[#2b3341]"
                            title={formatCellValue(item[header])}
                          >
                            {formatCellValue(item[header])}
                          </span>
                        );
                      }

                      return (
                        <span
                          key={`${header}-${index}`}
                          className={`${headerIndex === 0 ? "font-semibold text-[#1c2330]" : "text-[#2b3341]"} px-3 break-words whitespace-normal`}
                          title={formatCellValue(item[header])}
                        >
                          {formatCellValue(item[header])}
                        </span>
                      );
                    })}
                    <div className="flex justify-end gap-2 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          const nextUpdateTarget: LlmRecord = {
                            model_id: String(item.model_id ?? ""),
                            provider: String(item.provider ?? ""),
                            name: String(item.name ?? ""),
                            description: String(item.description ?? ""),
                            api_key:
                              item.api_key === null || item.api_key === undefined
                                ? undefined
                                : String(item.api_key),
                            extra_config:
                              item.extra_config === null || item.extra_config === undefined
                                ? undefined
                                : String(item.extra_config),
                          };
                          setSearchValue("");
                          requestAnimationFrame(() => setSearchValue(""));
                          setUpdateTarget(nextUpdateTarget);

                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0284c7] transition hover:bg-[#bae6fd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7]/40"
                        aria-label={`Update ${modelId}`}
                        title={`Update ${modelId}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(item);
                          setDeleteError("");
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffe4e6] text-[#ef4444] transition hover:bg-[#fecdd3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]/40"
                        aria-label={`Delete ${modelId}`}
                        title={`Delete ${modelId}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#fee2e2] bg-[#fff5f5] px-6 py-4">
              <div className="flex items-center gap-2 text-[#b91c1c]">
                <Trash2 className="h-5 w-5" />
                <h4 className="text-lg font-semibold">Delete LLM</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                    setDeleteError("");
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b91c1c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#374151]">
                Are you sure you want to delete this model?
              </p>
              <p className="mt-2 max-w-full break-all rounded-md bg-[#fee2e2] px-2 py-1 font-semibold text-[#b91c1c]">
                {formatCellValue(deleteTarget.model_id)}
              </p>
              <p className="mt-3 text-xs text-[#9b1c1c]">
                This action cannot be undone.
              </p>
              {deleteError ? (
                <p className="mt-3 text-sm text-[#dc2626]">{deleteError}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                    setDeleteError("");
                  }
                }}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] ${isDeleting
                  ? "cursor-not-allowed bg-[#fca5a5]"
                  : "bg-[#ef4444] hover:bg-[#dc2626]"
                  }`}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {updateTarget && (
        <UpdateLlm
          llm={updateTarget}
          onClose={() => {
            setUpdateTarget(null);
            setSearchValue("");
            requestAnimationFrame(() => setSearchValue(""));
          }}
        />
      )}
    </section>
  );
}
