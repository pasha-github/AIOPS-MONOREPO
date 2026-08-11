"use client";

import DualListPicker from "@/components/DualListPicker";
import {
    ModalCard,
    ModalCardBody,
    ModalCardFooter,
    ModalCardHeader,
    ModalCardPanel,
} from "@/components/modalcards";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Ban, Bot, Download, FileText, Fingerprint, Link2, Regex, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getProviderIconSrc } from "../llm-management/llmHelpers";
import AgentFormPages from "./agentform/AgentFormPages";
import {
    AGENT_TYPE_OPTIONS,
    DEPLOYMENT_TARGET_OPTIONS,
    MEMORY_BANK_OPTIONS,
    PROMPT_FIELD_DEFINITIONS,
    SUB_AGENT_DELEGATION_OPTIONS,
    type AgentLookupOption,
    type AgentRecord,
} from "./types";

type InspectAgentProps = {
    agent: AgentRecord;
    isOpen: boolean;
    onClose: () => void;
};

type LookupOption = {
    value: string;
    label: string;
};

type McpLookupOption = {
    id: string;
    name: string;
    serverUrl: string;
};

type ConnectorConfigRecord = {
    connector_config_id?: string;
    name?: string;
};

type KnowledgeFileRecord = {
    id: string;
    filename: string;
    content_type: string;
    size: number;
    created_at: string;
};

type LlmLookupOption = {
    value: string;
    label: string;
    provider: string;
    iconSrc: string | null;
};

const PII_OPTIONS = [
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone n.o" },
    { value: "ssn", label: "SSN" },
    { value: "credit_card", label: "Credit Card" },
    { value: "ip_address", label: "IP Address" },
] as const;

const emptyValue = "Not configured";

const asText = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return emptyValue;
};

const optionLabel = (
    options: Array<{ key: string; value: string | boolean }>,
    value: string | boolean | null | undefined
) => options.find((option) => option.value === value)?.key ?? asText(value);

const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 KB";
    }

    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const normalizeConnectorOptions = (value: unknown): LookupOption[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return [];
        }

        const record = item as Record<string, unknown>;
        const id =
            typeof record.connector_id === "string"
                ? record.connector_id.trim()
                : typeof record.connector_config_id === "string"
                    ? record.connector_config_id.trim()
                : typeof record.id === "string"
                    ? record.id.trim()
                    : "";
        const label =
            typeof record.name === "string" && record.name.trim()
                ? record.name.trim()
                : id;

        return id ? [{ value: id, label }] : [];
    });
};

const normalizeSkillOptions = (value: unknown): LookupOption[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return [];
        }

        const record = item as Record<string, unknown>;
        const id = typeof record.skill_id === "string" ? record.skill_id.trim() : "";
        const label =
            typeof record.name === "string" && record.name.trim()
                ? record.name.trim()
                : id;

        return id ? [{ value: id, label }] : [];
    });
};

const normalizeMcpOptions = (value: unknown): McpLookupOption[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return [];
        }

        const record = item as Record<string, unknown>;
        const id =
            typeof record.mcp_server_id === "string"
                ? record.mcp_server_id.trim()
                : "";
        const name = typeof record.name === "string" ? record.name.trim() : "";
        const serverUrl =
            typeof record.server_url === "string" ? record.server_url.trim() : "";

        return id ? [{ id, name, serverUrl }] : [];
    });
};

const inferProviderFromModelId = (modelId: string) => {
    const value = modelId.toLowerCase();
    if (value.includes("azure_ai")) return "azure_ai";
    if (value.includes("bedrock")) return "bedrock";
    if (value.includes("google") || value.includes("gemini")) return "google";
    if (value.includes("anthropic") || value.includes("claude")) return "anthropic";
    if (value.includes("openai") || value.includes("gpt")) return "openai";
    if (value.includes("groq")) return "groq";
    return "";
};

const normalizeLlmOptions = (value: unknown): LlmLookupOption[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return [];
        }

        const record = item as Record<string, unknown>;
        const modelId = typeof record.model_id === "string" ? record.model_id.trim() : "";
        if (!modelId) {
            return [];
        }

        const provider = typeof record.provider === "string" ? record.provider.trim() : "";
        return [
            {
                value: modelId,
                label:
                    typeof record.name === "string" && record.name.trim()
                        ? record.name.trim()
                        : modelId,
                provider,
                iconSrc: provider ? getProviderIconSrc(provider) : null,
            },
        ];
    });
};

const normalizeKnowledgeFile = (value: unknown): KnowledgeFileRecord | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const record = value as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const filename = typeof record.filename === "string" ? record.filename.trim() : "";

    if (!id || !filename) {
        return null;
    }

    return {
        id,
        filename,
        content_type: typeof record.content_type === "string" ? record.content_type : "",
        size: typeof record.size === "number" ? record.size : 0,
        created_at: typeof record.created_at === "string" ? record.created_at : "",
    };
};

const normalizeAgentOptions = (value: unknown): AgentLookupOption[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return [];
        }

        const record = item as Record<string, unknown>;
        const id = typeof record.agent_id === "string" ? record.agent_id.trim() : "";
        const name = typeof record.name === "string" ? record.name.trim() : "";

        if (!id || !name) {
            return [];
        }

        return [
            {
                id,
                name,
                description:
                    typeof record.description === "string" ? record.description.trim() : "",
            },
        ];
    });
};

const normalizeConnectorConfigRecords = (value: unknown): ConnectorConfigRecord[] => {
    const values = Array.isArray(value) ? value : value ? [value] : [];

    return values.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return [];
        }

        const record = item as Record<string, unknown>;
        const connectorConfigId =
            typeof record.connector_config_id === "string"
                ? record.connector_config_id.trim()
                : "";
        const name = typeof record.name === "string" ? record.name.trim() : "";

        return connectorConfigId
            ? [{ connector_config_id: connectorConfigId, name }]
            : [];
    });
};

function ReadOnlyField({
    label,
    value,
    multiline = false,
}: {
    label: string;
    value: unknown;
    multiline?: boolean;
}) {
    const displayValue = asText(value);

    return (
        <label className="block">
            <span className="text-sm font-semibold text-slate-700">{label}</span>
            {multiline ? (
                <textarea
                    readOnly
                    value={displayValue}
                    rows={5}
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none"
                />
            ) : (
                <input
                    readOnly
                    value={displayValue}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none"
                />
            )}
        </label>
    );
}

function ReadOnlyPromptInstructions({ agent }: { agent: AgentRecord }) {
    return (
        <div className="grid gap-3">
            {PROMPT_FIELD_DEFINITIONS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                        {field.label}
                        {field.required ? <span className="text-red-500">*</span> : null}
                    </label>
                    <p className="text-xs leading-snug text-gray-400">
                        Define the {field.label.toLowerCase()} for this agent
                    </p>
                    <textarea
                        readOnly
                        value={asText(agent[field.key])}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        rows={3}
                        className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition"
                    />
                </div>
            ))}
        </div>
    );
}

function ReadOnlyIntegrationSection({
    label,
    hint,
    values,
    icon,
    imageSrc,
}: {
    label: string;
    hint?: string;
    values: string[];
    icon?: ReactNode;
    imageSrc?: string;
}) {
    const normalizedValues = values.filter((value) => value.trim().length > 0);

    return (
        <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                {imageSrc ? (
                    <div className="relative h-5 w-5 shrink-0">
                        <Image src={imageSrc} alt={label} fill className="object-contain" />
                    </div>
                ) : icon}
                {label}
            </label>
            {hint ? <p className="text-xs leading-snug text-gray-400">{hint}</p> : null}

            <div className="flex flex-col gap-2">
                {normalizedValues.length ? (
                    normalizedValues.map((value, index) => (
                        <div
                            key={`${value}-${index}`}
                            className="min-h-[42px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"
                        >
                            {value}
                        </div>
                    ))
                ) : (
                    <div className="min-h-[42px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400">
                        {emptyValue}
                    </div>
                )}
            </div>
        </div>
    );
}

function ReadOnlySubAgentsSection({
    agentId,
    subAgentIds,
    delegationType,
    agentOptions,
    isLoading,
}: {
    agentId: string;
    subAgentIds: string[];
    delegationType: string;
    agentOptions: AgentLookupOption[];
    isLoading: boolean;
}) {
    const normalizedSubAgentIds = subAgentIds.filter((id) =>
        agentOptions.some((option) => option.id === id)
    );

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                        <Bot size={18} />
                        Sub-Agents
                    </label>
                    <p className="mt-1 text-xs leading-snug text-gray-400">
                        Choose sub-agents to include with this agent
                    </p>
                </div>
                <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                    <label className="shrink-0 text-xs font-semibold text-[#7a8498]">
                        Delegation Type
                    </label>
                    <div className="h-11 w-[150px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
                        <div className="flex h-full items-center">{delegationType}</div>
                    </div>
                </div>
            </div>
            <div className="mt-3">
                <DualListPicker
                    availableTitle="Available Agents"
                    selectedTitle="Selected Sub-Agents"
                    items={agentOptions
                        .filter((option) => option.id !== agentId)
                        .map((option) => ({
                            id: option.id,
                            name: option.name,
                        }))}
                    selectedIds={normalizedSubAgentIds}
                    disabled
                    emptyAvailableMessage={
                        isLoading ? "Loading agents..." : "No agents available"
                    }
                    emptySelectedMessage="No sub-agents selected"
                    onChange={() => undefined}
                    renderAvailableItem={(item) => (
                        <div className="min-w-0">
                            <div className="break-words font-medium">{item.name}</div>
                        </div>
                    )}
                    renderSelectedItem={(item) => (
                        <div className="w-full min-w-0">
                            <div className="break-words font-medium">{item.name}</div>
                        </div>
                    )}
                />
            </div>
        </div>
    );
}

function ReadOnlyGuardrailsSection({
    enabled,
    piiPatterns,
    sensitivePatternsText,
    harmfulKeywords,
}: {
    enabled: boolean;
    piiPatterns: string[];
    sensitivePatternsText: string;
    harmfulKeywords: string[];
}) {
    return (
        <div className="col-span-2">
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <ShieldCheck size={18} className="text-[#475569]" />
                        Guardrails
                    </label>
                    <p className="mt-1 text-xs leading-snug text-gray-400">
                        Detect sensitive data and harmful terms before agent responses are used.
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                        enabled ? "bg-green-500" : "bg-orange-400"
                    }`}
                >
                    <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                            enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                    />
                </button>
            </div>

            {enabled ? (
                <div className="mt-3 rounded-2xl p-4">
                    <div>
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-700">
                            <Fingerprint size={14} className="text-[#475569]" />
                            PII patterns
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-5">
                            {PII_OPTIONS.map((option) => (
                                <label
                                    key={option.value}
                                    className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                                >
                                    <input
                                        type="checkbox"
                                        checked={piiPatterns.includes(option.value)}
                                        disabled
                                        readOnly
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                    />
                                    <span className="whitespace-nowrap">{option.label}</span>
                                </label>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                            Please select data category to mask.
                        </p>
                    </div>

                    <div className="mt-4">
                        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-700">
                            <Regex size={14} className="text-[#475569]" />
                            Sensitive regex patterns
                        </label>
                        <textarea
                            readOnly
                            value={sensitivePatternsText || ""}
                            rows={4}
                            placeholder={emptyValue}
                            className="mt-2 min-h-[104px] w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-900 placeholder-gray-400 outline-none"
                        />
                        <p className="mt-1 text-xs text-gray-400">Add one regex per line.</p>
                    </div>

                    <div className="mt-4">
                        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-700">
                            <Ban size={14} className="text-[#475569]" />
                            Harmful keywords
                        </label>
                        {harmfulKeywords.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {harmfulKeywords.map((keyword) => (
                                    <span
                                        key={keyword}
                                        className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-semibold text-gray-700"
                                    >
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-gray-400">{emptyValue}</p>
                        )}
                        <div className="mt-2 flex gap-2">
                            <input
                                readOnly
                                value=""
                                placeholder="Enter harmful word and press Enter"
                                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none"
                            />
                            <button
                                type="button"
                                disabled
                                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 opacity-60"
                            >
                                + Add Keyword
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function ReadOnlyKnowledgeFilesSection({
    files,
    isLoading,
    onDownload,
}: {
    files: KnowledgeFileRecord[];
    isLoading: boolean;
    onDownload: (file: KnowledgeFileRecord) => void;
}) {
    return (
        <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                <FileText className="h-4 w-4 text-[#475569]" />
                Knowledge Files
            </label>
            <p className="mt-1 text-xs leading-snug text-gray-400">
                Files attached as knowledge sources for this agent.
            </p>
            <div className="mt-3 rounded-2xl border border-dashed border-indigo-200 bg-white p-4">
                {isLoading ? (
                    <p className="text-sm text-gray-400">Loading knowledge files...</p>
                ) : files.length ? (
                    <div className="space-y-2">
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-50"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-gray-800">
                                            {file.filename}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {file.content_type || "File"} | {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onDownload(file)}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
                                    aria-label={`Download ${file.filename}`}
                                >
                                    <Download size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400">No knowledge files attached.</p>
                )}
            </div>
        </div>
    );
}

function ReadOnlyModelField({
    label,
    useGlobal,
    modelId,
    modelOptions,
}: {
    label: string;
    useGlobal?: boolean | null;
    modelId?: string | null;
    modelOptions: LlmLookupOption[];
}) {
    const selectedOption = modelOptions.find((option) => option.value === modelId);
    const selectedValue = selectedOption?.label || asText(modelId);
    const inferredProvider = typeof modelId === "string" ? inferProviderFromModelId(modelId) : "";
    const iconSrc =
        selectedOption?.iconSrc || (inferredProvider ? getProviderIconSrc(inferredProvider) : null);
    const helperText = useGlobal
        ? `Uses the global ${label.toLowerCase()} from LLM management`
        : `Uses a specific ${label.toLowerCase()} for this agent`;
    const footerText = useGlobal
        ? modelId
            ? `Global default: ${modelId}`
            : "Global default is configured in LLM management."
        : modelId
            ? "Custom LLM selected for this agent."
            : "No custom LLM configured for this slot.";

    return (
        <div>
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-1 text-sm font-medium text-gray-700">
                        <Workflow className="h-4 w-4" />
                        {label}
                    </p>
                    <p className="text-xs leading-snug text-gray-400">{helperText}</p>
                </div>
            </div>

            <div className="mt-3 h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
                <div className="flex h-full items-center gap-2">
                    {iconSrc ? (
                        <Image
                            src={iconSrc}
                            alt=""
                            width={20}
                            height={20}
                            className="h-5 w-5 shrink-0 object-contain"
                        />
                    ) : null}
                    <span className="truncate">{selectedValue}</span>
                </div>
            </div>

            <div className="mt-2 flex items-start justify-between gap-3">
                <p className="text-xs text-gray-400">{footerText}</p>
                {iconSrc ? (
                    <Image
                        src={iconSrc}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 shrink-0 object-contain"
                    />
                ) : null}
            </div>
        </div>
    );
}

export default function InspectAgent({ agent, isOpen, onClose }: InspectAgentProps) {
    const { llmManagerApiBaseUrl } = useRuntimeConfig();
    const base = trimTrailingSlash(llmManagerApiBaseUrl);
    const [activeTab, setActiveTab] = useState(0);
    const [connectorConfigNameById, setConnectorConfigNameById] = useState<
        Record<string, string>
    >({});
    const [skillOptions, setSkillOptions] = useState<LookupOption[]>([]);
    const [mcpOptions, setMcpOptions] = useState<McpLookupOption[]>([]);
    const [agentOptions, setAgentOptions] = useState<AgentLookupOption[]>([]);
    const [isAgentOptionsLoading, setIsAgentOptionsLoading] = useState(false);
    const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFileRecord[]>([]);
    const [isKnowledgeFilesLoading, setIsKnowledgeFilesLoading] = useState(false);
    const [modelOptions, setModelOptions] = useState<LlmLookupOption[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();

        const loadLookupOptions = async () => {
            try {
                setIsAgentOptionsLoading(true);
                const [connectorsResponse, skillsResponse, mcpResponse, agentsResponse, llmsResponse] =
                    await Promise.all([
                        fetch(`${base}/connectors/`, {
                            headers: { accept: "application/json" },
                            signal: controller.signal,
                        }),
                        fetch(`${base}/skill/`, {
                            headers: { accept: "application/json" },
                            signal: controller.signal,
                        }),
                        fetch(`${base}/mcp/`, {
                            headers: { accept: "application/json" },
                            signal: controller.signal,
                        }),
                        fetch(`${base}/agent/`, {
                            headers: { accept: "application/json" },
                            signal: controller.signal,
                        }),
                        fetch(`${base}/llms/`, {
                            headers: { accept: "application/json" },
                            signal: controller.signal,
                        }),
                    ]);

                const [connectorsData, skillsData, mcpData, agentsData, llmsData] = await Promise.all([
                    connectorsResponse.json().catch(() => null),
                    skillsResponse.json().catch(() => null),
                    mcpResponse.json().catch(() => null),
                    agentsResponse.json().catch(() => null),
                    llmsResponse.json().catch(() => null),
                ]);

                const nextConnectorOptions = connectorsResponse.ok
                    ? normalizeConnectorOptions(connectorsData)
                    : [];

                const connectorConfigEntries = await Promise.all(
                    nextConnectorOptions.map(async (connector) => {
                        const response = await fetch(
                            `${base}/connectors/${connector.value}/config`,
                            {
                                headers: { accept: "application/json" },
                                signal: controller.signal,
                            }
                        );
                        const data = await response.json().catch(() => null);
                        return response.ok
                            ? normalizeConnectorConfigRecords(data)
                            : [];
                    })
                );
                const nextConnectorConfigNameById: Record<string, string> = {};
                connectorConfigEntries.flat().forEach((record) => {
                    const configId = record.connector_config_id?.trim();
                    if (!configId) return;
                    nextConnectorConfigNameById[configId] = record.name?.trim() || configId;
                });
                setConnectorConfigNameById(nextConnectorConfigNameById);
                setSkillOptions(
                    skillsResponse.ok ? normalizeSkillOptions(skillsData) : []
                );
                setMcpOptions(mcpResponse.ok ? normalizeMcpOptions(mcpData) : []);
                setAgentOptions(
                    agentsResponse.ok ? normalizeAgentOptions(agentsData) : []
                );
                setModelOptions(llmsResponse.ok ? normalizeLlmOptions(llmsData) : []);
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setConnectorConfigNameById({});
                    setSkillOptions([]);
                    setMcpOptions([]);
                    setAgentOptions([]);
                    setModelOptions([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsAgentOptionsLoading(false);
                }
            }
        };

        void loadLookupOptions();

        return () => controller.abort();
    }, [base, isOpen]);

    useEffect(() => {
        if (!isOpen || !agent.agent_id) return;
        const controller = new AbortController();

        const loadKnowledgeFiles = async () => {
            setIsKnowledgeFilesLoading(true);
            try {
                const agentId = encodeURIComponent(agent.agent_id ?? "");
                const response = await fetch(`${base}/agent/${agentId}/files`, {
                    headers: { accept: "application/json" },
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null);

                setKnowledgeFiles(
                    response.ok && Array.isArray(data)
                        ? (data
                            .map(normalizeKnowledgeFile)
                            .filter(Boolean) as KnowledgeFileRecord[])
                        : []
                );
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setKnowledgeFiles([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsKnowledgeFilesLoading(false);
                }
            }
        };

        void loadKnowledgeFiles();

        return () => controller.abort();
    }, [agent.agent_id, base, isOpen]);

    const skillNameById = useMemo(
        () => new Map(skillOptions.map((option) => [option.value, option.label])),
        [skillOptions]
    );
    const mcpNameById = useMemo(
        () =>
            new Map(
                mcpOptions.map((option) => [
                    option.id,
                    option.name || option.serverUrl || option.id,
                ])
            ),
        [mcpOptions]
    );

    if (!isOpen) {
        return null;
    }

    const guardrailsConfig = agent.guardrails_config;
    const memoryEnabled = Boolean(agent.memory_enabled);
    const mcpDisplayNames = [
        ...(agent.mcp_server_ids ?? []).map((id) => mcpNameById.get(id) ?? id),
        ...(agent.mcp_servers ?? []),
    ];
    const connectorDisplayNames = (agent.connector_config_ids ?? []).map(
        (id) => connectorConfigNameById[id] ?? id
    );
    const skillDisplayNames = (agent.skill_ids ?? []).map(
        (id) => skillNameById.get(id) ?? id
    );
    const handleDownloadKnowledgeFile = async (file: KnowledgeFileRecord) => {
        const response = await fetch(`${base}/agent/files/${encodeURIComponent(file.id)}`);
        if (!response.ok) {
            return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    };

    return (
        <ModalCard onBackdropClick={onClose}>
            <ModalCardPanel maxWidthClassName="max-w-6xl">
                <ModalCardHeader
                    title={agent.name || "Inspect Agent"}
                    subtitle="Inspect agent configuration and settings"
                    icon={<Bot className="h-4 w-4" />}
                    onClose={onClose}
                />

                <ModalCardBody className="max-h-[70vh] overflow-y-auto bg-white">
                    <AgentFormPages
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        identity={(
                            <div className="space-y-5">
                                <ReadOnlyField label="Agent Name" value={agent.name} />
                                <ReadOnlyField
                                    label="Description"
                                    value={agent.description}
                                    multiline
                                />
                            </div>
                        )}
                        promptInstructions={(
                            <ReadOnlyPromptInstructions agent={agent} />
                        )}
                        models={(
                            <div className="grid gap-5">
                                <ReadOnlyModelField
                                    label="Primary LLM"
                                    useGlobal={agent.primary_use_global}
                                    modelId={agent.primary_model_id}
                                    modelOptions={modelOptions}
                                />
                                <ReadOnlyModelField
                                    label="Secondary LLM"
                                    useGlobal={agent.secondary_use_global}
                                    modelId={agent.secondary_model_id}
                                    modelOptions={modelOptions}
                                />
                                <ReadOnlyModelField
                                    label="Tertiary LLM"
                                    useGlobal={agent.tertiary_use_global}
                                    modelId={agent.tertiary_model_id}
                                    modelOptions={modelOptions}
                                />
                            </div>
                        )}
                        deployment={(
                            <div className="grid gap-5 md:grid-cols-2">
                                <ReadOnlyField
                                    label="Deployment Target"
                                    value={optionLabel(
                                        DEPLOYMENT_TARGET_OPTIONS,
                                        agent.deployment_target
                                    )}
                                />
                                <ReadOnlyField
                                    label="Type"
                                    value={optionLabel(AGENT_TYPE_OPTIONS, agent.type)}
                                />
                                <ReadOnlyField
                                    label="Memory Bank"
                                    value={optionLabel(MEMORY_BANK_OPTIONS, memoryEnabled)}
                                />
                                <ReadOnlyField
                                    label="Memory Retrieval"
                                    value={agent.memory_tool_type}
                                />
                                <ReadOnlyField
                                    label="AWS Credential"
                                    value={agent.aws_credential_id}
                                />
                                <ReadOnlyField
                                    label="Vertex Resource"
                                    value={agent.vertex_resource_name}
                                />
                            </div>
                        )}
                        capabilities={(
                            <div className="space-y-4">
                                <ReadOnlyIntegrationSection
                                    label="MCP Servers"
                                    hint="Type a custom URL or choose from registered MCP servers"
                                    imageSrc="/img/mcp.png"
                                    values={mcpDisplayNames}
                                />
                                <ReadOnlyIntegrationSection
                                    label="Connector Config"
                                    hint="Choose from pre-configured connectors"
                                    icon={<Link2 className="h-4 w-4 text-[#475569]" />}
                                    values={connectorDisplayNames}
                                />
                                <ReadOnlyIntegrationSection
                                    label="Skill"
                                    hint="Choose from registered skills"
                                    icon={<Sparkles className="h-4 w-4 text-[#475569]" />}
                                    values={skillDisplayNames}
                                />
                            </div>
                        )}
                        subAgents={(
                            <ReadOnlySubAgentsSection
                                agentId={agent.agent_id ?? ""}
                                subAgentIds={agent.sub_agents ?? []}
                                delegationType={optionLabel(
                                    SUB_AGENT_DELEGATION_OPTIONS,
                                    agent.sub_agent_delegation_type ?? "task"
                                )}
                                agentOptions={agentOptions}
                                isLoading={isAgentOptionsLoading}
                            />
                        )}
                        guardrails={(
                            <ReadOnlyGuardrailsSection
                                enabled={Boolean(agent.guardrail_sensitive_data)}
                                piiPatterns={guardrailsConfig?.pii_patterns ?? []}
                                sensitivePatternsText={
                                    Array.isArray(guardrailsConfig?.sensitive_patterns)
                                        ? guardrailsConfig.sensitive_patterns.join("\n")
                                        : ""
                                }
                                harmfulKeywords={guardrailsConfig?.harmful_keywords ?? []}
                            />
                        )}
                        knowledgeSources={(
                            <div className="space-y-5">
                                <ReadOnlyKnowledgeFilesSection
                                    files={knowledgeFiles}
                                    isLoading={isKnowledgeFilesLoading}
                                    onDownload={handleDownloadKnowledgeFile}
                                />
                                
                            </div>
                        )}
                    />
                </ModalCardBody>

                <ModalCardFooter className="justify-end bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                        Close
                    </button>
                </ModalCardFooter>
            </ModalCardPanel>
        </ModalCard>
    );
}
