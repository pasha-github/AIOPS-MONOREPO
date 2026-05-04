"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Bot, ChevronDown, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getProviderIconSrc } from "../llm-management/llmHelpers";
import { DynamicDropdownField, inputClass, SimpleDropdownField } from "./DynamicConnector";
import type { AgentRecord } from "./types";

type UpdateAgentProps = {
    agent: AgentRecord;
    isOpen: boolean;
    onClose: () => void;
    onUpdateSuccess?: () => void;
};

type ModelOption = {
    value: string;
    label: string;
    secondary: string;
    iconSrc: string | null;
};

type LlmDefaults = {
    primary_model_id: string | null;
    secondary_model_id: string | null;
    tertiary_model_id: string | null;
};

type LlmSlotKey = "primary" | "secondary" | "tertiary";

type UpdateAgentForm = {
    agentName: string;
    description: string;
    instruction: string;
    tools: string;
    mcpServers: string;
    connectorConfigIds: string;
    subAgents: string;
    isEnabled: boolean;
};

const normalizeString = (value: string) => value.trim();

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

const normalizeModelId = (value: unknown) => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const normalizeLlmDefaults = (value: unknown): LlmDefaults | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const payload = value as Record<string, unknown>;
    return {
        primary_model_id: normalizeModelId(payload.primary_model_id),
        secondary_model_id: normalizeModelId(payload.secondary_model_id),
        tertiary_model_id: normalizeModelId(payload.tertiary_model_id),
    };
};

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {children}
        </p>
    );
}

function Field({
    label,
    hint,
    required,
    children,
}: {
    label: string;
    hint?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-500">*</span>}
            </label>
            {hint && (
                <p className="text-xs leading-snug text-gray-400">{hint}</p>
            )}
            {children}
        </div>
    );
}

function ModelSelect({
    value,
    options,
    placeholder,
    disabled,
    loading,
    onChange,
}: {
    value: string;
    options: ModelOption[];
    placeholder: string;
    disabled?: boolean;
    loading?: boolean;
    onChange: (value: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    const selected = options.find((option) => option.value === value) ?? null;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => {
                    if (!disabled && !loading) {
                        setIsOpen((previous) => !previous);
                    }
                }}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${disabled || loading
                    ? "cursor-not-allowed border-dashed border-gray-200 bg-gray-100 text-gray-400"
                    : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                    }`}
            >
                <span className="flex min-w-0 items-center gap-2">
                    {selected?.iconSrc ? (
                        <Image
                            src={selected.iconSrc}
                            alt=""
                            width={18}
                            height={18}
                            className="shrink-0 rounded-sm object-contain"
                        />
                    ) : null}
                    {loading ? (
                        <span className="text-gray-400">Loading models...</span>
                    ) : selected ? (
                        <span className="min-w-0">
                            <span className="block truncate">{selected.label}</span>
                            <span className="block truncate text-xs text-gray-400">
                                {selected.secondary}
                            </span>
                        </span>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </span>
                <ChevronDown
                    size={15}
                    className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && !disabled && !loading ? (
                <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    <button
                        type="button"
                        onClick={() => {
                            onChange("");
                            setIsOpen(false);
                        }}
                        className="w-full px-3 py-2.5 text-left text-sm text-gray-400 hover:bg-gray-50"
                    >
                        {placeholder}
                    </button>
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition ${option.value === value
                                ? "bg-indigo-50 font-medium text-indigo-700"
                                : "text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            {option.iconSrc ? (
                                <Image
                                    src={option.iconSrc}
                                    alt=""
                                    width={18}
                                    height={18}
                                    className="shrink-0 rounded-sm object-contain"
                                />
                            ) : null}
                            <span className="min-w-0">
                                <span className="block truncate">{option.label}</span>
                                <span className="block truncate text-xs text-gray-400">
                                    {option.secondary}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default function UpdateAgent({
    agent,
    isOpen,
    onClose,
    onUpdateSuccess,
}: UpdateAgentProps) {
    const { llmManagerApiBaseUrl } = useRuntimeConfig();
    const base = trimTrailingSlash(llmManagerApiBaseUrl);

    const [form, setForm] = useState<UpdateAgentForm>({
        agentName: "",
        description: "",
        instruction: "",
        tools: "",
        mcpServers: "",
        connectorConfigIds: "",
        subAgents: "",
        isEnabled: true,
    });
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
    const [defaultModels, setDefaultModels] = useState<LlmDefaults | null>(null);
    const [mcpServers, setMcpServers] = useState<string[]>([""]);
    const [mcpServerIds, setMcpServerIds] = useState<string[]>([""]);
    const [mcpOptions, setMcpOptions] = useState<
        { id: string; name: string; serverUrl: string }[]
    >([]);
    const [isMcpLoading, setIsMcpLoading] = useState(false);
    const [openMcpDropdownIndex, setOpenMcpDropdownIndex] = useState<number | null>(null);
    const mcpDropdownRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [connectorConfigIds, setConnectorConfigIds] = useState<string[][]>([[]]);
    const [connectorOptions, setConnectorOptions] = useState<{ value: string; label: string }[]>([]);
    const [configDataMap, setConfigDataMap] = useState<Record<string, unknown>>({});
    const [skillIds, setSkillIds] = useState<string[]>([""]);
    const [skillOptions, setSkillOptions] = useState<{ value: string; label: string }[]>([]);
    const [isSkillsLoading, setIsSkillsLoading] = useState(false);
    const [primaryUseCustom, setPrimaryUseCustom] = useState(false);
    const [secondaryUseCustom, setSecondaryUseCustom] = useState(false);
    const [tertiaryUseCustom, setTertiaryUseCustom] = useState(false);
    const [primaryModelId, setPrimaryModelId] = useState("");
    const [secondaryModelId, setSecondaryModelId] = useState("");
    const [tertiaryModelId, setTertiaryModelId] = useState("");
    const [isModelsLoading, setIsModelsLoading] = useState(false);
    const [isDefaultsLoading, setIsDefaultsLoading] = useState(false);
    const [defaultsLoadError, setDefaultsLoadError] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const resolveModelOption = (modelId: string | null) => {
        if (!modelId) {
            return null;
        }
        return (
            modelOptions.find((option) => option.value === modelId) ?? {
                value: modelId,
                label: modelId,
                secondary: "Model unavailable in current list",
                iconSrc: null,
            }
        );
    };

    const primaryDefaultOption = resolveModelOption(defaultModels?.primary_model_id ?? null);
    const secondaryDefaultOption = resolveModelOption(
        defaultModels?.secondary_model_id ?? null
    );
    const tertiaryDefaultOption = resolveModelOption(defaultModels?.tertiary_model_id ?? null);

    const effectivePrimaryModelId = primaryUseCustom
        ? primaryModelId
        : defaultModels?.primary_model_id ?? "";
    const effectiveSecondaryModelId = secondaryUseCustom
        ? secondaryModelId
        : defaultModels?.secondary_model_id ?? "";
    const effectiveTertiaryModelId = tertiaryUseCustom
        ? tertiaryModelId
        : defaultModels?.tertiary_model_id ?? "";

    const isFormValid =
        Boolean(form.agentName) &&
        Boolean(form.description) &&
        Boolean(form.instruction) &&
        effectivePrimaryModelId.length > 0 &&
        (!primaryUseCustom || primaryModelId.length > 0) &&
        (!secondaryUseCustom || secondaryModelId.length > 0) &&
        (!tertiaryUseCustom || tertiaryModelId.length > 0);

    const updateField = <K extends keyof UpdateAgentForm>(
        key: K,
        value: UpdateAgentForm[K]
    ) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const updateList = (
        setter: Dispatch<SetStateAction<string[]>>,
        index: number,
        value: string
    ) => setter((previous) => previous.map((item, idx) => (idx === index ? value : item)));

    const addToList = (setter: Dispatch<SetStateAction<string[]>>) =>
        setter((previous) => [...previous, ""]);

    const removeFromList = (
        setter: Dispatch<SetStateAction<string[]>>,
        index: number
    ) => setter((previous) => (previous.length <= 1 ? previous : previous.filter((_, idx) => idx !== index)));

    const normalizeList = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);
    const normalizeNestedList = (values: string[][]) =>
        values.flat().map((value) => value.trim()).filter(Boolean);
    const normalizeMcpServerIds = (values: string[]) =>
        values.map((value) => value.trim()).filter(Boolean);
    const normalizeManualMcpServers = (urls: string[], ids: string[]) =>
        urls
            .map((url, index) => {
                const trimmedUrl = url.trim();
                const id = ids[index]?.trim() ?? "";
                return id ? "" : trimmedUrl;
            })
            .filter(Boolean);

    const updateConnectorList = (index: number, value: string[]) => {
        setConnectorConfigIds((previous) =>
            previous.map((item, idx) => (idx === index ? value : item))
        );
    };

    const addConnector = () => {
        setConnectorConfigIds((previous) => [...previous, []]);
    };

    const removeConnector = (index: number) => {
        setConnectorConfigIds((previous) =>
            previous.length <= 1 ? previous : previous.filter((_, idx) => idx !== index)
        );
    };

    const fetchConnectorConfig = useCallback(async (value: string) => {
        if (!value || configDataMap[value] !== undefined) return;
        setConfigDataMap((previous) => ({ ...previous, [value]: null }));
        try {
            const res = await fetch(`${base}/connectors/${value}/config`, {
                headers: { accept: "application/json" },
            });
            const data = await res.json();
            if (res.ok) {
                setConfigDataMap((previous) => ({ ...previous, [value]: data }));
            } else {
                setConfigDataMap((previous) => {
                    const next = { ...previous };
                    delete next[value];
                    return next;
                });
            }
        } catch {
            setConfigDataMap((previous) => {
                const next = { ...previous };
                delete next[value];
                return next;
            });
        }
    }, [base, configDataMap]);

    useEffect(() => {
        if (!isOpen || !agent) return;
        const initialMcpServers = agent.mcp_servers?.length ? agent.mcp_servers : [""];
        const initialMcpServerIds = agent.mcp_server_ids?.length
            ? agent.mcp_server_ids
            : (agent.mcp_servers?.length ? agent.mcp_servers.map(() => "") : [""]);

        setForm({
            agentName: agent.name || "",
            description: agent.description || "",
            instruction: agent.instruction || "",
            tools: Array.isArray(agent.tools)
                ? agent.tools.join(", ")
                : agent.tools || "",
            mcpServers: (initialMcpServers || []).join(", "),
            connectorConfigIds: (agent.connector_config_ids || []).join(", "),
            subAgents: (agent.sub_agents || []).join(", "),
            isEnabled: agent.isEnabled ?? true,
        });
        const initialPrimaryModelId =
            normalizeModelId(agent.primary_model_id) ??
            normalizeModelId(agent.model_id) ??
            "";
        setPrimaryUseCustom(!(agent.primary_use_global ?? false) && initialPrimaryModelId.length > 0);
        setSecondaryUseCustom(!(agent.secondary_use_global ?? true) && Boolean(normalizeModelId(agent.secondary_model_id)));
        setTertiaryUseCustom(!(agent.tertiary_use_global ?? true) && Boolean(normalizeModelId(agent.tertiary_model_id)));
        setPrimaryModelId(initialPrimaryModelId);
        setSecondaryModelId(normalizeModelId(agent.secondary_model_id) ?? "");
        setTertiaryModelId(normalizeModelId(agent.tertiary_model_id) ?? "");
        setMcpServers(initialMcpServers);
        setMcpServerIds(initialMcpServerIds);
        setConnectorConfigIds(
            agent.connector_config_ids?.length
                ? agent.connector_config_ids.map((value: string) => [value])
                : [[]]
        );
        setSkillIds(agent.skill_ids?.length ? agent.skill_ids : [""]);
        setConfigDataMap({});
        setDefaultModels(null);
        setDefaultsLoadError("");
        setError("");
        setSuccess("");
    }, [isOpen, agent]);

    useEffect(() => {
        if (!isOpen || !mcpOptions.length) return;
        setMcpServers((previous) =>
            previous.map((url, index) => {
                if (url.trim()) return url;
                const selectedId = mcpServerIds[index]?.trim();
                if (!selectedId) return url;
                const selected = mcpOptions.find((option) => option.id === selectedId);
                return selected ? (selected.name || selected.serverUrl) : url;
            })
        );
    }, [isOpen, mcpOptions, mcpServerIds]);

    useEffect(() => {
        if (!isOpen) return;
        const ctrl = new AbortController();
        (async () => {
            setIsMcpLoading(true);
            try {
                const res = await fetch(`${base}/mcp/`, {
                    headers: { accept: "application/json" },
                    signal: ctrl.signal,
                });
                const data = await res.json().catch(() => null);
                if (res.ok && Array.isArray(data)) {
                    setMcpOptions(
                        data
                            .map((item: unknown) => {
                                const record = item as Record<string, unknown>;
                                const id = typeof record.mcp_server_id === "string" ? record.mcp_server_id.trim() : "";
                                const name = typeof record.name === "string" ? record.name.trim() : "";
                                const serverUrl = typeof record.server_url === "string" ? record.server_url.trim() : "";
                                if (!id || !serverUrl) return null;
                                return { id, name, serverUrl };
                            })
                            .filter(Boolean) as { id: string; name: string; serverUrl: string }[]
                    );
                } else {
                    setMcpOptions([]);
                }
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setMcpOptions([]);
                }
            } finally {
                setIsMcpLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [base, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const ctrl = new AbortController();
        (async () => {
            setIsSkillsLoading(true);
            try {
                const res = await fetch(`${base}/skill/`, {
                    headers: { accept: "application/json" },
                    signal: ctrl.signal,
                });
                const data = await res.json().catch(() => null);
                if (res.ok && Array.isArray(data)) {
                    setSkillOptions(
                        data
                            .map((item: unknown) => {
                                const record = item as Record<string, unknown>;
                                const value = typeof record.skill_id === "string" ? record.skill_id.trim() : "";
                                const label = typeof record.name === "string" ? record.name.trim() : "";
                                if (!value || !label) return null;
                                return { value, label };
                            })
                            .filter(Boolean) as { value: string; label: string }[]
                    );
                } else {
                    setSkillOptions([]);
                }
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setSkillOptions([]);
                }
            } finally {
                setIsSkillsLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [base, isOpen]);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (openMcpDropdownIndex === null) return;
            const container = mcpDropdownRefs.current[openMcpDropdownIndex];
            if (!container) return;
            if (!container.contains(event.target as Node)) {
                setOpenMcpDropdownIndex(null);
            }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [openMcpDropdownIndex]);

    useEffect(() => {
        if (!isOpen) return;
        const ctrl = new AbortController();
        (async () => {
            try {
                const res = await fetch(`${base}/connectors/`, {
                    headers: { accept: "application/json" },
                    signal: ctrl.signal,
                });
                const data = await res.json();
                if (res.ok && Array.isArray(data)) {
                    setConnectorOptions(
                        data.map((item: unknown) => {
                            const record = item as Record<string, unknown>;
                            return {
                                value:
                                    typeof record.connector_config_id === "string"
                                        ? record.connector_config_id
                                        : typeof record.id === "string"
                                            ? record.id
                                            : "",
                                label:
                                    typeof record.name === "string"
                                        ? record.name
                                        : typeof record.connector_config_id === "string"
                                            ? record.connector_config_id
                                            : typeof record.id === "string"
                                                ? record.id
                                                : "",
                            };
                        })
                    );
                } else {
                    setConnectorOptions([]);
                }
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setConnectorOptions([]);
                }
            }
        })();
        return () => ctrl.abort();
    }, [base, isOpen]);

    useEffect(() => {
        if (!connectorOptions.length) return;
        connectorOptions.forEach((option) => {
            void fetchConnectorConfig(option.value);
        });
    }, [connectorOptions, fetchConnectorConfig]);

    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            setIsModelsLoading(true);
            try {
                const res = await fetch(`${base}/llms/`);
                const data = await res.json();
                setModelOptions(
                    data.map((item: unknown) => {
                        const record = item as Record<string, unknown>;
                        const provider = typeof record.provider === "string" ? record.provider : "";
                        return {
                            value: typeof record.model_id === "string" ? record.model_id : "",
                            label: typeof record.name === "string" ? record.name : "",
                            secondary: provider,
                            iconSrc: provider ? getProviderIconSrc(provider) : null,
                        };
                    })
                );
            } catch {
                setModelOptions([]);
            } finally {
                setIsModelsLoading(false);
            }
        };
        load();
    }, [base, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            setIsDefaultsLoading(true);
            setDefaultsLoadError("");
            try {
                const res = await fetch(`${base}/llms/defaults`, {
                    headers: { accept: "application/json" },
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) {
                    setDefaultsLoadError(
                        getErrorMessage(data, "Unable to load default LLMs.")
                    );
                    setDefaultModels(null);
                    return;
                }

                const normalized = normalizeLlmDefaults(data);
                if (!normalized) {
                    setDefaultsLoadError("Unable to load default LLMs.");
                    setDefaultModels(null);
                    return;
                }

                setDefaultModels(normalized);
            } catch {
                setDefaultsLoadError("Unable to load default LLMs.");
                setDefaultModels(null);
            } finally {
                setIsDefaultsLoading(false);
            }
        };
        load();
    }, [base, isOpen]);

    const llmFields: Array<{
        key: LlmSlotKey;
        label: string;
        useCustom: boolean;
        setUseCustom: Dispatch<SetStateAction<boolean>>;
        setModelId: Dispatch<SetStateAction<string>>;
        effectiveModelId: string;
        defaultOption: ModelOption | null;
    }> = [
        {
            key: "primary",
            label: "Primary LLM",
            useCustom: primaryUseCustom,
            setUseCustom: setPrimaryUseCustom,
            setModelId: setPrimaryModelId,
            effectiveModelId: effectivePrimaryModelId,
            defaultOption: primaryDefaultOption,
        },
        {
            key: "secondary",
            label: "Secondary LLM",
            useCustom: secondaryUseCustom,
            setUseCustom: setSecondaryUseCustom,
            setModelId: setSecondaryModelId,
            effectiveModelId: effectiveSecondaryModelId,
            defaultOption: secondaryDefaultOption,
        },
        {
            key: "tertiary",
            label: "Tertiary LLM",
            useCustom: tertiaryUseCustom,
            setUseCustom: setTertiaryUseCustom,
            setModelId: setTertiaryModelId,
            effectiveModelId: effectiveTertiaryModelId,
            defaultOption: tertiaryDefaultOption,
        },
    ];

    const handleUpdate = async () => {
        if (!isFormValid) return;
        setIsUpdating(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`${base}/agent/${agent.agent_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent_id: agent.agent_id,
                    name: normalizeString(form.agentName),
                    description: normalizeString(form.description),
                    instruction: normalizeString(form.instruction),
                    primary_use_global: !primaryUseCustom,
                    primary_model_id: primaryUseCustom ? effectivePrimaryModelId || null : null,
                    secondary_use_global: !secondaryUseCustom,
                    secondary_model_id: secondaryUseCustom ? effectiveSecondaryModelId || null : null,
                    tertiary_use_global: !tertiaryUseCustom,
                    tertiary_model_id: tertiaryUseCustom ? effectiveTertiaryModelId || null : null,
                    tools: form.tools || "",
                    skill_ids: normalizeList(skillIds),
                    mcp_server_ids: normalizeMcpServerIds(mcpServerIds),
                    mcp_servers: normalizeManualMcpServers(mcpServers, mcpServerIds),
                    connector_config_ids: normalizeNestedList(connectorConfigIds),
                    sub_agents: form.subAgents
                        ? form.subAgents.split(",").map((s) => s.trim())
                        : [],
                    isEnabled: form.isEnabled,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(getErrorMessage(data, "Update failed. Please try again."));
                return;
            }
            setSuccess("Agent updated successfully!");
            setTimeout(() => {
                onClose();
                onUpdateSuccess?.();
            }, 1500);
        } catch {
            setError("Something went wrong. Please check your connection and try again.");
        } finally {
            setIsUpdating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Bot size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-semibold text-gray-900 leading-tight">
                            Update Agent
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-400">
                            Modify agent configuration and settings
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
                    <SectionLabel>Identity</SectionLabel>

                    <Field label="Agent Name" required hint="Human-readable display name">
                        <input
                            className={inputClass}
                            value={form.agentName}
                            onChange={(e) => updateField("agentName", e.target.value)}
                            placeholder="e.g. Support Bot"
                        />
                    </Field>

                    <Field
                        label="Description"
                        required
                        hint="Brief summary of what this agent does"
                    >
                        <textarea
                            className={`${inputClass} min-h-[76px] resize-y`}
                            value={form.description}
                            onChange={(e) => updateField("description", e.target.value)}
                            placeholder="e.g. Handles customer support queries and escalations"
                        />
                    </Field>

                    <SectionLabel>Behaviour</SectionLabel>

                    <Field
                        label="System Instruction"
                        required
                        hint="System prompt that defines this agent's personality and behaviour"
                    >
                        <textarea
                            className={`${inputClass} min-h-[108px] resize-y`}
                            value={form.instruction}
                            onChange={(e) => updateField("instruction", e.target.value)}
                            placeholder="You are a helpful assistant that..."
                        />
                    </Field>

                    <div className="grid gap-3">
                        {llmFields.map((field) => {
                            const selectedOption =
                                modelOptions.find((option) => option.value === field.effectiveModelId) ??
                                field.defaultOption;
                            const dropdownOptions =
                                !field.useCustom && field.defaultOption
                                    ? [
                                        field.defaultOption,
                                        ...modelOptions.filter(
                                            (option) => option.value !== field.defaultOption?.value
                                        ),
                                    ]
                                    : modelOptions;

                            return (
                                <div
                                    key={field.key}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                                                {field.label}
                                                {field.key === "primary" ? (
                                                    <span className="text-red-500">*</span>
                                                ) : null}
                                            </label>
                                            <p className="text-xs leading-snug text-gray-400">
                                                {field.useCustom
                                                    ? `Choose a specific ${field.label.toLowerCase()} for this agent`
                                                    : `Uses the global ${field.label.toLowerCase()} from LLM management`}
                                            </p>
                                        </div>

                                        <label className="inline-flex shrink-0 items-center gap-2 py-1.5 text-xs font-medium text-indigo-700">
                                            <input
                                                type="checkbox"
                                                checked={field.useCustom}
                                                onChange={(event) => {
                                                    field.setUseCustom(event.target.checked);
                                                    if (!event.target.checked) {
                                                        field.setModelId("");
                                                    }
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            Custom LLM
                                        </label>
                                    </div>

                                    <div className="mt-3">
                                        <ModelSelect
                                            value={field.effectiveModelId}
                                            options={dropdownOptions}
                                            placeholder={
                                                field.useCustom
                                                    ? `Choose ${field.label.toLowerCase()}`
                                                    : selectedOption
                                                        ? "Using global default"
                                                        : "No global default configured"
                                            }
                                            loading={isModelsLoading || isDefaultsLoading}
                                            disabled={
                                                !field.useCustom ||
                                                isModelsLoading ||
                                                isDefaultsLoading ||
                                                modelOptions.length === 0
                                            }
                                            onChange={field.setModelId}
                                        />
                                    </div>

                                    <div className="mt-2 flex items-start justify-between gap-3">
                                        <p className="text-xs text-gray-400">
                                            {field.useCustom
                                                ? "Checkbox enabled: this agent uses the selected LLM."
                                                : selectedOption
                                                    ? `Global default: ${selectedOption.label}`
                                                    : "Global default is not configured for this slot."}
                                        </p>
                                        {selectedOption?.iconSrc ? (
                                            <Image
                                                src={selectedOption.iconSrc}
                                                alt=""
                                                width={20}
                                                height={20}
                                                className="h-5 w-5 shrink-0 object-contain"
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}

                        {defaultsLoadError ? (
                            <p className="flex items-center gap-1.5 text-xs text-red-600">
                                <svg
                                    className="h-3.5 w-3.5 shrink-0"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                {defaultsLoadError}
                            </p>
                        ) : null}
                    </div>

                    <SectionLabel>Capabilities</SectionLabel>

                    <div className="grid grid-cols-2 items-start gap-4">
                        <Field
                            label="MCP Servers"
                            hint="Type custom URL or select from registered MCP servers"
                        >
                            <div className="flex flex-col gap-2">
                                {mcpServers.map((val, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div
                                            ref={(node) => {
                                                mcpDropdownRefs.current[index] = node;
                                            }}
                                            className="relative w-full"
                                        >
                                            <input
                                                className={`${inputClass} pr-10`}
                                                value={val}
                                                placeholder="https://mcp.example.com/sse"
                                                onChange={(e) => {
                                                    updateList(setMcpServers, index, e.target.value);
                                                    updateList(setMcpServerIds, index, "");
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setOpenMcpDropdownIndex((current) => (current === index ? null : index))
                                                }
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                                            >
                                                <ChevronDown size={16} />
                                            </button>
                                            {openMcpDropdownIndex === index ? (
                                                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-auto">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            updateList(setMcpServerIds, index, "");
                                                            updateList(setMcpServers, index, "");
                                                            setOpenMcpDropdownIndex(null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                                                    >
                                                        Select MCP
                                                    </button>
                                                    {isMcpLoading ? (
                                                        <div className="px-3 py-2 text-sm text-gray-500">Loading MCP servers...</div>
                                                    ) : mcpOptions.length === 0 ? (
                                                        <div className="px-3 py-2 text-sm text-gray-500">No MCP servers found</div>
                                                    ) : (
                                                        mcpOptions.map((option) => (
                                                            <button
                                                                key={option.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    updateList(
                                                                        setMcpServers,
                                                                        index,
                                                                        option.name || option.serverUrl
                                                                    );
                                                                    updateList(setMcpServerIds, index, option.id);
                                                                    setOpenMcpDropdownIndex(null);
                                                                }}
                                                                className="w-full border-b px-3 py-2 text-left hover:bg-gray-50"
                                                            >
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {option.name || option.serverUrl}
                                                                </div>
                                                                <div className="text-xs text-gray-500 break-all">
                                                                    {option.serverUrl}
                                                                </div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                addToList(setMcpServers);
                                                addToList(setMcpServerIds);
                                            }}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        {mcpServers.length > 1 ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    removeFromList(setMcpServers, index);
                                                    removeFromList(setMcpServerIds, index);
                                                    setOpenMcpDropdownIndex(null);
                                                }}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </Field>
                        <DynamicDropdownField
                            label="Connector Config"
                            hint="Choose from pre-configured connectors"
                            values={connectorConfigIds}
                            options={connectorOptions}
                            configDataMap={configDataMap}
                            placeholder="Select connector"
                            onAdd={addConnector}
                            onRemove={removeConnector}
                            onChange={(index: number, value: string[] | string) =>
                                updateConnectorList(index, Array.isArray(value) ? value : [value])
                            }
                        />
                        <SimpleDropdownField
                            label="Skill"
                            hint={
                                isSkillsLoading
                                    ? "Loading registered skills"
                                    : "Choose from registered skills"
                            }
                            values={skillIds}
                            options={skillOptions}
                            placeholder="Select skill"
                            onAdd={() => setSkillIds((previous) => [...previous, ""])}
                            onRemove={(index) =>
                                setSkillIds((previous) =>
                                    previous.length <= 1
                                        ? previous
                                        : previous.filter((_, idx) => idx !== index)
                                )
                            }
                            onChange={(index, value) =>
                                setSkillIds((previous) =>
                                    previous.map((item, idx) => (idx === index ? value : item))
                                )
                            }
                        />
                    </div>

                    <SectionLabel>Status</SectionLabel>

                    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Agent Enabled</p>
                            <p className="mt-0.5 text-xs text-gray-400">
                                When disabled, this agent will not accept new requests
                            </p>
                        </div>
                        <button
                            type="button"
                            title={form.isEnabled ? "Disable Agent" : "Enable Agent"}
                            role="switch"
                            aria-checked={form.isEnabled}
                            onClick={() => updateField("isEnabled", !form.isEnabled)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${form.isEnabled ? "bg-indigo-600" : "bg-gray-200"
                                }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${form.isEnabled ? "translate-x-5" : "translate-x-0"
                                    }`}
                            />
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <svg
                                className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <div>
                                <p className="font-medium">Update failed</p>
                                <p className="mt-0.5 text-red-600">{error}</p>
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                            <svg
                                className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <div>
                                <p className="font-medium">Agent updated successfully</p>
                                <p className="mt-0.5 text-green-600">
                                    Your changes have been saved. Closing in a moment...
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
                    <p className="text-xs text-gray-400">
                        {!isFormValid && !success
                            ? <>Fields marked <span className="text-red-400">*</span> are required</>
                            : null}
                    </p>

                    <div className="flex gap-2.5">
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={!isFormValid || isUpdating || !!success}
                            className={`flex min-w-[132px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${success
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-indigo-600 hover:bg-indigo-700"
                                }`}
                        >
                            {isUpdating ? (
                                <>
                                    <svg
                                        className="h-3.5 w-3.5 animate-spin"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                        />
                                    </svg>
                                    Updating...
                                </>
                            ) : success ? (
                                <>
                                    <svg
                                        className="h-3.5 w-3.5"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    Updated!
                                </>
                            ) : (
                                "Update Agent"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
