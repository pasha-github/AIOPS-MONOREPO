"use client";

import ActionMenu, { type ActionMenuItem } from "@/components/ActionMenu";
import ExpandableMarkdownText from "@/components/ExpandableMarkdownText";
import Searchbar from "@/components/Searchbar";
import {
  ModalCard,
  ModalCardBody,
  ModalCardFooter,
  ModalCardPanel,
} from "@/components/modalcards";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import {
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  Eye,
  Pencil,
  Power,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { formatDateTime, getProviderIconSrc } from "../llm-management/llmHelpers";
import InspectAgent from "./Inspect Agent";
import JobsAgentManagement from "./JobsAgentManagement";
import {
  fetchAgentTokenUsageMap,
  type AgentTokenUsage,
} from "./Observability";
import WebhookAgentManagement from "./WebhookAgentManagement";
import DropdownAgentType, { type AgentDropdownType } from "./dropdownagenttype";
import type { AgentRecord } from "./types";
import UpdateAgent from "./updateagent";
type AgentRegistryProps = {
  agents: AgentRecord[];
  isLoading: boolean;
  loadError: string;
  onDeleteSuccess?: () => void | Promise<void>;
  onStatusUpdateSuccess?: () => void | Promise<void>;
};

type SortKey = "name" | "updated_at" | "status";
const EMPTY_VALUE_LABEL = "None";

export default function AgentRegistry({
  agents,
  isLoading,
  loadError,
  onDeleteSuccess,
  onStatusUpdateSuccess,
}: AgentRegistryProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const [agentTypeFilter, setAgentTypeFilter] = useState<AgentDropdownType>("all");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchValue, setSearchValue] = useState("");
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
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<AgentRecord | null>(null);
  const [jobsTarget, setJobsTarget] = useState<AgentRecord | null>(null);
  const [webhookTarget, setWebhookTarget] = useState<AgentRecord | null>(null);
  const [tokenUsageByAgentId, setTokenUsageByAgentId] = useState<
    Record<string, AgentTokenUsage>
  >({});
  const [isTokenUsageLoading, setIsTokenUsageLoading] = useState(false);
  const [instructionDialogTarget, setInstructionDialogTarget] =
    useState<{ title: string; content: string } | null>(null);

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

  const getAgentDisplayStatus = (agent: AgentRecord) => {
    const target = agent.deployment_target?.trim().toLowerCase();
    if (target === "vertex") {
      return agent.vertex_deployment_status ?? agent.status;
    }
    return agent.status;
  };

  const getDeploymentTargetLabel = (agent: AgentRecord) => {
    const target = agent.deployment_target?.trim();
    if (!target) {
      return EMPTY_VALUE_LABEL;
    }
    return target
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
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
        bg: "bg-transparent",
        dot: "bg-[#16a34a]",
      };
    }
    if (normalized === "inactive" || normalized === "offline" || normalized === "stopped") {
      return {
        text: "text-[#9a3412]",
        bg: "bg-transparent",
        dot: "bg-[#f97316]",
      };
    }
    return {
      text: "text-[#334155]",
      bg: "bg-transparent",
      dot: "bg-[#64748b]",
    };
  };

  const filteredAgents = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const typeFiltered =
      agentTypeFilter === "all"
        ? agents
        : agents.filter((agent) => {
            const normalizedType = agent.type?.trim().toLowerCase();
            return agentTypeFilter === "automation"
              ? normalizedType === "automation"
              : normalizedType !== "automation";
          });
    const statusFiltered =
      filter === "all"
        ? typeFiltered
        : typeFiltered.filter((agent) =>
            filter === "online"
              ? isOnlineStatus(getAgentDisplayStatus(agent))
              : !isOnlineStatus(getAgentDisplayStatus(agent))
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
        agent.primary_model_id,
        agent.secondary_model_id,
        agent.tertiary_model_id,
        agent.deployment_target,
        agent.prompt_role,
        agent.status,
        agent.type,
        getAgentDisplayStatus(agent),
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [agentTypeFilter, agents, filter, searchValue]);

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
        const leftValue = formatStatusLabel(getAgentDisplayStatus(left));
        const rightValue = formatStatusLabel(getAgentDisplayStatus(right));
        const compare = leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortDirection === "asc" ? compare : -compare;
      }

      const leftDate = left.updated_at;
      const rightDate = right.updated_at;
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

  const agentTypeCounts = useMemo(
    () => ({
      all: agents.length,
      automation: agents.filter(
        (agent) => agent.type?.trim().toLowerCase() === "automation"
      ).length,
      conversational: agents.filter(
        (agent) => agent.type?.trim().toLowerCase() !== "automation"
      ).length,
    }),
    [agents]
  );

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "name" || nextKey === "status" ? "asc" : "desc");
  };

  const splitDateTime = (formattedValue: string) => {
    if (formattedValue === EMPTY_VALUE_LABEL) {
      return { date: EMPTY_VALUE_LABEL, time: "" };
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

  const getAgentLlmSlots = (agent: AgentRecord) => [
    {
      label: "Primary",
      modelLabel:
        agent.primary_model_name ?? agent.modelName ?? agent.primary_model_id ?? agent.model_id ?? null,
      provider:
        agent.primary_model_provider ?? agent.modelProvider ?? null,
    },
    {
      label: "Secondary",
      modelLabel: agent.secondary_model_name ?? agent.secondary_model_id ?? null,
      provider: agent.secondary_model_provider ?? null,
    },
    {
      label: "Tertiary",
      modelLabel: agent.tertiary_model_name ?? agent.tertiary_model_id ?? null,
      provider: agent.tertiary_model_provider ?? null,
    },
  ];

  const renderAgentLlmList = (
    agent: AgentRecord,
    options?: { mobile?: boolean }
  ) => {
    const slots = getAgentLlmSlots(agent);
    return (
      <div className={`grid gap-2 ${options?.mobile ? "" : "w-full"}`}>
        {slots.map((slot) => {
          const providerIcon = getProviderIconSrc(slot.provider);
          const providerLabel = slot.provider?.trim() || EMPTY_VALUE_LABEL;
          const modelLabel = slot.modelLabel?.trim() || EMPTY_VALUE_LABEL;
          return (
            <div
              key={`${agent.agent_id || agent.name}-${slot.label}`}
              className="flex min-w-0 items-center gap-3"
            >
              {providerIcon ? (
                <Image
                  src={providerIcon}
                  alt={`${providerLabel} logo`}
                  width={18}
                  height={18}
                  className="h-4.5 w-4.5 flex-none object-contain"
                />
              ) : (
                <span className="h-4.5 w-4.5 flex-none rounded-full bg-[#e2e8f0]" />
              )}
              <span className="min-w-0 text-left">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                  {slot.label}
                </span>
                <span
                  className="block break-words whitespace-normal font-semibold leading-snug text-[#111827]"
                  title={modelLabel}
                >
                  {modelLabel}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTokenUsage = (
    agent: AgentRecord,
    options?: { mobile?: boolean }
  ) => {
    const tokenUsage = agent.agent_id
      ? tokenUsageByAgentId[agent.agent_id.trim()]
      : undefined;
    const numberFormatter = new Intl.NumberFormat();
    const rows = [
      {
        label: "Input Tokens",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.input_tokens)
            ? numberFormatter.format(tokenUsage.input_tokens)
            : EMPTY_VALUE_LABEL,
      },
      {
        label: "Output Tokens",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.output_tokens)
            ? numberFormatter.format(tokenUsage.output_tokens)
            : EMPTY_VALUE_LABEL,
      },
      {
        label: "Total Tokens",
        value:
          tokenUsage && !Number.isNaN(tokenUsage.total_tokens)
            ? numberFormatter.format(tokenUsage.total_tokens)
            : EMPTY_VALUE_LABEL,
      },
    ];

    if (isTokenUsageLoading && !tokenUsage) {
      return (
        <div className={`grid gap-2 ${options?.mobile ? "" : "w-full"}`}>
          {rows.map((row) => (
            <div key={`${agent.agent_id || agent.name}-${row.label}`} className="space-y-1">
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
      <div className={`grid gap-2 ${options?.mobile ? "" : "w-full"}`}>
        {rows.map((row) => (
          <div
            key={`${agent.agent_id || agent.name}-${row.label}`}
            className="min-w-0 text-left"
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
              {row.label}
            </span>
            <span className="block break-words whitespace-normal font-semibold leading-snug text-[#111827]">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(sortedAgents.length / pageSize));
  const pagedAgents = sortedAgents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [agentTypeFilter, agents.length, filter, searchValue, sortDirection, sortKey]);

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
    const controller = new AbortController();
    const agentIds = agents
      .map((agent) => agent.agent_id?.trim() || "")
      .filter(Boolean);

    if (agentIds.length === 0) {
      setTokenUsageByAgentId({});
      setIsTokenUsageLoading(false);
      return () => controller.abort();
    }

    setIsTokenUsageLoading(true);

    void fetchAgentTokenUsageMap(
      agentIds,
      agentManagerBaseUrl,
      controller.signal
    )
      .then((nextTokenUsageByAgentId) => {
        setTokenUsageByAgentId(nextTokenUsageByAgentId);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setTokenUsageByAgentId({});
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsTokenUsageLoading(false);
        }
      });

    return () => controller.abort();
  }, [agentManagerBaseUrl, agents]);

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
        const response = await fetch(
          `${agentManagerBaseUrl}/agent/${encodeURIComponent(agent.agent_id)}`,
          {
          method: "PATCH",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isEnabled: nextStatus === "active",
          }),
          }
        );

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

  const handleUpdateClick = (agent: AgentRecord) => {
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  const getToggleActionItem = (
    agent: AgentRecord,
    rowKey: string,
    nextStatus: "active" | "inactive"
  ): ActionMenuItem => {
    const isEnableAction = nextStatus === "active";

    return {
      label: isEnableAction ? "Enable" : "Disable",
      icon: Power,
      onClick: () => {
        void handleToggleAgentEnabled(agent, rowKey, nextStatus);
      },
      tone: isEnableAction
        ? "bg-[#ecfdf5] text-[#15803d]"
        : "bg-[#fff7ed] text-[#ea580c]",
      hoverTone: isEnableAction
        ? "hover:bg-[#dcfce7]"
        : "hover:bg-[#ffedd5]",
      disabled: updatingStatusRowKey === rowKey,
      disabledTitle:
        updatingStatusRowKey === rowKey ? "Status update in progress" : undefined,
    };
  };

  const isAutomationAgent = (agent: AgentRecord) =>
    agent.type.trim().toLowerCase() === "automation";

  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DropdownAgentType
          value={agentTypeFilter}
          onChange={setAgentTypeFilter}
          allCount={agentTypeCounts.all}
          conversationalCount={agentTypeCounts.conversational}
          automationCount={agentTypeCounts.automation}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Searchbar
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Search Agents.."
            name="agent_search"
          />
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

      <div className="mt-5 overflow-x-auto overflow-hidden rounded-2xl border border-[#eef1f7]">
        {isLoading ? (
          <div className="bg-white">
            <div className="hidden grid-cols-[1fr_1.05fr_1.25fr_1.12fr_0.95fr_0.9fr_0.72fr_0.8fr_0.46fr] items-center divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold tracking-[0.08em] text-[#111827] md:grid">
              <span className="px-3">Name</span>
              <span className="px-3">Description</span>
              <span className="px-3">Models</span>
              <span className="px-3">Role</span>
              <span className="px-3">Timestamps</span>
              <span className="px-3">Token</span>
              <span className="px-3">Deployment Target</span>
              <span className="px-3 text-center">Status</span>
              <span className="px-3 text-right">Action</span>
            </div>
            <div className="hidden divide-y divide-[#eef1f7] md:block">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`desktop-skeleton-${index}`}
                  className="grid animate-pulse grid-cols-[1fr_1.05fr_1.25fr_1.12fr_0.95fr_0.9fr_0.72fr_0.8fr_0.46fr] items-center divide-x divide-[#e8eef7] px-4 py-3"
                >
                  {Array.from({ length: 8 }).map((__, cellIndex) => (
                    <span
                      key={`desktop-skeleton-cell-${index}-${cellIndex}`}
                      className="mx-3 h-4 rounded bg-[#edf2f9]"
                    />
                  ))}
                  <span className="mx-3 h-8 w-24 rounded-lg bg-[#edf2f9]" />
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
              <div className="grid grid-cols-[1fr_1.05fr_1.25fr_1.12fr_0.95fr_0.9fr_0.72fr_0.8fr_0.46fr] items-stretch divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold tracking-[0.02em] text-[#111827]">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="inline-flex h-full w-full items-center justify-center gap-1 px-3 text-center leading-tight whitespace-normal break-words transition"
                >
                  Name

                </button>
                <div className="flex h-full items-center justify-center px-3 text-center leading-tight whitespace-normal break-words">
                  Description
                </div>
                <div className="flex h-full items-center justify-center px-3 text-center leading-tight whitespace-normal break-words">
                  Models
                </div>
                <div className="flex h-full items-center justify-center px-3 text-center leading-tight whitespace-normal break-words">
                  Role
                </div>
                <button
                  type="button"
                  onClick={() => handleSort("updated_at")}
                  className="inline-flex h-full w-full items-center justify-center gap-1 px-3 text-center leading-tight whitespace-normal break-words transition"
                >
                  Timestamps
            
                </button>
                <div className="flex h-full items-center justify-center px-3 text-center leading-tight whitespace-normal break-words">
                  Token
                </div>
                <div className="flex h-full items-center justify-center px-3 text-center leading-tight whitespace-normal break-words">
                  Deployment Target
                </div>
                <button
                  type="button"
                  onClick={() => handleSort("status")}
                  className="inline-flex h-full w-full items-center justify-center gap-1 px-3 text-center leading-tight whitespace-normal break-words transition"
                >
                  Status
                </button>
                <div className="flex h-full items-center justify-center px-3 text-center leading-tight whitespace-normal break-words">
                  Action
                </div>
              </div>
              <div className="divide-y divide-[#eef1f7] bg-white">
                {pagedAgents.map((agent, index) => {
                  const rowKey = getAgentRowKey(agent, index);
                  const createdAt = (() => {
                    const value = formatDateTime(agent.created_at);
                    return value === "-" ? EMPTY_VALUE_LABEL : value;
                  })();
                  const updatedAt = (() => {
                    const value = formatDateTime(agent.updated_at);
                    return value === "-" ? EMPTY_VALUE_LABEL : value;
                  })();
                  const createdDateParts = splitDateTime(createdAt);
                  const updatedDateParts = splitDateTime(updatedAt);
                  const displayStatus = getAgentDisplayStatus(agent);
                  const statusLabel = formatStatusLabel(displayStatus);
                  const statusTone = getStatusTone(displayStatus);
                  const nextStatus = isOnlineStatus(displayStatus)
                    ? "inactive"
                    : "active";
                  return (
                    <div
                      key={`desktop-row-${rowKey}`}
                      className="grid grid-cols-[1fr_1.05fr_1.25fr_1.12fr_0.95fr_0.9fr_0.72fr_0.8fr_0.46fr] items-stretch divide-x divide-[#e8eef7] px-4 py-3 text-sm text-[#2b3341] transition-colors hover:bg-[#f8f9fd]"
                    >
                      <div className="flex h-full items-start px-3">
                        <span
                          className="block break-words whitespace-normal font-semibold leading-snug text-[#111827]"
                          title={agent.name || EMPTY_VALUE_LABEL}
                        >
                          {agent.name || EMPTY_VALUE_LABEL}
                        </span>
                      </div>
                      <div className="flex h-full items-start px-3">
                        <ExpandableMarkdownText
                          value={agent.description}
                          title={`${agent.name} description`}
                          limit={140}
                        />
                      </div>
                      <div className="flex h-full min-w-0 items-start px-3">
                        {renderAgentLlmList(agent)}
                      </div>
                      <div className="flex h-full items-start px-3">
                        <ExpandableMarkdownText
                          value={agent.prompt_role}
                          title={`${agent.name} role`}
                          emptyFallback=""
                        />
                      </div>
                      <div className="flex h-full min-w-0 flex-col items-start justify-center gap-2 px-3 text-left text-[#334155]">
                        <div title={agent.created_at || EMPTY_VALUE_LABEL}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                            Created
                          </p>
                          <span className="mt-0.5 block leading-tight">{createdDateParts.date}</span>
                          {createdDateParts.time ? (
                            <span className="mt-0.5 block text-xs leading-tight text-[#64748b]">
                              {createdDateParts.time}
                            </span>
                          ) : null}
                        </div>
                        <div title={agent.updated_at || EMPTY_VALUE_LABEL}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                            Updated
                          </p>
                          <span className="mt-0.5 block leading-tight">{updatedDateParts.date}</span>
                          {updatedDateParts.time ? (
                            <span className="mt-0.5 block text-xs leading-tight text-[#64748b]">
                              {updatedDateParts.time}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex h-full min-w-0 items-start px-3">
                        {renderTokenUsage(agent)}
                      </div>
                      <div className="flex h-full items-center justify-center px-3 text-center text-[#334155]">
                        <span className="break-words whitespace-normal leading-tight">
                          {getDeploymentTargetLabel(agent)}
                        </span>
                      </div>
                      <div className="flex h-full items-center justify-center px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-semibold ${statusTone.bg} ${statusTone.text}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex h-full items-center justify-center px-3">
                        <ActionMenu
                          align="right"
                            estimatedMenuHeight={isAutomationAgent(agent) ? 258 : 202}
                            actions={[
                              getToggleActionItem(agent, rowKey, nextStatus),
                              {
                                label: "Delete",
                                icon: Trash2,
                                onClick: () => {
                                  setDeleteTarget(agent);
                                setDeleteError("");
                              },
                              tone: "text-[#b91c1c]",
                              hoverTone: "hover:bg-[#fff1f2]",
                            },
                            {
                              label: "View Agent",
                              icon: Bot,
                              onClick: () => setInspectTarget(agent),
                              tone: "text-[#2563eb]",
                              hoverTone: "hover:bg-[#eff6ff]",
                            },
                            {
                              label: "Update",
                              icon: Pencil,
                              onClick: () => handleUpdateClick(agent),
                              tone: "text-[#2563eb]",
                              hoverTone: "hover:bg-[#eff6ff]",
                            },
                            ...(isAutomationAgent(agent)
                              ? ([
                                  {
                                    label: "Jobs",
                                    icon: BriefcaseBusiness,
                                    onClick: () => setJobsTarget(agent),
                                    tone: "text-[#2563eb]",
                                    hoverTone: "hover:bg-[#eff6ff]",
                                  },
                                  {
                                    label: "Webhook",
                                    icon: Webhook,
                                    onClick: () => setWebhookTarget(agent),
                                    tone: "text-[#2563eb]",
                                    hoverTone: "hover:bg-[#eff6ff]",
                                  },
                                ] satisfies ActionMenuItem[])
                              : []),
                          ] satisfies ActionMenuItem[]}
                          renderButton={({ isOpen, toggle, buttonRef }) => (
                            <button
                              ref={buttonRef}
                              type="button"
                              onClick={toggle}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8e1f0] transition ${
                                isOpen
                                  ? "bg-[#eef2ff] text-[#4f49e2]"
                                  : "bg-white text-[#475569] hover:bg-[#eef2ff] hover:text-[#4f49e2]"
                              }`}
                              aria-label={`Open actions for ${agent.name || "agent"}`}
                              title="Actions"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-[#eef1f7] bg-white md:hidden">
              {pagedAgents.map((agent, index) => {
                const rowKey = getAgentRowKey(agent, index);
                const createdAt = (() => {
                  const value = formatDateTime(agent.created_at);
                  return value === "-" ? EMPTY_VALUE_LABEL : value;
                })();
                const updatedAt = (() => {
                  const value = formatDateTime(agent.updated_at);
                  return value === "-" ? EMPTY_VALUE_LABEL : value;
                })();
                const displayStatus = getAgentDisplayStatus(agent);
                const statusLabel = formatStatusLabel(displayStatus);
                const statusTone = getStatusTone(displayStatus);
                const nextStatus = isOnlineStatus(displayStatus)
                  ? "inactive"
                  : "active";
                return (
                  <div
                    key={`mobile-row-${rowKey}`}
                    className="space-y-3 px-4 py-4 text-sm text-[#2b3341]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[#111827]">
                          {agent.name || EMPTY_VALUE_LABEL}
                        </p>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {createdAt} updated {updatedAt}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-semibold ${statusTone.bg} ${statusTone.text}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
                        {statusLabel}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-[#64748b]">
                        Description
                      </p>
                      <div className="mt-1">
                        <ExpandableMarkdownText
                          value={agent.description}
                          title={`${agent.name} description`}
                          limit={140}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#e6ebf5] bg-[#f8fafc] px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                        Models
                      </p>
                      <div className="mt-2">
                        {renderAgentLlmList(agent, { mobile: true })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                        Role
                      </p>
                      <div className="mt-1">
                        <ExpandableMarkdownText
                          value={agent.prompt_role}
                          title={`${agent.name} role`}
                          emptyFallback=""
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#e6ebf5] bg-[#f8fafc] px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                        Token
                      </p>
                      <div className="mt-2">
                        {renderTokenUsage(agent, { mobile: true })}
                      </div>
                    </div>
                    <ActionMenu
                        align="left"
                        estimatedMenuHeight={isAutomationAgent(agent) ? 258 : 202}
                        actions={[
                          getToggleActionItem(agent, rowKey, nextStatus),
                          {
                            label: "Delete",
                            icon: Trash2,
                            onClick: () => {
                              setDeleteTarget(agent);
                            setDeleteError("");
                          },
                          tone: "text-[#b91c1c]",
                          hoverTone: "hover:bg-[#fff1f2]",
                        },
                        {
                          label: "View Agent",
                          icon: Eye,
                          onClick: () => setInspectTarget(agent),
                          tone: "text-[#2563eb]",
                          hoverTone: "hover:bg-[#eff6ff]",
                        },
                        {
                          label: "Update",
                          icon: Pencil,
                          onClick: () => handleUpdateClick(agent),
                          tone: "text-[#2563eb]",
                          hoverTone: "hover:bg-[#eff6ff]",
                        },
                        ...(isAutomationAgent(agent)
                          ? ([
                              {
                                label: "Jobs",
                                icon: BriefcaseBusiness,
                                onClick: () => setJobsTarget(agent),
                                tone: "text-[#2563eb]",
                                hoverTone: "hover:bg-[#eff6ff]",
                              },
                              {
                                label: "Webhook",
                                icon: Webhook,
                                onClick: () => setWebhookTarget(agent),
                                tone: "text-[#2563eb]",
                                hoverTone: "hover:bg-[#eff6ff]",
                              },
                            ] satisfies ActionMenuItem[])
                          : []),
                      ] satisfies ActionMenuItem[]}
                      renderButton={({ isOpen, toggle, buttonRef }) => (
                        <button
                          ref={buttonRef}
                          type="button"
                          onClick={toggle}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#dce3f1] px-3 py-2 text-xs font-semibold transition ${
                            isOpen
                              ? "bg-[#eef2ff] text-[#4f49e2]"
                              : "text-[#334155] hover:bg-[#eef2ff] hover:text-[#4f49e2]"
                          }`}
                        >
                          Actions
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      )}
                    />
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
        <ModalCard zIndexClassName="z-50">
          <ModalCardPanel maxWidthClassName="max-w-md">
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
            <ModalCardBody>
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
            </ModalCardBody>
            <ModalCardFooter>
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
            </ModalCardFooter>
          </ModalCardPanel>
        </ModalCard>
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
      {selectedAgent && (
        <UpdateAgent
          agent={selectedAgent}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpdateSuccess={onStatusUpdateSuccess}
        />
      )}

      {inspectTarget ? (
        <InspectAgent
          agent={inspectTarget}
          isOpen={Boolean(inspectTarget)}
          onClose={() => setInspectTarget(null)}
        />
      ) : null}

      {jobsTarget ? (
        <JobsAgentManagement
          agent={jobsTarget}
          onClose={() => setJobsTarget(null)}
        />
      ) : null}

      {webhookTarget ? (
        <WebhookAgentManagement
          agent={webhookTarget}
          onClose={() => setWebhookTarget(null)}
        />
      ) : null}
    </section>
  );
}
