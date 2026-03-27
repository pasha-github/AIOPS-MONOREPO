"use client";

import { useEffect, useRef, useState } from "react";
import { X, Bot } from "lucide-react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { getProviderIconSrc } from "../llm-management/llmHelpers";
import type { AgentRecord } from "./types";
import { useEffect, useState } from "react";
import { X, Bot, Plug, ChevronDown, Plus, Trash2 } from "lucide-react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { getProviderIconSrc } from "../llm-management/llmHelpers";
import Image from "next/image";

type UpdateAgentProps = {
    agent: AgentRecord | null;
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

type UpdateAgentForm = {
    agentName: string;
    description: string;
    instruction: string;
    modelId: string;
    tools: string;
    mcpServers: string;
    connectorConfigIds: string;
    subAgents: string;
    isEnabled: boolean;
};

const normalizeString = (value: string) => value.trim();
const normalizeListInput = (value: string) =>
    value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

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

/* ── Shared classes ── */
const inputClass =
    "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10";

/* ── Field wrapper ── */
function Field({ label, hint, required, children }: {
    label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-500">*</span>}
            </label>
            {hint && <p className="text-xs leading-snug text-gray-400">{hint}</p>}
            {children}
        </div>
    );
}

/* ── Section divider ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {children}
        </p>
    );
}

/* ── Dynamic list field (MCP / Connector) ── */
function DynamicListField({ label, hint, values, placeholder, onAdd, onRemove, onChange }: {
    label: string; hint?: string; values: string[]; placeholder: string;
    onAdd: () => void; onRemove: (i: number) => void; onChange: (i: number, v: string) => void;
}) {
    return (
        <Field label={label} hint={hint}>
            <div className="flex flex-col gap-2">
                {values.map((val, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={val}
                            onChange={(e) => onChange(i, e.target.value)}
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
                                onClick={() => onRemove(i)}
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

/* ── Model select dropdown ── */
function ModelSelect({ value, options, placeholder, disabled, loading, onChange }: {
    value: string; options: ModelOption[]; placeholder: string;
    disabled?: boolean; loading?: boolean; onChange: (v: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const el = document.getElementById("update-agent-model-dropdown");
            if (el && !el.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    const selected = options.find((o) => o.value === value) ?? null;

    return (
        <div id="update-agent-model-dropdown" className="relative">
            <button
                type="button"
                onClick={() => { if (!disabled && !loading) setIsOpen((p) => !p); }}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
                    disabled || loading
                        ? "cursor-not-allowed border-dashed border-gray-200 bg-gray-100 text-gray-400"
                        : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                }`}
            >
                <span className="flex min-w-0 items-center gap-2">
                    {selected?.iconSrc && (
                        <Image src={selected.iconSrc} alt="" width={18} height={18} className="shrink-0 rounded-sm object-contain" />
                    )}
                    {loading ? (
                        <span className="text-gray-400">Loading models…</span>
                    ) : selected ? (
                        <span className="min-w-0">
                            <span className="block truncate">{selected.label}</span>
                            <span className="block truncate text-xs text-gray-400">{selected.secondary}</span>
                        </span>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </span>
                <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && !disabled && !loading && (
                <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    <button
                        type="button"
                        onClick={() => { onChange(""); setIsOpen(false); }}
                        className="w-full px-3 py-2.5 text-left text-sm text-gray-400 hover:bg-gray-50"
                    >
                        {placeholder}
                    </button>
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => { onChange(o.value); setIsOpen(false); }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition ${
                                o.value === value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                            {o.iconSrc && <Image src={o.iconSrc} alt="" width={18} height={18} className="shrink-0 rounded-sm object-contain" />}
                            <span className="min-w-0">
                                <span className="block truncate">{o.label}</span>
                                <span className="block truncate text-xs text-gray-400">{o.secondary}</span>
                            </span>
                            {o.value === value && (
                                <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════
   Main component
══════════════════════════════════════════ */
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
        modelId: "",
        isEnabled: true,
    });
    const [mcpServers, setMcpServers] = useState<string[]>([""]);
    const [connectorConfigIds, setConnectorConfigIds] = useState<string[]>([""]);
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
    const [isModelsLoading, setIsModelsLoading] = useState(false);
    const [modelsLoadError, setModelsLoadError] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [success, setSuccess] = useState("");
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const feedbackRef = useRef<HTMLDivElement | null>(null);

    // agentId is still computed and sent to the backend — just not shown in the UI
    const isFormValid =
        form.agentName && form.description && form.instruction && form.modelId;

    const updateField = <K extends keyof UpdateAgentForm>(
        key: K,
        value: UpdateAgentForm[K]
    ) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    /* List helpers */
    const updateList = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
        setter((p) => p.map((x, idx) => (idx === i ? v : x)));
    const addToList = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
        setter((p) => [...p, ""]);
    const removeFromList = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
        setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));
    const normalizeList = (vals: string[]) => vals.map((v) => v.trim()).filter(Boolean);

    /* Initialize form with agent data */
    useEffect(() => {
        if (!isOpen || !agent) return;
        setForm({
            agentName: agent.name || "",
            description: agent.description || "",
            instruction: agent.instruction || "",
            modelId: agent.model_id || "",
            isEnabled: agent.isEnabled ?? true,
        });
        setMcpServers(agent.mcp_servers?.length ? agent.mcp_servers : [""]);
        setConnectorConfigIds(agent.connector_config_ids?.length ? agent.connector_config_ids : [""]);
        setSubmitError("");
        setSuccess("");
    }, [isOpen, agent]);

    /* Load models */
    useEffect(() => {
        if (!isOpen) return;
        const ctrl = new AbortController();
        (async () => {
            setIsModelsLoading(true);
            setModelsLoadError("");
            try {
                const res = await fetch(`${base}/llms/`, { headers: { accept: "application/json" }, signal: ctrl.signal });
                const data = await res.json();
                if (!res.ok || !Array.isArray(data)) { setModelsLoadError(getErrorMessage(data, "Unable to load models.")); return; }
                setModelOptions(
                    data.flatMap((item: any) => {
                        const id = item?.model_id?.trim();
                        if (!id) return [];
                        const provider = item?.provider?.trim() || "";
                        return [{ value: id, label: item?.name?.trim() || id, secondary: provider ? `${provider} | ${id}` : id, iconSrc: provider ? getProviderIconSrc(provider) : null }];
                    }).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true }))
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
        if ((!error && !success) || !scrollContainerRef.current || !feedbackRef.current) {
            return;
        }

        const container = scrollContainerRef.current;
        const feedback = feedbackRef.current;
        const targetTop = Math.max(
            0,
            feedback.offsetTop - container.clientHeight + feedback.clientHeight + 24
        );

        container.scrollTo({
            top: targetTop,
            behavior: "smooth",
        });
    }, [error, success]);
            } catch (e: any) {
                if (e?.name !== "AbortError") setModelsLoadError("Unable to load models.");
            } finally { setIsModelsLoading(false); }
        })();
        return () => ctrl.abort();
    }, [isOpen]);

    const handleUpdate = async () => {
        if (!isFormValid) { setSubmitError("Please fill all required fields."); return; }
        setIsUpdating(true);
        setSubmitError("");
        setSuccess("");
        try {
            const res = await fetch(`${base}/agent/${agent.agent_id}`, {
                method: "PATCH",
                headers: { accept: "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent_id: agent.agent_id,
                    name: normalizeString(form.agentName),
                    description: normalizeString(form.description),
                    instruction: normalizeString(form.instruction),
                    model_id: form.modelId,
                    tools: "",
                    mcp_servers: normalizeList(mcpServers),
                    connector_config_ids: normalizeList(connectorConfigIds),
                    sub_agents: [],
                    isEnabled: form.isEnabled,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) { setSubmitError(getErrorMessage(data, "Unable to update agent.")); return; }
            setSuccess("Agent updated successfully!");
            await onUpdateSuccess?.();
            setTimeout(() => { onClose(); }, 1400);
        } catch { setSubmitError("Unable to update agent."); }
        finally { setIsUpdating(false); }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

                {/* Header */}
                <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Bot size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-semibold text-gray-900 leading-tight">Update Agent</h2>
                        <p className="mt-0.5 text-xs text-gray-400">Modify agent configuration and settings</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Scrollable body */}
                <div
                    ref={scrollContainerRef}
                    className="flex flex-col gap-4 overflow-y-auto px-6 py-5"
                >

                    {/* ── Identity ── */}
                    <SectionLabel>Identity</SectionLabel>

                    <Field label="Agent Name" required hint="Human-readable display name for this agent">
                        <input
                            type="text"
                            value={form.agentName}
                            onChange={(e) => updateField("agentName", e.target.value)}
                            placeholder="e.g. Support Bot"
                            className={inputClass}
                        />
                    </Field>

                    {/* ── Behaviour ── */}
                    <SectionLabel>Behaviour</SectionLabel>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Description" required hint="Brief summary of what this agent does">
                            <textarea
                                value={form.description}
                                onChange={(e) => updateField("description", e.target.value)}
                                placeholder="e.g. Handles customer support queries"
                                rows={3}
                                className={`${inputClass} resize-y`}
                            />
                        </Field>

                        <Field label="System Instruction" required hint="System prompt defining personality and behaviour">
                            <textarea
                                value={form.instruction}
                                onChange={(e) => updateField("instruction", e.target.value)}
                                placeholder="You are a helpful assistant that..."
                                rows={3}
                                className={`${inputClass} resize-y`}
                            />
                        </Field>
                    </div>

                    {/* ── Model ── */}
                    <SectionLabel>Model</SectionLabel>

                    <Field label="Language Model" required hint="The LLM this agent will use to generate responses">
                        <ModelSelect
                            value={form.modelId}
                            options={modelOptions}
                            placeholder="Select a model"
                            loading={isModelsLoading}
                            disabled={isModelsLoading || modelOptions.length === 0}
                            onChange={(v) => updateField("modelId", v)}
                        />
                        {modelsLoadError && (
                            <p className="flex items-center gap-1.5 text-xs text-red-600">
                                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                </svg>
                                {modelsLoadError}
                            </p>
                        )}
                    </Field>

                    {/* ── Capabilities ── */}
                    <SectionLabel>Capabilities</SectionLabel>

                    <div className="grid grid-cols-2 gap-4">
                        <DynamicListField
                            label="MCP Servers"
                            hint="URLs of MCP servers this agent can connect to"
                            values={mcpServers}
                            placeholder="https://mcp.example.com/sse"
                            onAdd={() => addToList(setMcpServers)}
                            onRemove={(i) => removeFromList(setMcpServers, i)}
                            onChange={(i, v) => updateList(setMcpServers, i, v)}
                        />
                        <DynamicListField
                            label="Connector Config IDs"
                            hint="Identifiers for pre-configured connectors"
                            values={connectorConfigIds}
                            placeholder="conn_abc123"
                            onAdd={() => addToList(setConnectorConfigIds)}
                            onRemove={(i) => removeFromList(setConnectorConfigIds, i)}
                            onChange={(i, v) => updateList(setConnectorConfigIds, i, v)}
                        />
                    </div>

                    {/* ── Status ── */}
                    <SectionLabel>Status</SectionLabel>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">Agent Enabled</p>
                            <p className="text-xs text-gray-400">When off, the agent won't accept new requests</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={form.isEnabled}
                            onClick={() => updateField("isEnabled", !form.isEnabled)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ${
                                form.isEnabled ? "bg-indigo-600" : "bg-gray-300"
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                                    form.isEnabled ? "translate-x-5" : "translate-x-0"
                                }`}
                            />
                        </button>
                    </div>

                    {/* ── Feedback messages ── */}

                    {error && (
                        <div
                            ref={feedbackRef}
                            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                        >
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
                    {/* ── Feedback ── */}
                    {submitError && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="font-medium">Update failed</p>
                                <p className="mt-0.5 text-red-600">{submitError}</p>
                            </div>
                        </div>
                    )}

                    {success && (
                        <div
                            ref={feedbackRef}
                            className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                        >
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
                        <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="font-medium">Agent updated successfully</p>
                                <p className="mt-0.5 text-green-600">Your changes have been saved. Closing in a moment…</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
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
                            className={`flex min-w-[132px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                success ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"
                            }`}
                        >
                            {isUpdating ? (
                                <>
                                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Updating…
                                </>
                            ) : success ? (
                                <>
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
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
