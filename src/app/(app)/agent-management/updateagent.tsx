"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X, Bot, ChevronDown, Plus, Trash2 } from "lucide-react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { getProviderIconSrc } from "../llm-management/llmHelpers";

type UpdateAgentProps = {
    agent: any;
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

const toSnakeCase = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

const normalizeString = (value: string) => value.trim();

const getErrorMessage = (payload: unknown, fallback: string) => {
    if (
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof (payload as any).message === "string"
    ) {
        return String((payload as any).message);
    }
    return fallback;
};

const inputClass =
    "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10";

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

function DynamicListField({
    label,
    hint,
    values,
    placeholder,
    onAdd,
    onRemove,
    onChange,
}: {
    label: string;
    hint?: string;
    values: string[];
    placeholder: string;
    onAdd: () => void;
    onRemove: (index: number) => void;
    onChange: (index: number, value: string) => void;
}) {
    return (
        <Field label={label} hint={hint}>
            <div className="flex flex-col gap-2">
                {values.map((value, index) => (
                    <div key={`${label}-${index}`} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(index, e.target.value)}
                            placeholder={placeholder}
                            className={inputClass}
                        />
                        <button
                            type="button"
                            onClick={onAdd}
                            title="Add"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
                        >
                            <Plus size={14} />
                        </button>
                        {values.length > 1 && (
                            <button
                                type="button"
                                onClick={() => onRemove(index)}
                                title="Remove"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </Field>
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

    const [form, setForm] = useState({
        agentName: "",
        description: "",
        instruction: "",
        modelId: "",
        tools: "",
        mcpServers: "",
        connectorConfigIds: "",
        subAgents: "",
        isEnabled: true,
    });
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
    const [mcpServers, setMcpServers] = useState<string[]>([""]);
    const [connectorConfigIds, setConnectorConfigIds] = useState<string[]>([""]);
    const [isModelsLoading, setIsModelsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const agentId = useMemo(() => toSnakeCase(form.agentName), [form.agentName]);

    const isFormValid =
        form.agentName && form.description && form.instruction && form.modelId;

    const updateField = (key: string, value: any) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const updateList = (
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        index: number,
        value: string
    ) => setter((previous) => previous.map((item, idx) => (idx === index ? value : item)));

    const addToList = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
        setter((previous) => [...previous, ""]);

    const removeFromList = (
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        index: number
    ) => setter((previous) => (previous.length <= 1 ? previous : previous.filter((_, idx) => idx !== index)));

    const normalizeList = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);

    useEffect(() => {
        if (!isOpen || !agent) return;
        setForm({
            agentName: agent.name || "",
            description: agent.description || "",
            instruction: agent.instruction || "",
            modelId: agent.model_id || "",
            tools: Array.isArray(agent.tools)
                ? agent.tools.join(", ")
                : agent.tools || "",
            subAgents: (agent.sub_agents || []).join(", "),
            isEnabled: agent.isEnabled ?? true,
        });
        setMcpServers(agent.mcp_servers?.length ? agent.mcp_servers : [""]);
        setConnectorConfigIds(
            agent.connector_config_ids?.length ? agent.connector_config_ids : [""]
        );
        setError("");
        setSuccess("");
    }, [isOpen, agent]);

    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            setIsModelsLoading(true);
            try {
                const res = await fetch(`${base}/llms/`);
                const data = await res.json();
                setModelOptions(
                    data.map((item: any) => ({
                        value: item.model_id,
                        label: item.name,
                        secondary: item.provider,
                        iconSrc: getProviderIconSrc(item.provider),
                    }))
                );
            } catch {
                setModelOptions([]);
            } finally {
                setIsModelsLoading(false);
            }
        };
        load();
    }, [isOpen]);

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
                    model_id: form.modelId,
                    tools: form.tools || "",
                    mcp_servers: normalizeList(mcpServers),
                    connector_config_ids: normalizeList(connectorConfigIds),
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

                    <Field
                        label="Language Model"
                        required
                        hint="The LLM this agent will use to generate responses"
                    >
                        <ModelSelect
                            value={form.modelId}
                            options={modelOptions}
                            placeholder="Select a model"
                            loading={isModelsLoading}
                            disabled={isModelsLoading || modelOptions.length === 0}
                            onChange={(value) => updateField("modelId", value)}
                        />
                    </Field>

                    <SectionLabel>Capabilities</SectionLabel>

                    <div className="grid grid-cols-2 items-start gap-4">
                        <DynamicListField
                            label="MCP Servers"
                            hint="URLs of MCP servers this agent can connect to"
                            values={mcpServers}
                            placeholder="https://mcp.example.com/sse"
                            onAdd={() => addToList(setMcpServers)}
                            onRemove={(index) => removeFromList(setMcpServers, index)}
                            onChange={(index, value) => updateList(setMcpServers, index, value)}
                        />
                        <DynamicListField
                            label="Connector Config IDs"
                            hint="Identifiers for pre-configured connectors"
                            values={connectorConfigIds}
                            placeholder="conn_abc123"
                            onAdd={() => addToList(setConnectorConfigIds)}
                            onRemove={(index) => removeFromList(setConnectorConfigIds, index)}
                            onChange={(index, value) =>
                                updateList(setConnectorConfigIds, index, value)
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
