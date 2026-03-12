"use client";

import {
  Bot,
  ChevronDown,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { formatDateTime, getProviderIconSrc } from "../llm-management/llmHelpers";

type AgentRecord = {
  agentId: number;
  name: string;
  port: number | null;
  status: string;
  enterprise: string;
  start_time: string | null;
  stop_time: string | null;
  agent_id: string | null;
  description: string | null;
  instruction: string | null;
  model_id: string | null;
  modelName: string | null;
  modelProvider: string | null;
  created_at: string | null;
  updated_at: string | null;
};
type AgentRegistryProps = {
  agents: AgentRecord[];
  isLoading: boolean;
  loadError: string;
  onDeleteSuccess?: () => void | Promise<void>;
  onStatusUpdateSuccess?: () => void | Promise<void>;
};

type SortKey = "name" | "created_at" | "updated_at" | "status";

export default function AgentRegistry({
  agents,
  isLoading,
  loadError,
  onDeleteSuccess,
  onStatusUpdateSuccess,
}: AgentRegistryProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [openActionMenuKey, setOpenActionMenuKey] = useState<string | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<AgentRecord | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState("");
  const [updatingStatusRowKey, setUpdatingStatusRowKey] = useState<string | null>(
    null
  );
  const [toastMessage, setToastMessage] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const agentManagerBaseUrl = trimTrailingSlash(llmManagerApiBaseUrl);

  const getErrorMessage = (payload: unknown, fallback: string) => {
    if (
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
    ) {
      return String((payload as { message: string }).message);
    }
    return fallback;
  };

  const getAgentRowKey = (agent: AgentRecord, fallbackIndex: number) => {
    if (agent.agent_id) {
      return agent.agent_id;
    }
    if (agent.agentId) {
      return String(agent.agentId);
    }
    return `${agent.name}-${fallbackIndex}`;
  };

  const isOnlineStatus = (statusValue: string | null | undefined) => {
    const normalized = statusValue?.trim().toLowerCase() ?? "";
    return (
      normalized === "started" ||
      normalized === "active" ||
      normalized === "online"
    );
  };

  const formatStatusLabel = (statusValue: string | null | undefined) => {
    const normalized = statusValue?.trim();
    if (!normalized) {
      return "Offline";
    }
    return normalized
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  };

  const getStatusTone = (statusValue: string | null | undefined) => {
    const normalized = statusValue?.trim().toLowerCase() ?? "";
    if (normalized === "active" || normalized === "online" || normalized === "started") {
      return {
        text: "text-[#166534]",
        bg: "bg-[#dcfce7]",
        dot: "bg-[#16a34a]",
        border: "border-[#bbf7d0]",
      };
    }
    if (normalized === "inactive" || normalized === "offline" || normalized === "stopped") {
      return {
        text: "text-[#9a3412]",
        bg: "bg-[#ffedd5]",
        dot: "bg-[#f97316]",
        border: "border-[#fed7aa]",
      };
    }
    return {
      text: "text-[#334155]",
      bg: "bg-[#e2e8f0]",
      dot: "bg-[#64748b]",
      border: "border-[#cbd5e1]",
    };
  };

  const filteredAgents = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const statusFiltered =
      filter === "all"
        ? agents
        : agents.filter((agent) =>
            filter === "online"
              ? isOnlineStatus(agent.status)
              : !isOnlineStatus(agent.status)
          );
    if (!normalizedSearch) {
      return statusFiltered;
    }
    return statusFiltered.filter((agent) =>
      [
        agent.name,
        agent.description,
        agent.modelName,
        agent.modelProvider,
        agent.instruction,
        agent.status,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [agents, filter, searchValue]);

  const sortedAgents = useMemo(() => {
    const rows = [...filteredAgents];
    rows.sort((left, right) => {
      if (sortKey === "name") {
        const leftValue = (left.name || "").toLowerCase();
        const rightValue = (right.name || "").toLowerCase();
        const compare = leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortDirection === "asc" ? compare : -compare;
      }

      if (sortKey === "status") {
        const leftValue = formatStatusLabel(left.status);
        const rightValue = formatStatusLabel(right.status);
        const compare = leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortDirection === "asc" ? compare : -compare;
      }

      const leftDate =
        sortKey === "created_at" ? left.created_at : left.updated_at;
      const rightDate =
        sortKey === "created_at" ? right.created_at : right.updated_at;
      const leftTime = leftDate ? new Date(leftDate).getTime() : 0;
      const rightTime = rightDate ? new Date(rightDate).getTime() : 0;
      const leftSafe = Number.isNaN(leftTime) ? 0 : leftTime;
      const rightSafe = Number.isNaN(rightTime) ? 0 : rightTime;
      return sortDirection === "asc"
        ? leftSafe - rightSafe
        : rightSafe - leftSafe;
    });
    return rows;
  }, [filteredAgents, sortDirection, sortKey]);

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "name" || nextKey === "status" ? "asc" : "desc");
  };

  const renderWrappedText = (value: string | null | undefined) => {
    const content = value?.trim() || "-";
    if (content === "-") {
      return <span className="text-[#64748b]">-</span>;
    }
    return (
      <span className="block break-words whitespace-normal leading-snug text-[#2b3341]">
        {content}
      </span>
    );
  };

  const splitDateTime = (formattedValue: string) => {
    if (formattedValue === "-") {
      return { date: "-", time: "" };
    }
    const splitAt = formattedValue.lastIndexOf(", ");
    if (splitAt === -1) {
      return { date: formattedValue, time: "" };
    }
    return {
      date: formattedValue.slice(0, splitAt),
      time: formattedValue.slice(splitAt + 2),
    };
  };

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(sortedAgents.length / pageSize));
  const pagedAgents = sortedAgents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [agents.length, filter, searchValue, sortDirection, sortKey]);

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }
    const timer = setTimeout(() => {
      setIsToastVisible(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isToastVisible]);

  useEffect(() => {
    if (!openActionMenuKey) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-action-menu='true']")) {
        setOpenActionMenuKey(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openActionMenuKey]);


  const agentCount = agents.length;

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const agentId = deleteTarget.agent_id?.trim();
      if (!agentId) {
        setDeleteError("Agent ID is missing. Unable to delete agent.");
        return;
      }

      const url = `${agentManagerBaseUrl}/agent/${encodeURIComponent(agentId)}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok) {
        setDeleteTarget(null);
        await onDeleteSuccess?.();
        return;
      }

      setDeleteError(getErrorMessage(data, "Unable to delete agent."));
    } catch {
      setDeleteError("Unable to delete agent.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAgentEnabled = async (
    agent: AgentRecord,
    rowKey: string,
    nextStatus: "active" | "inactive"
  ) => {
    if (updatingStatusRowKey) {
      return false;
    }
    if (!agent.agent_id) {
      setStatusUpdateError("Agent ID is missing. Unable to update status.");
      return false;
    }

    setUpdatingStatusRowKey(rowKey);
    setStatusUpdateError("");

    try {
      const response = await fetch(`${agentManagerBaseUrl}/agent/`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: agent.agent_id,
          isEnabled: nextStatus === "active",
        }),
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setStatusUpdateError(getErrorMessage(data, "Unable to update status."));
        return false;
      }

      setToastMessage(
        nextStatus === "active"
          ? "Agent enabled successfully."
          : "Agent disabled successfully."
      );
      setIsToastVisible(true);
      await onStatusUpdateSuccess?.();
      return true;
    } catch {
      setStatusUpdateError("Unable to update status.");
      return false;
    } finally {
      setUpdatingStatusRowKey(null);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-[#111827]">
            Agent Registry
          </h3>
          <span className="rounded-md border border-[#cbd2ff] px-2 py-0.5 text-xs font-semibold text-[#5b4cf0]">
            {agentCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-xl bg-[#eef2ff] px-4 py-2 text-sm text-[#4f49e2] transition-all duration-200 ${
              isSearchFocused ? "w-64" : "w-44"
            }`}
          >
            <Search className="h-4 w-4" />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search Agents.."
              className="w-full bg-transparent text-sm text-[#4f49e2] placeholder:text-[#4f49e2] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                filter === "all"
                  ? "bg-[#4f49e2] text-white"
                  : "border border-[#e0e5f0] text-[#111827]"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("online")}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                filter === "online"
                  ? "bg-[#4f49e2] text-white"
                  : "border border-[#e0e5f0] text-[#111827]"
              }`}
            >
              Online
            </button>
            <button
              type="button"
              onClick={() => setFilter("offline")}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                filter === "offline"
                  ? "bg-[#4f49e2] text-white"
                  : "border border-[#e0e5f0] text-[#111827]"
              }`}
            >
              Offline
            </button>
          </div>
        </div>
      </div>

      {statusUpdateError ? (
        <div className="mt-3 rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
          {statusUpdateError}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-hidden overflow-y-visible rounded-2xl border border-[#eef1f7]">
        {isLoading ? (
          <div className="bg-white">
            <div className="hidden grid-cols-[1.1fr_1.2fr_1.5fr_1.4fr_0.9fr_0.9fr_0.8fr_0.9fr] bg-[#eaf0f8] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0f172a] md:grid">
              <span>Name</span>
              <span>Description</span>
              <span>Model name</span>
              <span>Instructions</span>
              <span>Created at</span>
              <span>Updated at</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            <div className="hidden divide-y divide-[#eef1f7] md:block">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`desktop-skeleton-${index}`}
                  className="grid animate-pulse grid-cols-[1.1fr_1.2fr_1.5fr_1.4fr_0.9fr_0.9fr_0.8fr_0.9fr] items-center px-4 py-3"
                >
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <span
                      key={`desktop-skeleton-cell-${index}-${cellIndex}`}
                      className="mr-3 h-4 rounded bg-[#edf2f9]"
                    />
                  ))}
                  <span className="ml-auto h-8 w-24 rounded-lg bg-[#edf2f9]" />
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
              Unable to load agents
            </p>
            <p className="text-sm text-[#6b7280]">{loadError}</p>
          </div>
        ) : sortedAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 bg-white px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2] shadow-[0_12px_24px_-20px_rgba(79,73,226,0.8)]">
              <Bot className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-[#111827]">
                {agents.length === 0 && filter === "all"
                  ? "No agents yet"
                  : filter === "online"
                    ? "No Online agents yet"
                    : filter === "offline"
                      ? "No Offline agents yet"
                      : "No agents found"}
              </p>
              {agents.length === 0 && filter === "all" ? (
                <p className="text-sm text-[#6b7280]">
                  Create one to start monitoring and automating tasks.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <div className="grid grid-cols-[1.1fr_1.2fr_1.5fr_1.4fr_0.9fr_0.9fr_0.8fr_0.9fr] items-stretch divide-x divide-[#d7e0ee] bg-[#eaf0f8] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0f172a]">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="inline-flex h-full w-full items-center justify-start gap-1 px-3 text-left leading-tight whitespace-normal break-words transition hover:text-[#4f49e2]"
                >
                  Name
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${
                      sortKey === "name"
                        ? `${sortDirection === "asc" ? "rotate-180" : ""} text-[#4f49e2]`
                        : "text-[#94a3b8]"
                    }`}
                  />
                </button>
                <div className="flex h-full items-center px-3 text-left leading-tight whitespace-normal break-words">
                  Description
                </div>
                <div className="flex h-full items-center px-3 text-left leading-tight whitespace-normal break-words">
                  Model name
                </div>
                <div className="flex h-full items-center px-3 text-left leading-tight whitespace-normal break-words">
                  Instructions
                </div>
                <button
                  type="button"
                  onClick={() => handleSort("created_at")}
                  className="inline-flex h-full w-full items-center justify-start gap-1 px-3 text-left leading-tight whitespace-normal break-words transition hover:text-[#4f49e2]"
                >
                  Created at
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${
                      sortKey === "created_at"
                        ? `${sortDirection === "asc" ? "rotate-180" : ""} text-[#4f49e2]`
                        : "text-[#94a3b8]"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleSort("updated_at")}
                  className="inline-flex h-full w-full items-center justify-start gap-1 px-3 text-left leading-tight whitespace-normal break-words transition hover:text-[#4f49e2]"
                >
                  Updated at
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${
                      sortKey === "updated_at"
                        ? `${sortDirection === "asc" ? "rotate-180" : ""} text-[#4f49e2]`
                        : "text-[#94a3b8]"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleSort("status")}
                  className="inline-flex h-full w-full items-center justify-center gap-1 px-3 text-center leading-tight whitespace-normal break-words transition hover:text-[#4f49e2]"
                >
                  Status
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${
                      sortKey === "status"
                        ? `${sortDirection === "asc" ? "rotate-180" : ""} text-[#4f49e2]`
                        : "text-[#94a3b8]"
                    }`}
                  />
                </button>
                <div className="flex h-full items-center justify-end px-3 text-right leading-tight whitespace-normal break-words">
                  Action
                </div>
              </div>
              <div className="divide-y divide-[#eef1f7] bg-white">
                {pagedAgents.map((agent, index) => {
                  const rowKey = getAgentRowKey(agent, index);
                  const modelName = agent.modelName || agent.model_id || "-";
                  const providerValue = agent.modelProvider || "-";
                  const providerIcon = getProviderIconSrc(agent.modelProvider);
                  const createdAt = formatDateTime(agent.created_at);
                  const updatedAt = formatDateTime(agent.updated_at);
                  const createdDateParts = splitDateTime(createdAt);
                  const updatedDateParts = splitDateTime(updatedAt);
                  const statusLabel = formatStatusLabel(agent.status);
                  const statusTone = getStatusTone(agent.status);
                  const nextStatus = isOnlineStatus(agent.status)
                    ? "inactive"
                    : "active";
                  return (
                    <div
                      key={`desktop-row-${rowKey}`}
                      className="grid grid-cols-[1.1fr_1.2fr_1.5fr_1.4fr_0.9fr_0.9fr_0.8fr_0.9fr] items-stretch divide-x divide-[#e8eef7] px-4 py-3 text-sm text-[#2b3341] transition-colors hover:bg-[#f8fbff]"
                    >
                      <div className="flex h-full items-start px-3">
                        <span
                          className="block break-words whitespace-normal font-semibold leading-snug text-[#0f172a]"
                          title={agent.name || "-"}
                        >
                          {agent.name || "-"}
                        </span>
                      </div>
                      <div className="flex h-full items-start px-3">
                        {renderWrappedText(agent.description)}
                      </div>
                      <div className="flex h-full min-w-0 items-start px-3">
                        <span className="inline-flex max-w-full items-start gap-3">
                          {providerIcon ? (
                            <Image
                              src={providerIcon}
                              alt={`${providerValue} logo`}
                              width={20}
                              height={20}
                              className="h-5 w-5 flex-none object-contain"
                            />
                          ) : (
                            <span className="h-5 w-5 flex-none rounded-full bg-[#e2e8f0]" />
                          )}
                          <span className="min-w-0">
                            <span
                              className="block break-words whitespace-normal font-semibold leading-snug text-[#0f172a]"
                              title={modelName}
                            >
                              {modelName}
                            </span>
                            <span
                              className="mt-1 block break-words whitespace-normal text-[11px] uppercase tracking-[0.08em] text-[#64748b]"
                              title={providerValue}
                            >
                              {providerValue}
                            </span>
                          </span>
                        </span>
                      </div>
                      <div className="flex h-full items-start px-3">
                        {renderWrappedText(agent.instruction)}
                      </div>
                      <div className="flex h-full min-w-0 flex-col items-start justify-center px-3 text-left text-[#334155]" title={agent.created_at || "-"}>
                        <span className="block leading-tight">
                          {createdDateParts.date}
                        </span>
                        {createdDateParts.time ? (
                          <span className="mt-0.5 block text-xs leading-tight text-[#64748b]">
                            {createdDateParts.time}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex h-full min-w-0 flex-col items-start justify-center px-3 text-left text-[#334155]" title={agent.updated_at || "-"}>
                        <span className="block leading-tight">
                          {updatedDateParts.date}
                        </span>
                        {updatedDateParts.time ? (
                          <span className="mt-0.5 block text-xs leading-tight text-[#64748b]">
                            {updatedDateParts.time}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex h-full items-center justify-center px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone.bg} ${statusTone.text} ${statusTone.border}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex h-full items-center justify-end px-3">
                        <div className="relative" data-action-menu="true">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionMenuKey((previous) =>
                                previous === rowKey ? null : rowKey
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8e1f0] text-[#475569] transition hover:bg-[#eef2ff] hover:text-[#4f49e2]"
                            aria-label={`Open actions for ${agent.name}`}
                            title="Actions"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition ${
                                openActionMenuKey === rowKey
                                  ? "rotate-180 text-[#4f49e2]"
                                  : ""
                              }`}
                            />
                          </button>

                          {openActionMenuKey === rowKey ? (
                            <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)]">
                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleAgentEnabled(agent, rowKey, nextStatus);
                                  setOpenActionMenuKey(null);
                                }}
                                disabled
                                title="Temporarily disabled"
                                className="flex w-full cursor-not-allowed items-center gap-2 bg-[#f8fafc] px-3 py-2 text-left text-sm text-[#94a3b8]"
                              >
                                <Power className="h-4 w-4" />
                                {isOnlineStatus(agent.status) ? "Disable" : "Enable"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTarget(agent);
                                  setDeleteError("");
                                  setOpenActionMenuKey(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#b91c1c] hover:bg-[#fff1f2]"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-[#eef1f7] bg-white md:hidden">
              {pagedAgents.map((agent, index) => {
                const rowKey = getAgentRowKey(agent, index);
                const modelName = agent.modelName || agent.model_id || "-";
                const providerValue = agent.modelProvider || "-";
                const providerIcon = getProviderIconSrc(agent.modelProvider);
                const createdAt = formatDateTime(agent.created_at);
                const updatedAt = formatDateTime(agent.updated_at);
                const statusLabel = formatStatusLabel(agent.status);
                const statusTone = getStatusTone(agent.status);
                const nextStatus = isOnlineStatus(agent.status)
                  ? "inactive"
                  : "active";
                return (
                  <div
                    key={`mobile-row-${rowKey}`}
                    className="space-y-3 px-4 py-4 text-sm text-[#2b3341]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[#0f172a]">
                          {agent.name || "-"}
                        </p>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {createdAt} updated {updatedAt}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone.bg} ${statusTone.text} ${statusTone.border}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
                        {statusLabel}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                        Description
                      </p>
                      <div className="mt-1">
                        {renderWrappedText(agent.description)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#e6ebf5] bg-[#f8fafc] px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                        Model
                      </p>
                      <div className="mt-2 inline-flex max-w-full items-center gap-3">
                        {providerIcon ? (
                          <Image
                            src={providerIcon}
                            alt={`${providerValue} logo`}
                            width={20}
                            height={20}
                            className="h-5 w-5 flex-none object-contain"
                          />
                        ) : (
                          <span className="h-5 w-5 flex-none rounded-full bg-[#e2e8f0]" />
                        )}
                        <span className="min-w-0 text-left">
                          <span className="block truncate font-semibold text-[#0f172a]">
                            {modelName}
                          </span>
                          <span className="block truncate text-[11px] uppercase tracking-[0.08em] text-[#64748b]">
                            {providerValue}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                        Instructions
                      </p>
                      <div className="mt-1">
                        {renderWrappedText(agent.instruction)}
                      </div>
                    </div>
                    <div className="relative" data-action-menu="true">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenActionMenuKey((previous) =>
                            previous === rowKey ? null : rowKey
                          )
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#dce3f1] px-3 py-2 text-xs font-semibold text-[#334155] transition hover:bg-[#eef2ff] hover:text-[#4f49e2]"
                      >
                        Actions
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition ${
                            openActionMenuKey === rowKey
                              ? "rotate-180 text-[#4f49e2]"
                              : ""
                          }`}
                        />
                      </button>

                      {openActionMenuKey === rowKey ? (
                        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)]">
                          <button
                            type="button"
                            onClick={() => {
                              handleToggleAgentEnabled(agent, rowKey, nextStatus);
                              setOpenActionMenuKey(null);
                            }}
                            disabled
                            title="Temporarily disabled"
                            className="flex w-full cursor-not-allowed items-center gap-2 bg-[#f8fafc] px-3 py-2 text-left text-sm text-[#94a3b8]"
                          >
                            <Power className="h-4 w-4" />
                            {isOnlineStatus(agent.status) ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(agent);
                              setDeleteError("");
                              setOpenActionMenuKey(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#b91c1c] hover:bg-[#fff1f2]"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-[#eef1f7] bg-white px-4 py-3 text-sm text-[#6b7280]">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    currentPage === 1
                      ? "cursor-not-allowed border-[#e5e7eb] text-[#9ca3af]"
                      : "border-[#e0e5f0] text-[#111827] hover:bg-[#eef2ff]"
                  }`}
                >
                  Prev
                </button>
                <span className="text-xs font-semibold text-[#6b7280]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    currentPage === totalPages
                      ? "cursor-not-allowed border-[#e5e7eb] text-[#9ca3af]"
                      : "border-[#e0e5f0] text-[#111827] hover:bg-[#eef2ff]"
                  }`}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#fee2e2] bg-[#fff5f5] px-6 py-4">
              <div className="flex items-center gap-2 text-[#b91c1c]">
                <Trash2 className="h-5 w-5" />
                <h4 className="text-lg font-semibold">Delete Agent</h4>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b91c1c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#374151]">
                Are you sure you want to delete{" "}
                <span className="rounded-md bg-[#fee2e2] px-2 py-0.5 font-semibold text-[#b91c1c]">
                  {deleteTarget.name}
                </span>
                ?
              </p>
              <p className="mt-3 text-xs text-[#9b1c1c]">
                This action can’t be undone.
              </p>
              {deleteError ? (
                <p className="mt-3 text-sm text-[#dc2626]">{deleteError}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] ${
                  isDeleting
                    ? "cursor-not-allowed bg-[#fca5a5]"
                    : "bg-[#ef4444] hover:bg-[#dc2626]"
                }`}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isToastVisible ? (
        <div className="fixed bottom-6 right-6 z-[80]">
          <div className="toast-fade relative rounded-2xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(79,73,226,0.8)]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4 items-center justify-center rounded-full border-2 border-white/60">
                <span className="toast-dot-fill absolute inset-0 rounded-full bg-white" />
              </span>
              <span>{toastMessage}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-2xl bg-white/25">
              <span className="toast-progress-bar block h-full w-full bg-white/70" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
