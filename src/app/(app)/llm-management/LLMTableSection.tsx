"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Bot, ChevronDown, Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import {
  formatCellValue,
  formatDateTime,
  formatHeaderLabel,
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
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [sortKey, setSortKey] = useState<SortableHeader>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [deleteTarget, setDeleteTarget] = useState<LLMRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [updateTarget, setUpdateTarget] = useState<LlmRecord | null>(null);
  const isUpdateModalOpen = updateTarget !== null;
  const getHeaderLabel = (header: string) =>
    header === "name" ? "Model Name" : formatHeaderLabel(header);
 

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

  const visibleHeaders = tableHeaders;
  const loadingHeaders =
    visibleHeaders.length > 0
      ? visibleHeaders
      : ["name", "provider", "created_at", "description"];

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
          <div
            className={`flex items-center gap-2 rounded-xl bg-[#eef2ff] px-4 py-2 text-sm text-[#4f49e2] transition-all duration-200 ${isSearchFocused ? "w-72" : "w-52"
              }`}
          >
            <Search className="h-4 w-4" />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => {
                if (isUpdateModalOpen) {
                  return;
                }
                setSearchValue(event.target.value);
              }}
              placeholder="Search Models.."
              name="llm_model_search"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              readOnly={isUpdateModalOpen}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full bg-transparent text-sm text-[#4f49e2] placeholder:text-[#4f49e2] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-[#eef1f7]">
        {isLoading ? (
          <div className="bg-white">
            <div
              className="grid divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold text-[#111827]"
              style={{
                gridTemplateColumns: `repeat(${loadingHeaders.length}, minmax(0, 1fr)) 96px`,
              }}
            >
              {loadingHeaders.map((header) => (
                <span
                  key={`loading-header-${header}`}
                  className="px-3 break-words whitespace-normal uppercase tracking-[0.08em]"
                >
                  {getHeaderLabel(header)}
                </span>
              ))}
              <span className="px-3 break-words whitespace-normal text-right uppercase tracking-[0.08em]">
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
              className="sticky top-0 z-10 grid divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold text-[#111827]"
              style={{
                gridTemplateColumns: `repeat(${visibleHeaders.length}, minmax(0, 1fr)) 96px`,
              }}
            >
              {visibleHeaders.map((header) => {
                if (!isSortableHeader(header)) {
                  return (
                    <span
                      key={header}
                      className="px-3 break-words whitespace-normal uppercase tracking-[0.08em]"
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
                    className="inline-flex items-center gap-1 px-3 break-words whitespace-normal text-left uppercase tracking-[0.08em] text-[#111827] transition hover:text-[#4f49e2]"
                  >
                    {getHeaderLabel(header)}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${isActiveSort
                        ? `${sortDirection === "asc" ? "rotate-180" : ""} text-[#4f49e2]`
                        : "text-[#a3aed0]"
                        }`}
                    />
                  </button>
                );
              })}
              <span className="px-3 break-words whitespace-normal text-right uppercase tracking-[0.08em]">
                Action
              </span>
            </div>
            <div className="divide-y divide-[#eef1f7] bg-white">
              {sortedLlms.map((item, index) => {
                const rowKey = `${formatCellValue(item.model_id)}-${index}`;
                const modelId = formatCellValue(item.model_id);
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
                        const providerValue = formatCellValue(item[header]);
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
