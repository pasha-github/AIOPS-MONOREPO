"use client";

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
import { Bot, LucideIcon, Sparkles, Workflow } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getProviderIconSrc } from "../llm-management/llmHelpers";
import AddKnowledge from "./agentform/addknowledge";
import {
    uploadKnowledgeFile,
    type KnowledgeFileRecord,
} from "./agentform/addknowledge/file-upload";
import AgentFormPages from "./agentform/AgentFormPages";
import Capabilities from "./agentform/Capabilities";
import Deployment from "./agentform/Deployment";
import {
    DEFAULT_GUARDRAIL_PII_PATTERNS,
    type GuardrailPiiPattern,
} from "./agentform/guardrail-input";
import Guardrails from "./agentform/Guardrails";
import Identity from "./agentform/Identity";
import Models from "./agentform/Models";
import PromptAgent from "./agentform/promptAgent";
import PromptInstructions from "./agentform/PromptInstructions";
import SubAgents from "./agentform/SubAgents";
import { fetchAwsCredentialOptions, type AwsCredentialOption } from "./awsCredentials";
import ExportAgent, { type ExportAgentPayload } from "./ExportAgent";
import {
    AGENT_TYPE_OPTIONS,
    DEPLOYMENT_TARGET_OPTIONS,
    MEMORY_BANK_OPTIONS,
    PROMPT_FIELD_DEFINITIONS,
    type AgentLookupOption,
    type AgentRecord,
    type PromptFieldKey,
    type SubAgentDelegationType,
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

type AgentDraftPayload = Record<string, unknown>;

const normalizeString = (value: string) => value.trim();

const parsePossibleJson = (value: unknown): unknown => {
    if (typeof value !== "string") {
        return value;
    }

    const cleaned = value
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();

    if (!cleaned) {
        return value;
    }

    try {
        return JSON.parse(cleaned);
    } catch {
        return value;
    }
};

const extractAgentDraftPayload = (value: unknown): AgentDraftPayload | null => {
    const parsed = parsePossibleJson(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
    }

    const record = parsed as AgentDraftPayload;
    const nestedKeys = ["agent", "draft", "data", "result", "response", "output"];

    for (const key of nestedKeys) {
        const nestedPayload = extractAgentDraftPayload(record[key]);
        if (nestedPayload) {
            return nestedPayload;
        }
    }

    return record;
};

const getDraftStringValue = (payload: AgentDraftPayload, key: string) => {
    if (!(key in payload) || payload[key] === null) {
        return undefined;
    }
    return typeof payload[key] === "string" ? payload[key].trim() : undefined;
};

const getDraftStringArrayValue = (payload: AgentDraftPayload, key: string) => {
    if (!(key in payload) || payload[key] === null) {
        return undefined;
    }
    if (!Array.isArray(payload[key])) {
        return undefined;
    }

    return (payload[key] as unknown[])
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
};

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

export default function UpdateAgent({
    agent,
    isOpen,
    onClose,
    onUpdateSuccess,
}: UpdateAgentProps) {
    const { llmManagerApiBaseUrl } = useRuntimeConfig();
    const base = trimTrailingSlash(llmManagerApiBaseUrl);

    const [activeAgentFormTab, setActiveAgentFormTab] = useState(0);
    const [isPromptAgentOpen, setIsPromptAgentOpen] = useState(false);
    const [highlightDraftFields, setHighlightDraftFields] = useState(false);
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
    const [subAgentDelegationType, setSubAgentDelegationType] =
        useState<SubAgentDelegationType>("task");
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

    useEffect(() => {
        if (!highlightDraftFields) return;
        const timer = setTimeout(() => setHighlightDraftFields(false), 1800);
        return () => clearTimeout(timer);
    }, [highlightDraftFields]);

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
        setIsPromptAgentOpen(false);
        setHighlightDraftFields(false);
        setActiveAgentFormTab(0);
        setSubAgentDelegationType(
            agent.sub_agent_delegation_type === "full" ? "full" : "task"
        );
        setCustomMcpServers([]);
        setMcpServers(
            [
                ...initialMcpSelections.registeredServers,
                ...initialMcpSelections.customServers,
            ].length
                ? [
                    ...initialMcpSelections.registeredServers,
                    ...initialMcpSelections.customServers,
                ]
                : [""]
        );
        setMcpServerIds(
            [
                ...initialMcpSelections.registeredServerIds,
                ...initialMcpSelections.customServers.map(() => ""),
            ].length
                ? [
                    ...initialMcpSelections.registeredServerIds,
                    ...initialMcpSelections.customServers.map(() => ""),
                ]
                : [""]
        );
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

    const getCurrentDraftConfig = () => ({
        prompt_role: normalizeString(form.prompt_role),
        prompt_objectives: normalizeString(form.prompt_objectives),
        prompt_behavior: normalizeString(form.prompt_behavior),
        prompt_output_format: normalizeString(form.prompt_output_format),
        prompt_constraints: normalizeString(form.prompt_constraints),
        prompt_safety: normalizeString(form.prompt_safety),
        prompt_tools_instructions: normalizeString(form.prompt_tools_instructions),
        prompt_policy: normalizeString(form.prompt_policy),
        prompt_examples: normalizeString(form.prompt_examples) || null,
        prompt_additional_info: normalizeString(form.prompt_additional_info) || null,
        connector_config_ids: normalizeNestedList(connectorConfigIds),
        mcp_server_ids: normalizeMcpServerIds(mcpServerIds),
    });

    const getExportAgentPayload = (): ExportAgentPayload => ({
        name: normalizeString(form.agentName),
        description: normalizeString(form.description),
        prompt_role: normalizeString(form.prompt_role),
        prompt_objectives: normalizeString(form.prompt_objectives),
        prompt_behavior: normalizeString(form.prompt_behavior),
        prompt_output_format: normalizeString(form.prompt_output_format),
        prompt_constraints: normalizeString(form.prompt_constraints),
        prompt_safety: normalizeString(form.prompt_safety),
        prompt_tools_instructions: normalizeString(form.prompt_tools_instructions),
        prompt_policy: normalizeString(form.prompt_policy),
        prompt_examples: normalizeString(form.prompt_examples),
        prompt_additional_info: normalizeString(form.prompt_additional_info),
    });

    const applyAgentDraft = (draft: AgentDraftPayload) => {
        const nextName = getDraftStringValue(draft, "name");
        const nextDescription = getDraftStringValue(draft, "description");
        const nextAgentType = getDraftStringValue(draft, "type");
        const nextPrimaryModelId = getDraftStringValue(draft, "primary_model_id");
        const nextSecondaryModelId = getDraftStringValue(draft, "secondary_model_id");
        const nextTertiaryModelId = getDraftStringValue(draft, "tertiary_model_id");
        const nextMcpServerIds = getDraftStringArrayValue(draft, "mcp_server_ids");
        const nextManualMcpServers = getDraftStringArrayValue(draft, "mcp_servers");
        const nextConnectorConfigIds = getDraftStringArrayValue(draft, "connector_config_ids");
        const nextSkillIds = getDraftStringArrayValue(draft, "skill_ids");
        const nextSubAgentIds = getDraftStringArrayValue(draft, "sub_agents");
        const nextDelegationType = getDraftStringValue(draft, "sub_agent_delegation_type");

        setForm((current) => ({
            ...current,
            agentName: nextName ?? current.agentName,
            description: nextDescription ?? current.description,
            agentType:
                nextAgentType &&
                AGENT_TYPE_OPTIONS.some((option) => option.value === nextAgentType)
                    ? nextAgentType
                    : current.agentType,
            prompt_role:
                getDraftStringValue(draft, "prompt_role") ??
                getDraftStringValue(draft, "instruction") ??
                current.prompt_role,
            prompt_objectives:
                getDraftStringValue(draft, "prompt_objectives") ?? current.prompt_objectives,
            prompt_behavior:
                getDraftStringValue(draft, "prompt_behavior") ?? current.prompt_behavior,
            prompt_output_format:
                getDraftStringValue(draft, "prompt_output_format") ??
                current.prompt_output_format,
            prompt_constraints:
                getDraftStringValue(draft, "prompt_constraints") ?? current.prompt_constraints,
            prompt_safety:
                getDraftStringValue(draft, "prompt_safety") ?? current.prompt_safety,
            prompt_tools_instructions:
                getDraftStringValue(draft, "prompt_tools_instructions") ??
                current.prompt_tools_instructions,
            prompt_policy:
                getDraftStringValue(draft, "prompt_policy") ?? current.prompt_policy,
            prompt_examples:
                getDraftStringValue(draft, "prompt_examples") ?? current.prompt_examples,
            prompt_additional_info:
                getDraftStringValue(draft, "prompt_additional_info") ??
                current.prompt_additional_info,
        }));

        if (nextPrimaryModelId !== undefined) {
            setPrimaryUseCustom(Boolean(nextPrimaryModelId));
            setPrimaryModelId(nextPrimaryModelId);
        }

        if (nextSecondaryModelId !== undefined) {
            setSecondaryUseCustom(Boolean(nextSecondaryModelId));
            setSecondaryModelId(nextSecondaryModelId);
        }

        if (nextTertiaryModelId !== undefined) {
            setTertiaryUseCustom(Boolean(nextTertiaryModelId));
            setTertiaryModelId(nextTertiaryModelId);
        }

        if (nextMcpServerIds !== undefined || nextManualMcpServers !== undefined) {
            const serverIds = nextMcpServerIds ?? normalizeMcpServerIds(mcpServerIds);
            const manualServers = nextManualMcpServers ?? normalizeManualMcpServers();
            const selectedMcpServerLabels = serverIds.map((id) => {
                const option = mcpOptions.find((item) => item.id === id);
                return option?.name || option?.serverUrl || id;
            });
            const nextServers = [...selectedMcpServerLabels, ...manualServers];
            setMcpServers(nextServers.length ? nextServers : [""]);
            setMcpServerIds([
                ...serverIds,
                ...manualServers.map(() => ""),
            ].length ? [
                ...serverIds,
                ...manualServers.map(() => ""),
            ] : [""]);
        }

        if (nextConnectorConfigIds !== undefined) {
            setConnectorConfigIds(
                nextConnectorConfigIds.length
                    ? nextConnectorConfigIds.map((id) => [id])
                    : [[]]
            );
        }

        if (nextSkillIds !== undefined) {
            setSkillIds(nextSkillIds.length ? nextSkillIds : [""]);
        }

        if (nextSubAgentIds !== undefined) {
            setSubAgentIds(nextSubAgentIds);
        }

        if (nextDelegationType === "full" || nextDelegationType === "task") {
            setSubAgentDelegationType(nextDelegationType);
        }
    };

    const handleGenerateAgentDraft = async (prompt: string) => {
        const res = await fetch(`${base}/agent/orchestrate`, {
            method: "PATCH",
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt,
                current_config: getCurrentDraftConfig(),
            }),
        });
        const rawText = await res.text();
        const parsedPayload = parsePossibleJson(rawText);

        if (!res.ok) {
            throw new Error(
                getErrorMessage(parsedPayload, "Unable to generate update draft.")
            );
        }

        const draftPayload = extractAgentDraftPayload(parsedPayload);
        if (!draftPayload) {
            throw new Error("Draft response did not include agent fields.");
        }

        applyAgentDraft(draftPayload);
        setActiveAgentFormTab(0);
        setHighlightDraftFields(true);
        setIsPromptAgentOpen(false);
    };

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
                    sub_agent_delegation_type: subAgentDelegationType,
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

    const promptFields: Record<PromptFieldKey, string> = {
        prompt_role: form.prompt_role,
        prompt_objectives: form.prompt_objectives,
        prompt_behavior: form.prompt_behavior,
        prompt_output_format: form.prompt_output_format,
        prompt_constraints: form.prompt_constraints,
        prompt_safety: form.prompt_safety,
        prompt_tools_instructions: form.prompt_tools_instructions,
        prompt_policy: form.prompt_policy,
        prompt_examples: form.prompt_examples,
        prompt_additional_info: form.prompt_additional_info,
    };

    const capabilityMcpOptions = mcpOptions.map((option) => ({
        ...option,
        label:
            option.name && option.serverUrl
                ? `${option.name} | ${option.serverUrl}`
                : option.name || option.serverUrl,
    }));

    if (!isOpen) return null;

    return (
        <>
        <ModalCard
            zIndexClassName="z-50"
            onBackdropClick={isPromptAgentOpen ? () => setIsPromptAgentOpen(false) : onClose}
        >
            <ModalCardPanel
                maxWidthClassName="max-w-5xl"
                className={isPromptAgentOpen ? "hidden" : "max-h-[92vh]"}
            >
                <ModalCardHeader
                    title={form.agentName || "Update Agent"}
                    subtitle="Modify agent configuration and settings"
                    icon={<Bot className="h-4 w-4" />}
                    actions={
                        <button
                            type="button"
                            onClick={() => setIsPromptAgentOpen(true)}
                            className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            Draft with Agent
                        </button>
                    }
                    onClose={onClose}
                />

                <ModalCardBody className="flex-1 overflow-y-auto flex flex-col gap-4">
                    <AgentFormPages
                        activeTab={activeAgentFormTab}
                        onTabChange={setActiveAgentFormTab}
                        identity={(
                            <Identity
                                agentName={form.agentName}
                                description={form.description}
                                onAgentNameChange={(value) => updateField("agentName", value)}
                                onDescriptionChange={(value) => updateField("description", value)}
                                highlight={highlightDraftFields}
                            />
                        )}
                        deployment={(
                            <Deployment
                                deploymentTarget={form.deploymentTarget}
                                agentType={form.agentType}
                                memoryEnabledValue={form.memoryEnabled}
                                memoryToolType={form.memoryToolType}
                                awsCredentialId={awsCredentialId}
                                awsCredentialOptions={awsCredentialOptions}
                                isAwsCredentialsLoading={isAwsCredentialsLoading}
                                awsCredentialsLoadError={awsCredentialsLoadError}
                                isAwsAgentCoreSelected={isAwsAgentCoreSelected}
                                isVertexAgentEngineSelected={isVertexAgentEngineSelected}
                                onDeploymentTargetChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        deploymentTarget: value,
                                        memoryEnabled:
                                            value === "vertex"
                                                ? prev.memoryEnabled
                                                : String(MEMORY_BANK_OPTIONS[1]?.value ?? false),
                                        memoryToolType: value === "vertex" ? prev.memoryToolType : "",
                                    }))
                                }
                                onAgentTypeChange={(value) => updateField("agentType", value)}
                                onMemoryEnabledValueChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        memoryEnabled: value,
                                        memoryToolType: value === "true" ? prev.memoryToolType : "",
                                    }))
                                }
                                onMemoryToolTypeChange={(value) => updateField("memoryToolType", value)}
                                onAwsCredentialIdChange={setAwsCredentialId}
                            />
                        )}
                        promptInstructions={(
                            <PromptInstructions
                                promptFields={promptFields}
                                onPromptFieldChange={updatePromptField}
                            />
                        )}
                        models={(
                            <Models
                                llmFields={llmFields}
                                modelOptions={modelOptions}
                                isModelsLoading={isModelsLoading}
                                isDefaultsLoading={isDefaultsLoading}
                                modelsLoadError=""
                                defaultsLoadError={defaultsLoadError}
                            />
                        )}
                        capabilities={(
                            <Capabilities
                                mcpServers={mcpServers}
                                mcpOptions={capabilityMcpOptions}
                                isMcpLoading={isMcpLoading}
                                openMcpDropdownIndex={openMcpDropdownIndex}
                                mcpDropdownRefs={mcpDropdownRefs}
                                connectorConfigIds={connectorConfigIds}
                                connectorOptions={connectorOptions}
                                configDataMap={configDataMap}
                                skillIds={skillIds}
                                skillOptions={skillOptions}
                                isSkillsLoading={isSkillsLoading}
                                onMcpValueChange={(index, value) => {
                                    updateList(setMcpServers, index, value);
                                    updateList(setMcpServerIds, index, "");
                                }}
                                onMcpDropdownToggle={(index) =>
                                    setOpenMcpDropdownIndex((current) => (current === index ? null : index))
                                }
                                onMcpDropdownClose={() => setOpenMcpDropdownIndex(null)}
                                onMcpClear={(index) => {
                                    updateList(setMcpServers, index, "");
                                    updateList(setMcpServerIds, index, "");
                                    setOpenMcpDropdownIndex(null);
                                }}
                                onMcpSelect={(index, option) => {
                                    updateList(setMcpServers, index, option.name || option.serverUrl);
                                    updateList(setMcpServerIds, index, option.id);
                                    setOpenMcpDropdownIndex(null);
                                }}
                                onMcpAdd={() => {
                                    addToList(setMcpServers);
                                    addToList(setMcpServerIds);
                                }}
                                onMcpRemove={(index) => {
                                    removeFromList(setMcpServers, index);
                                    removeFromList(setMcpServerIds, index);
                                    setOpenMcpDropdownIndex(null);
                                }}
                                onConnectorAdd={addConnector}
                                onConnectorRemove={removeConnector}
                                onConnectorChange={(index, value) =>
                                    updateConnectorList(index, Array.isArray(value) ? value : [value])
                                }
                                onSkillAdd={() => addToList(setSkillIds)}
                                onSkillRemove={(index) => removeFromList(setSkillIds, index)}
                                onSkillChange={(index, value) => updateList(setSkillIds, index, value)}
                            />
                        )}
                        subAgents={(
                            <SubAgents
                                agentId={agent.agent_id ?? ""}
                                subAgentIds={subAgentIds}
                                subAgentDelegationType={subAgentDelegationType}
                                agentOptions={agentOptions}
                                isAgentOptionsLoading={isAgentOptionsLoading}
                                onChange={setSubAgentIds}
                                onDelegationTypeChange={setSubAgentDelegationType}
                            />
                        )}
                        guardrails={(
                            <Guardrails
                                enabled={guardrailsEnabled}
                                piiPatterns={guardrailPiiPatterns}
                                sensitivePatternsText={guardrailSensitivePatternsText}
                                harmfulKeywords={guardrailHarmfulKeywords}
                                onEnabledChange={setGuardrailsEnabled}
                                onPiiPatternsChange={setGuardrailPiiPatterns}
                                onSensitivePatternsTextChange={setGuardrailSensitivePatternsText}
                                onHarmfulKeywordsChange={setGuardrailHarmfulKeywords}
                            />
                        )}
                        knowledgeSources={(
                            <AddKnowledge
                                files={knowledgeFiles}
                                onFilesChange={setKnowledgeFiles}
                                existingFiles={existingKnowledgeFiles}
                                onDownloadExistingFile={handleDownloadKnowledgeFile}
                                onRemoveExistingFile={handleRemoveExistingKnowledgeFile}
                            />
                        )}
                    />

                    {error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {success ? (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                            {success}
                        </div>
                    ) : null}
                </ModalCardBody>

                <ModalCardFooter className="shrink-0 justify-between">
                    <div className="flex items-center gap-3">
                        <ExportAgent
                            payload={getExportAgentPayload()}
                            fileName={form.agentName || agent.name || agent.agent_id || "agent"}
                            onExport={showToast}
                        />
                        <ModalCardRequiredNote visible={!success} />
                    </div>

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
            {isPromptAgentOpen ? (
                <PromptAgent
                    title={form.agentName || "Draft Agent Update"}
                    subtitle="Draft updates for this agent"
                    description="Describe what should change in this agent. We'll update the current configuration draft"
                    buttonLabel="Generate Update Draft"
                    loadingLabel="Updating Draft..."
                    helperText="You can review and edit all generated changes before updating the agent."
                    onClose={() => setIsPromptAgentOpen(false)}
                    onGenerate={handleGenerateAgentDraft}
                />
            ) : null}
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

