"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Eye, EyeOff, X, Cpu } from "lucide-react";
import type { ActionResult } from "./llmHelpers";
import {
    getProviderIconPath,
    LLM_PROVIDER_MODELS,
    trimTrailingSlash,
    type LlmProviderKey,
} from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";

type SelectOption = { value: string; label: string; iconSrc?: string };
type ProviderKey = LlmProviderKey;

type RoundedSelectProps = {
    value: string;
    options: SelectOption[];
    placeholder: string;
    disabled?: boolean;
    leadingIconSrc?: string;
    leadingIconAlt?: string;
    onChange: (value: string) => void;
};

export type LlmRecord = {
    model_id: string;
    provider: string;
    name: string;
    description: string;
    api_key?: string;
};

export type UpdateLlmPayload = {
    model_id: string;
    provider: string;
    name: string;
    description: string;
    api_key?: string;
};

type UpdateLlmModalProps = {
    llm: LlmRecord;
    onClose: () => void;
};

const DESCRIPTION_MIN_LENGTH = 10;

const toLabel = (value: string) =>
    value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;

const inputClass =
    "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10";

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
            {hint && <p className="text-xs leading-snug text-gray-400">{hint}</p>}
            {children}
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {children}
        </p>
    );
}

function RoundedSelect({
    value,
    options,
    placeholder,
    disabled,
    leadingIconSrc,
    leadingIconAlt,
    onChange,
}: RoundedSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
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

    const selected = options.find((o) => o.value === value);
    const displayLabel = selected?.label || placeholder;
    const iconSrc = selected?.iconSrc || leadingIconSrc;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => !disabled && setIsOpen((p) => !p)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${disabled
                    ? "cursor-not-allowed border-dashed border-gray-200 bg-gray-100 text-gray-400"
                    : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                    }`}
            >
                <span className="flex items-center gap-2">
                    {iconSrc && (
                        <Image
                            src={iconSrc}
                            alt={leadingIconAlt || "icon"}
                            width={18}
                            height={18}
                            className="shrink-0 rounded-sm"
                        />
                    )}
                    <span className={!selected ? "text-gray-400" : ""}>{displayLabel}</span>
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""
                        } ${disabled ? "text-gray-300" : "text-gray-400"}`}
                />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    {options.map((o) => (
                        <button
                            key={o.value}
                            onClick={() => {
                                onChange(o.value);
                                setIsOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-gray-50 ${o.value === value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700"
                                }`}
                        >
                            {o.iconSrc && (
                                <Image
                                    src={o.iconSrc}
                                    alt={o.label}
                                    width={18}
                                    height={18}
                                    className="shrink-0 rounded-sm"
                                />
                            )}
                            {o.label}
                            {o.value === value && (
                                <svg className="ml-auto h-3.5 w-3.5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
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

export default function UpdateLlmModal({
    llm,
    onClose,
}: UpdateLlmModalProps) {
    const [selectedProvider, setSelectedProvider] = useState<ProviderKey | "">("");
    const [selectedModelName, setSelectedModelName] = useState("");
    const [description, setDescription] = useState("");
    const [apiKey, setApiKey] = useState("");

    const [showApiKey, setShowApiKey] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const { llmManagerApiBaseUrl } = useRuntimeConfig();
    const base = trimTrailingSlash(llmManagerApiBaseUrl);

    useEffect(() => {
        if (!llm) return;
        setSelectedProvider(llm.provider as ProviderKey);
        setSelectedModelName(llm.name);
        setDescription(llm.description || "");
        setError("");
        setSuccess("");
    }, [llm]);

    const providerOptions: SelectOption[] = useMemo(
        () =>
            (Object.keys(LLM_PROVIDER_MODELS) as ProviderKey[]).map((p) => ({
                value: p,
                label: toLabel(p),
                iconSrc: getProviderIconPath(p),
            })),
        []
    );

    const modelOptions: SelectOption[] = selectedProvider
        ? LLM_PROVIDER_MODELS[selectedProvider].map((m) => ({
            value: m,
            label: m,
            iconSrc: getProviderIconPath(selectedProvider),
        }))
        : [];

    const descTooShort = description.trim().length < DESCRIPTION_MIN_LENGTH;

    const isDisabled =
        !selectedProvider || !selectedModelName || descTooShort || isUpdating;

    const handleUpdate = async () => {
        if (isDisabled) return;

        setIsUpdating(true);
        setError("");
        setSuccess("");

        const payload: UpdateLlmPayload = {
            model_id: llm.model_id,
            provider: selectedProvider,
            name: selectedModelName,
            description: description.trim(),
            api_key: apiKey.trim() || undefined,
        };

        try {
            const res = await fetch(`${base}/llms/${llm.model_id}`, {
                method: "PATCH", // or PUT
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.message || "Update failed. Please try again.");
                setIsUpdating(false);
                return;
            }

            setSuccess("LLM updated successfully!");
            setIsUpdating(false);

            setTimeout(() => {
                onClose();
                window.location.reload(); // optional
            }, 1200);

        } catch (err) {
            setError("Something went wrong");
            setIsUpdating(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

                {/* Header */}
                <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Cpu size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-semibold text-gray-900 leading-tight">
                            Update LLM
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-400">
                            Edit model configuration and credentials
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

                {/* Scrollable body */}
                <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">

                    {/* ── Model Identity ── */}
                    <SectionLabel>Model Identity</SectionLabel>

                    {/* Model ID — read-only badge */}
                    <Field
                        label="Provider"
                        hint="The AI provider for this model (locked after creation)"
                    >
                        <RoundedSelect
                            value={selectedProvider}
                            options={providerOptions}
                            placeholder="Select provider"
                            disabled
                            onChange={(v) => setSelectedProvider(v as ProviderKey)}
                        />
                    </Field>

                    <Field
                        label="Model"
                        required
                        hint="Select the specific model variant to use"
                    >
                        <RoundedSelect
                            value={selectedModelName}
                            options={modelOptions}
                            placeholder="Select a model"
                            disabled={!selectedProvider}
                            onChange={setSelectedModelName}
                        />
                    </Field>

                    {/* ── Configuration ── */}
                    <SectionLabel>Configuration</SectionLabel>

                    <Field
                        label="Description"
                        required
                        hint={`Briefly describe this model's purpose (min. ${DESCRIPTION_MIN_LENGTH} characters)`}
                    >
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Primary model for summarisation and Q&A tasks"
                            rows={3}
                            className={`${inputClass} resize-y`}
                        />
                        {description.trim().length > 0 && descTooShort && (
                            <p className="text-xs text-amber-500">
                                {DESCRIPTION_MIN_LENGTH - description.trim().length} more character{DESCRIPTION_MIN_LENGTH - description.trim().length !== 1 ? "s" : ""} needed
                            </p>
                        )}
                    </Field>

                    {/* ── Credentials ── */}
                    <SectionLabel>Credentials</SectionLabel>

                    <Field
                        label="API Key"
                        hint="Leave blank to keep the existing key. Enter a new value to rotate it."
                    >
                        <div className="relative">
                            <input
                                type={showApiKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-••••••••••••••••••••••"
                                className={`${inputClass} pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey((p) => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                                aria-label={showApiKey ? "Hide API key" : "Show API key"}
                            >
                                {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        {apiKey && (
                            <p className="flex items-center gap-1 text-xs text-amber-600">
                                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                This will replace the existing API key
                            </p>
                        )}
                    </Field>

                    {/* ── Feedback ── */}

                    {error && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="font-medium">Update failed</p>
                                <p className="mt-0.5 text-red-600">{error}</p>
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="font-medium">LLM updated successfully</p>
                                <p className="mt-0.5 text-green-600">
                                    Your changes have been saved. Closing in a moment…
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
                    <p className="text-xs text-gray-400">
                        {!selectedProvider || !selectedModelName || descTooShort
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
                            disabled={isDisabled || !!success}
                            className={`flex min-w-[120px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${success ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"
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
                                "Update LLM"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
