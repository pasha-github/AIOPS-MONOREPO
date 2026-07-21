"use client";

import DualListPicker from "@/components/DualListPicker";
import {
    ModalCard,
    ModalCardBody,
    ModalCardFooter,
    ModalCardHeader,
    ModalCardPanel,
    ModalCardRequiredNote,
} from "@/components/modalcards";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Bot, ChevronDown, Link2, LucideIcon, Plus, Sparkles, Trash2, Workflow } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getProviderIconSrc } from "../llm-management/llmHelpers";
import AddKnowledge from "./agentform/addknowledge";
import {
    uploadKnowledgeFile,
    type KnowledgeFileRecord,
} from "./agentform/addknowledge/file-upload";
import GuardrailInput, {
    DEFAULT_GUARDRAIL_PII_PATTERNS,
    type GuardrailPiiPattern,
} from "./agentform/guardrail-input";
import AwsCredentialDropdown from "./AwsCredentialDropdown";
import { fetchAwsCredentialOptions, type AwsCredentialOption } from "./awsCredentials";
import {
    DynamicDropdownField,
    inputClass,
    SimpleDropdownField,
    ThemedSingleDropdown,
} from "./DynamicConnector";
import {
    AGENT_TYPE_OPTIONS,
    DEPLOYMENT_TARGET_OPTIONS,
    MEMORY_BANK_OPTIONS,
    MEMORY_RETRIEVAL_OPTIONS,
    PROMPT_FIELD_DEFINITIONS,
    type AgentLookupOption,
    type AgentRecord,
    type PromptFieldKey,
} from "./types";

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
    deploymentTarget: string;
    agentType: string;
    memoryEnabled: string;
    memoryToolType: string;
    prompt_role: string;
    prompt_objectives: string;
    prompt_behavior: string;
    prompt_output_format: string;
    prompt_constraints: string;
    prompt_safety: string;
    prompt_tools_instructions: string;
    prompt_policy: string;
    prompt_examples: string;
    prompt_additional_info: string;
    tools: string;
    mcpServers: string;
    connectorConfigIds: string;
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

const normalizeDeploymentTarget = (value: unknown) => {
    if (typeof value !== "string") {
        return DEPLOYMENT_TARGET_OPTIONS[0]?.value ?? "internal";
    }

    const trimmed = value.trim().toLowerCase();
    if (
        trimmed === "vertex" ||
        trimmed === "vertex_ai_agent_engine" ||
        trimmed === "vertex ai agent engine"
    ) {
        return "vertex";
    }
    if (
        trimmed === "bedrock_agentcore" ||
        trimmed === "aws_agentcore" ||
        trimmed === "aws agentcore"
    ) {
        return "bedrock_agentcore";
    }
    if (trimmed === "internal" || trimmed === "internal_runtime" || trimmed === "internal runtime") {
        return "internal";
    }

    return trimmed || DEPLOYMENT_TARGET_OPTIONS[0]?.value || "internal";
};

const normalizeBooleanString = (value: unknown) => {
    if (typeof value === "boolean") {
        return String(value);
    }
    if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === "true") return "true";
        if (trimmed === "false") return "false";
    }
    return String(MEMORY_BANK_OPTIONS[1]?.value ?? false);
};

const normalizePiiPatterns = (
    value: unknown,
    fallback: GuardrailPiiPattern[] = DEFAULT_GUARDRAIL_PII_PATTERNS
): GuardrailPiiPattern[] => {
    if (!Array.isArray(value)) {
        return fallback;
    }

    const allowed = new Set<GuardrailPiiPattern>(DEFAULT_GUARDRAIL_PII_PATTERNS);
    const patterns = value.filter(
        (item): item is GuardrailPiiPattern =>
            typeof item === "string" && allowed.has(item as GuardrailPiiPattern)
    );

    return patterns;
};

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
};

const normalizeKnowledgeFile = (value: unknown): KnowledgeFileRecord | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const record = value as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const filename =
        typeof record.filename === "string" ? record.filename.trim() : "";

    if (!id || !filename) {
        return null;
    }

    return {
        id,
        filename,
        content_type:
            typeof record.content_type === "string" ? record.content_type : "",
        size: typeof record.size === "number" ? record.size : 0,
        created_at:
            typeof record.created_at === "string" ? record.created_at : "",
    };
};

const formatSensitivePatternsText = (value: unknown) =>
    normalizeStringArray(value)
        .map((pattern) => `"${pattern}"`)
        .join("\n");

const normalizeSensitivePatterns = (value: string) =>
    value
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/,$/, "").trim())
        .map((line) =>
            line.length >= 2 && line.startsWith('"') && line.endsWith('"')
                ? line.slice(1, -1)
                : line
        )
        .filter(Boolean);

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

const getEndpointArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap((item) => getEndpointArray(item));
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }

    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return getEndpointArray(
            record.server_url ??
            record.serverUrl ??
            record.url ??
            record.endpoint ??
            record.mcp_server_url
        );
    }

    return [];
};

const getInitialMcpSelections = (agent: AgentRecord) => {
    const serverIds = getEndpointArray(agent.mcp_server_ids);
    const servers = getEndpointArray(agent.mcp_servers);

    return {
        customServers: servers,
        registeredServers: serverIds.length ? serverIds.map(() => "") : [""],
        registeredServerIds: serverIds.length ? serverIds : [""],
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
    label: React.ReactNode;
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
        deploymentTarget: DEPLOYMENT_TARGET_OPTIONS[0]?.value ?? "",
        agentType: AGENT_TYPE_OPTIONS[1]?.value ?? "agent",
        memoryEnabled: String(MEMORY_BANK_OPTIONS[1]?.value ?? false),
        memoryToolType: "",
        prompt_role: "",
        prompt_objectives: "",
        prompt_behavior: "",
        prompt_output_format: "",
        prompt_constraints: "",
        prompt_safety: "",
        prompt_tools_instructions: "",
        prompt_policy: "",
        prompt_examples: "",
        prompt_additional_info: "",
        tools: "",
        mcpServers: "",
        connectorConfigIds: "",
        isEnabled: true,
    });
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
    const [defaultModels, setDefaultModels] = useState<LlmDefaults | null>(null);
    const [customMcpServers, setCustomMcpServers] = useState<string[]>([]);
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
    const [subAgentIds, setSubAgentIds] = useState<string[]>([]);
    const [agentOptions, setAgentOptions] = useState<AgentLookupOption[]>([]);
    const [isAgentOptionsLoading, setIsAgentOptionsLoading] = useState(false);
    const [guardrailsEnabled, setGuardrailsEnabled] = useState(false);
    const [guardrailPiiPatterns, setGuardrailPiiPatterns] = useState<
        GuardrailPiiPattern[]
    >(DEFAULT_GUARDRAIL_PII_PATTERNS);
    const [guardrailSensitivePatternsText, setGuardrailSensitivePatternsText] =
        useState("");
    const [guardrailHarmfulKeywords, setGuardrailHarmfulKeywords] = useState<
        string[]
    >([]);
    const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([]);
    const [existingKnowledgeFiles, setExistingKnowledgeFiles] = useState<
        KnowledgeFileRecord[]
    >([]);
    const [deletedKnowledgeFileIds, setDeletedKnowledgeFileIds] = useState<string[]>([]);
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
    const [toastMessage, setToastMessage] = useState("");
    const [toastTone, setToastTone] = useState<"success" | "error">("success");
    const [isToastVisible, setIsToastVisible] = useState(false);
    const [awsCredentialId, setAwsCredentialId] = useState("");
    const [awsCredentialOptions, setAwsCredentialOptions] = useState<AwsCredentialOption[]>([]);
    const [isAwsCredentialsLoading, setIsAwsCredentialsLoading] = useState(false);
    const [awsCredentialsLoadError, setAwsCredentialsLoadError] = useState("");
    const isAwsAgentCoreSelected = form.deploymentTarget === "bedrock_agentcore";
    const isVertexAgentEngineSelected = form.deploymentTarget === "vertex";

    const showToast = useCallback(
        (message: string, tone: "success" | "error" = "success") => {
            setToastMessage(message);
            setToastTone(tone);
            setIsToastVisible(true);
        },
        []
    );

    useEffect(() => {
        if (!isToastVisible) return;
        const timer = setTimeout(() => setIsToastVisible(false), 3000);
        return () => clearTimeout(timer);
    }, [isToastVisible]);

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
        PROMPT_FIELD_DEFINITIONS.every(
            (field) =>
                !field.required || Boolean(normalizeString(form[field.key]))
        ) &&
        effectivePrimaryModelId.length > 0 &&
        (!primaryUseCustom || primaryModelId.length > 0) &&
        (!secondaryUseCustom || secondaryModelId.length > 0) &&
        (!tertiaryUseCustom || tertiaryModelId.length > 0) &&
        (!isAwsAgentCoreSelected || Boolean(awsCredentialId)) &&
        (!isVertexAgentEngineSelected ||
            form.memoryEnabled !== "true" ||
            Boolean(form.memoryToolType));

    const updateField = <K extends keyof UpdateAgentForm>(
        key: K,
        value: UpdateAgentForm[K]
    ) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const updatePromptField = useCallback(
        (key: PromptFieldKey, value: string) => {
            updateField(key, value);
        },
        []
    );

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
    const normalizeManualMcpServers = () =>
        normalizeList([
            ...customMcpServers,
            ...mcpServers.filter((_, index) => !mcpServerIds[index]?.trim()),
        ]);

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
        const initialMcpSelections = getInitialMcpSelections(agent);

        setForm({
            agentName: agent.name || "",
            description: agent.description || "",
            deploymentTarget: normalizeDeploymentTarget(agent.deployment_target),
            agentType: agent.type?.trim() || AGENT_TYPE_OPTIONS[1]?.value || "agent",
            memoryEnabled: normalizeBooleanString(agent.memory_enabled),
            memoryToolType: agent.memory_tool_type?.trim() || "",
            prompt_role: agent.prompt_role || "",
            prompt_objectives: agent.prompt_objectives || "",
            prompt_behavior: agent.prompt_behavior || "",
            prompt_output_format: agent.prompt_output_format || "",
            prompt_constraints: agent.prompt_constraints || "",
            prompt_safety: agent.prompt_safety || "",
            prompt_tools_instructions: agent.prompt_tools_instructions || "",
            prompt_policy: agent.prompt_policy || "",
            prompt_examples: agent.prompt_examples || "",
            prompt_additional_info: agent.prompt_additional_info || "",
            tools: Array.isArray(agent.tools)
                ? agent.tools.join(", ")
                : agent.tools || "",
            mcpServers: initialMcpSelections.customServers.join(", "),
            connectorConfigIds: (agent.connector_config_ids || []).join(", "),
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
        setCustomMcpServers(initialMcpSelections.customServers);
        setMcpServers(initialMcpSelections.registeredServers);
        setMcpServerIds(initialMcpSelections.registeredServerIds);
        setConnectorConfigIds(
            agent.connector_config_ids?.length
                ? agent.connector_config_ids.map((value: string) => [value])
                : [[]]
        );
        setSkillIds(agent.skill_ids?.length ? agent.skill_ids : [""]);
        setSubAgentIds(agent.sub_agents?.length ? agent.sub_agents : []);
        setGuardrailsEnabled(Boolean(agent.guardrail_sensitive_data));
        setGuardrailPiiPatterns(
            normalizePiiPatterns(agent.guardrails_config?.pii_patterns)
        );
        setGuardrailSensitivePatternsText(
            formatSensitivePatternsText(agent.guardrails_config?.sensitive_patterns)
        );
        setGuardrailHarmfulKeywords(
            normalizeStringArray(agent.guardrails_config?.harmful_keywords)
        );
        setKnowledgeFiles([]);
        setExistingKnowledgeFiles([]);
        setDeletedKnowledgeFileIds([]);
        localStorage.setItem("DeleteIDs", JSON.stringify([]));
        setConfigDataMap({});
        setDefaultModels(null);
        setDefaultsLoadError("");
        setAwsCredentialId(agent.aws_credential_id?.trim() || "");
        setAwsCredentialOptions([]);
        setAwsCredentialsLoadError("");
        setError("");
        setSuccess("");
    }, [isOpen, agent]);

    useEffect(() => {
        if (!isOpen || !isAwsAgentCoreSelected) return;
        const ctrl = new AbortController();
        (async () => {
            setIsAwsCredentialsLoading(true);
            setAwsCredentialsLoadError("");
            try {
                const options = await fetchAwsCredentialOptions(base, ctrl.signal);
                setAwsCredentialOptions(options);
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setAwsCredentialOptions([]);
                    setAwsCredentialsLoadError(
                        error instanceof Error ? error.message : "Unable to load AWS credentials."
                    );
                }
            } finally {
                setIsAwsCredentialsLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [base, isAwsAgentCoreSelected, isOpen]);

    useEffect(() => {
        if (!isOpen || !agent.agent_id) return;
        const ctrl = new AbortController();
        (async () => {
            try {
                const agentId = encodeURIComponent(agent.agent_id ?? "");
                const res = await fetch(`${base}/agent/${agentId}/files`, {
                    headers: { accept: "application/json" },
                    signal: ctrl.signal,
                });
                const data = await res.json().catch(() => null);

                if (!res.ok || !Array.isArray(data)) {
                    setExistingKnowledgeFiles([]);
                    return;
                }

                setExistingKnowledgeFiles(
                    data
                        .map(normalizeKnowledgeFile)
                        .filter(Boolean) as KnowledgeFileRecord[]
                );
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setExistingKnowledgeFiles([]);
                }
            }
        })();
        return () => ctrl.abort();
    }, [agent.agent_id, base, isOpen]);

    useEffect(() => {
        if (!isAwsAgentCoreSelected) {
            setAwsCredentialId("");
        }
    }, [isAwsAgentCoreSelected]);

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
            setIsAgentOptionsLoading(true);
            try {
                const res = await fetch(`${base}/agent/`, {
                    headers: { accept: "application/json" },
                    signal: ctrl.signal,
                });
                const data = await res.json().catch(() => null);
                if (res.ok && Array.isArray(data)) {
                    const nextAgentOptions: AgentLookupOption[] = data.flatMap(
                        (item: unknown) => {
                            const record = item as Record<string, unknown>;
                            const id =
                                typeof record.agent_id === "string" ? record.agent_id.trim() : "";
                            const name =
                                typeof record.name === "string" ? record.name.trim() : "";

                            if (!id || !name) {
                                return [];
                            }

                            return [
                                {
                                    id,
                                    name,
                                    description:
                                        typeof record.description === "string"
                                            ? record.description.trim()
                                            : "",
                                },
                            ];
                        }
                    );
                    setAgentOptions(nextAgentOptions);
                } else {
                    setAgentOptions([]);
                }
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setAgentOptions([]);
                }
            } finally {
                setIsAgentOptionsLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [base, isOpen]);

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
        Logo?: LucideIcon;
    }> = [
        {
            key: "primary",
            label: "Primary LLM",
            useCustom: primaryUseCustom,
            setUseCustom: setPrimaryUseCustom,
            setModelId: setPrimaryModelId,
            effectiveModelId: effectivePrimaryModelId,
            defaultOption: primaryDefaultOption,
            Logo: Workflow
        },
        {
            key: "secondary",
            label: "Secondary LLM",
            useCustom: secondaryUseCustom,
            setUseCustom: setSecondaryUseCustom,
            setModelId: setSecondaryModelId,
            effectiveModelId: effectiveSecondaryModelId,
            defaultOption: secondaryDefaultOption,
            Logo: Workflow
        },
        {
            key: "tertiary",
            label: "Tertiary LLM",
            useCustom: tertiaryUseCustom,
            setUseCustom: setTertiaryUseCustom,
            setModelId: setTertiaryModelId,
            effectiveModelId: effectiveTertiaryModelId,
            defaultOption: tertiaryDefaultOption,
            Logo: Workflow
        },
    ];

    const getGuardrailsConfig = () => {
        if (!guardrailsEnabled) {
            return null;
        }

        return {
            pii_patterns: guardrailPiiPatterns,
            sensitive_patterns: normalizeSensitivePatterns(
                guardrailSensitivePatternsText
            ),
            harmful_keywords: guardrailHarmfulKeywords,
        };
    };

    const uploadKnowledgeFiles = async () => {
        if (knowledgeFiles.length === 0) {
            return [];
        }

        const uploadedFiles = await Promise.all(
            knowledgeFiles.map((file) => uploadKnowledgeFile(base, file))
        );
        return uploadedFiles.map((file) => file.id);
    };

    const getRemainingKnowledgeFileIds = () =>
        existingKnowledgeFiles.map((file) => file.id).filter(Boolean);

    const handleDownloadKnowledgeFile = async (file: KnowledgeFileRecord) => {
        try {
            const res = await fetch(`${base}/agent/files/${encodeURIComponent(file.id)}`);
            if (!res.ok) {
                throw new Error(`Unable to download ${file.filename}.`);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = file.filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
            showToast(`${file.filename} downloaded successfully.`);
        } catch (error: unknown) {
            showToast(
                error instanceof Error
                    ? error.message
                    : `Unable to download ${file.filename}.`,
                "error"
            );
        }
    };

    const handleRemoveExistingKnowledgeFile = (file: KnowledgeFileRecord) => {
        setExistingKnowledgeFiles((previous) =>
            previous.filter((item) => item.id !== file.id)
        );
        setDeletedKnowledgeFileIds((previous) => {
            const next = previous.includes(file.id) ? previous : [...previous, file.id];
            localStorage.setItem("DeleteIDs", JSON.stringify(next));
            return next;
        });
    };

    const deleteQueuedKnowledgeFiles = async () => {
        const idsFromStorage = JSON.parse(
            localStorage.getItem("DeleteIDs") || "[]"
        ) as unknown;
        const ids = Array.isArray(idsFromStorage)
            ? idsFromStorage.filter((id): id is string => typeof id === "string")
            : deletedKnowledgeFileIds;

        if (ids.length === 0) return;

        await Promise.all(
            ids.map(async (id) => {
                const res = await fetch(`${base}/agent/files/${encodeURIComponent(id)}`, {
                    method: "DELETE",
                });
                if (!res.ok) {
                    throw new Error("Unable to delete one or more knowledge files.");
                }
            })
        );
        localStorage.setItem("DeleteIDs", JSON.stringify([]));
        setDeletedKnowledgeFileIds([]);
    };

    const handleUpdate = async () => {
        if (!isFormValid) return;
        setIsUpdating(true);
        setError("");
        setSuccess("");
        try {
            const uploadedKnowledgeFileIds = await uploadKnowledgeFiles();
            if (uploadedKnowledgeFileIds.length > 0) {
                showToast("Knowledge file uploaded successfully.");
            }
            await deleteQueuedKnowledgeFiles();
            const knowledgeFileIds = [
                ...getRemainingKnowledgeFileIds(),
                ...uploadedKnowledgeFileIds,
            ];
            const res = await fetch(`${base}/agent/${agent.agent_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent_id: agent.agent_id,
                    name: normalizeString(form.agentName),
                    description: normalizeString(form.description),
                    deployment_target: form.deploymentTarget || null,
                    aws_credential_id: isAwsAgentCoreSelected ? awsCredentialId || null : null,
                    prompt_role: normalizeString(form.prompt_role),
                    prompt_objectives: normalizeString(form.prompt_objectives),
                    prompt_behavior: normalizeString(form.prompt_behavior),
                    prompt_output_format: normalizeString(form.prompt_output_format),
                    prompt_constraints: normalizeString(form.prompt_constraints),
                    prompt_safety: normalizeString(form.prompt_safety),
                    prompt_tools_instructions: normalizeString(
                        form.prompt_tools_instructions
                    ),
                    prompt_policy: normalizeString(form.prompt_policy),
                    prompt_examples: normalizeString(form.prompt_examples),
                    prompt_additional_info: normalizeString(
                        form.prompt_additional_info
                    ),
                    memory_enabled: isVertexAgentEngineSelected
                        ? form.memoryEnabled === "true"
                        : false,
                    memory_tool_type:
                        isVertexAgentEngineSelected && form.memoryEnabled === "true"
                            ? form.memoryToolType || null
                            : null,
                    type: form.agentType || "agent",
                    primary_use_global: !primaryUseCustom,
                    primary_model_id: primaryUseCustom ? effectivePrimaryModelId || null : null,
                    secondary_use_global: !secondaryUseCustom,
                    secondary_model_id: secondaryUseCustom ? effectiveSecondaryModelId || null : null,
                    tertiary_use_global: !tertiaryUseCustom,
                    tertiary_model_id: tertiaryUseCustom ? effectiveTertiaryModelId || null : null,
                    tools: form.tools || "",
                    skill_ids: normalizeList(skillIds),
                    mcp_server_ids: normalizeMcpServerIds(mcpServerIds),
                    mcp_servers: normalizeManualMcpServers(),
                    connector_config_ids: normalizeNestedList(connectorConfigIds),
                    sub_agents: subAgentIds,
                    isEnabled: form.isEnabled,
                    guardrail_sensitive_data: guardrailsEnabled,
                    guardrails_config: getGuardrailsConfig(),
                    knowledge_file_ids: knowledgeFileIds,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(getErrorMessage(data, "Update failed. Please try again."));
                return;
            }
            setSuccess("Agent updated successfully!");
            showToast("Agent updated successfully.");
            setTimeout(() => {
                onClose();
                onUpdateSuccess?.();
            }, 1500);
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please check your connection and try again.";
            setError(message);
            showToast(message, "error");
        } finally {
            setIsUpdating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
        <ModalCard zIndexClassName="z-50" onBackdropClick={onClose}>
            <ModalCardPanel maxWidthClassName="max-w-2xl" className="max-h-[92vh]">
                <ModalCardHeader
                    title="Update Agent"
                    subtitle="Modify agent configuration and settings"
                    icon={<Bot className="h-4 w-4" />}
                    onClose={onClose}
                />

                <ModalCardBody className="flex flex-col gap-4 overflow-y-auto">
                    <SectionLabel>Identity</SectionLabel>

                    <Field label="Agent Name" required hint="Human-readable display name">
                        <input
                            className={inputClass}
                            value={form.agentName}
                            onChange={(e) => updateField("agentName", e.target.value)}
                            placeholder="e.g. Support Bot"
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field
                            label="Deployment Target"
                            hint="Select where this agent will run"
                        >
                            <ThemedSingleDropdown
                                value={form.deploymentTarget}
                                options={DEPLOYMENT_TARGET_OPTIONS.map((option) => ({
                                    value: option.value,
                                    label: option.key,
                                }))}
                                placeholder="Select deployment target"
                                onChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        deploymentTarget: value,
                                        memoryEnabled:
                                            value === "vertex"
                                                ? prev.memoryEnabled
                                                : String(MEMORY_BANK_OPTIONS[1]?.value ?? false),
                                        memoryToolType:
                                            value === "vertex" ? prev.memoryToolType : "",
                                    }))
                                }
                            />
                        </Field>
                        <Field
                            label="Type"
                            hint="Select the agent classification"
                        >
                            <ThemedSingleDropdown
                                value={form.agentType}
                                options={AGENT_TYPE_OPTIONS.map((option) => ({
                                    value: option.value,
                                    label: option.key,
                                }))}
                                placeholder="Select type"
                                onChange={(value) => updateField("agentType", value)}
                            />
                        </Field>
                    </div>

                      {isAwsAgentCoreSelected ? (
                          <AwsCredentialDropdown
                              value={awsCredentialId}
                              options={awsCredentialOptions}
                              loading={isAwsCredentialsLoading}
                              error={awsCredentialsLoadError}
                              onChange={setAwsCredentialId}
                          />
                      ) : null}

                      {isVertexAgentEngineSelected ? (
                          <div className="grid grid-cols-2 gap-3">
                              <Field
                                  label="Memory Bank"
                                  hint="Enable or disable memory for this Vertex agent"
                              >
                                      <ThemedSingleDropdown
                                          value={form.memoryEnabled}
                                          options={MEMORY_BANK_OPTIONS.map((option) => ({
                                              value: String(option.value),
                                              label: option.key,
                                          }))}
                                      placeholder="Select memory bank"
                                      onChange={(value) =>
                                          setForm((prev) => ({
                                              ...prev,
                                              memoryEnabled: value,
                                              memoryToolType:
                                                  value === "true" ? prev.memoryToolType : "",
                                          }))
                                      }
                                  />
                              </Field>

                              {form.memoryEnabled === "true" ? (
                                  <Field
                                      label="Memory Retrieval"
                                      hint="Choose how memory is retrieved for this Vertex agent"
                                  >
                                      <ThemedSingleDropdown
                                          value={form.memoryToolType}
                                          options={MEMORY_RETRIEVAL_OPTIONS.map((option) => ({
                                              value: option.value,
                                              label: option.key,
                                          }))}
                                          placeholder="Select memory retrieval"
                                          onChange={(value) => updateField("memoryToolType", value)}
                                      />
                                  </Field>
                              ) : (
                                  <div />
                              )}
                          </div>
                      ) : null}

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

                    <div className="grid grid-cols-2 gap-3">
                        {PROMPT_FIELD_DEFINITIONS.map((field) => (
                            <Field
                                key={field.key}
                                label={field.label}
                                required={field.required}
                                hint={`Define the ${field.label.toLowerCase()} for this agent`}
                            >
                                <textarea
                                    className={`${inputClass} min-h-[108px] resize-y`}
                                    value={form[field.key]}
                                    onChange={(e) => updatePromptField(field.key, e.target.value)}
                                    placeholder={`Enter ${field.label.toLowerCase()}`}
                                />
                            </Field>
                        ))}
                    </div>

                    <div className="grid gap-3">
                        {llmFields.map((field) => {
                            const Icon = field.Logo
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
                                                {Icon ? <Icon className="h-4 w-4" /> : null}
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
                        label={
                        <span className="flex items-center gap-2">
                        <span className="relative h-4 w-4 shrink-0">
                        <Image
                            src="/img/mcp.png"
                            alt="MCP"
                            fill
                            className="object-contain"
                            />
                        </span>
                        <span>MCP Servers</span>
                        </span>
                        }
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
                                {customMcpServers.map((val, index) => (
                                    <div key={`custom-${index}`} className="flex items-center gap-2">
                                        <input
                                            className={inputClass}
                                            value={val}
                                            placeholder="https://mcp.example.com/sse"
                                            onChange={(e) =>
                                                updateList(setCustomMcpServers, index, e.target.value)
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() => addToList(setCustomMcpServers)}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setCustomMcpServers((previous) =>
                                                    previous.filter((_, idx) => idx !== index)
                                                )
                                            }
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </Field>
                        <DynamicDropdownField
                            Logo={Link2}
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
                            Logo={Sparkles}
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
                        <div className="col-span-2">
                            
                             <Field
                                label={
                                <span className="flex items-center gap-2">
                                <Bot size={18} />
                                <span>Sub-Agents</span>
                                </span>
                                }
                                hint="Choose child agents to include with this agent"
                                >
                                
                                <DualListPicker
                                    availableTitle="Available Agents"
                                    selectedTitle="Selected Sub-Agents"
                                    items={agentOptions
                                        .filter((option) => option.id !== agent.agent_id)
                                        .map((option) => ({
                                            id: option.id,
                                            name: option.name,
                                            secondary: option.id,
                                        }))}
                                    selectedIds={subAgentIds}
                                    disabled={isAgentOptionsLoading}
                                    emptyAvailableMessage={
                                        isAgentOptionsLoading
                                            ? "Loading agents..."
                                            : "No agents available"
                                    }
                                    emptySelectedMessage="No sub-agents selected"
                                    onChange={setSubAgentIds}
                                />
                            </Field>
                        </div>
                        <GuardrailInput
                            enabled={guardrailsEnabled}
                            piiPatterns={guardrailPiiPatterns}
                            sensitivePatternsText={guardrailSensitivePatternsText}
                            harmfulKeywords={guardrailHarmfulKeywords}
                            onEnabledChange={setGuardrailsEnabled}
                            onPiiPatternsChange={setGuardrailPiiPatterns}
                            onSensitivePatternsTextChange={setGuardrailSensitivePatternsText}
                            onHarmfulKeywordsChange={setGuardrailHarmfulKeywords}
                        />
                        <AddKnowledge
                            files={knowledgeFiles}
                            onFilesChange={setKnowledgeFiles}
                            existingFiles={existingKnowledgeFiles}
                            onDownloadExistingFile={handleDownloadKnowledgeFile}
                            onRemoveExistingFile={handleRemoveExistingKnowledgeFile}
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
                </ModalCardBody>

                <ModalCardFooter className="shrink-0 justify-between">
                    <ModalCardRequiredNote visible={!success} />

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
                            <Bot size={18}/>
                        </button>
                    </div>
                </ModalCardFooter>
            </ModalCardPanel>
        </ModalCard>
        {isToastVisible ? (
            <div className="fixed bottom-6 right-6 z-[80]">
                <div
                    className={`toast-fade relative rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(79,73,226,0.8)] ${
                        toastTone === "success" ? "bg-green-600" : "bg-red-500"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="toast-dot-fill absolute inset-0 rounded-full bg-white" />
                        </span>
                        <span>{toastMessage}</span>
                    </div>
                    <span className="toast-progress-bar mt-2 block h-0.5 w-full bg-white/70" />
                </div>
            </div>
        ) : null}
        </>
    );
}
