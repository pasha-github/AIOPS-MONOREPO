import {
  ModalCard,
  ModalCardBody,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardPanel,
} from "@/components/modalcards";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Bot, ChevronDown, LayoutTemplate, Plus, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getProviderIconSrc } from "../llm-management/llmHelpers";
import { uploadKnowledgeFile } from "./agentform/addknowledge/file-upload";
import AgentFormPages from "./agentform/AgentFormPages";
import Capabilities from "./agentform/Capabilities";
import Deployment from "./agentform/Deployment";
import Guardrails from "./agentform/Guardrails";
import Identity from "./agentform/Identity";
import KnowledgeSources from "./agentform/KnowledgeSources";
import Models, { type LlmFieldConfig } from "./agentform/Models";
import PromptInstructions from "./agentform/PromptInstructions";
import SubAgents from "./agentform/SubAgents";
import {
  DEFAULT_GUARDRAIL_PII_PATTERNS,
  type GuardrailPiiPattern,
} from "./agentform/guardrail-input";
import type { ModelOption } from "./ModelSelect";
import { fetchAwsCredentialOptions, type AwsCredentialOption } from "./awsCredentials";
import {
  AGENT_TYPE_OPTIONS,
  CreateNewAgentProps,
  DEPLOYMENT_TARGET_OPTIONS,
  MEMORY_BANK_OPTIONS,
  PROMPT_FIELD_DEFINITIONS,
  type AgentLookupOption,
  type ModelTemplate,
  type PromptFieldKey,
} from "./types";

type LlmDefaults = {
  primary_model_id: string | null;
  secondary_model_id: string | null;
  tertiary_model_id: string | null;
};

const toSnakeCase = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

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

export default function CreateNewAgent({ onCreateSuccess }: CreateNewAgentProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const base = trimTrailingSlash(llmManagerApiBaseUrl);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAgentFormTab, setActiveAgentFormTab] = useState(0);
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [promptFields, setPromptFields] = useState<Record<PromptFieldKey, string>>({
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
  });
  const [deploymentTarget, setDeploymentTarget] = useState(
    DEPLOYMENT_TARGET_OPTIONS[0]?.value ?? ""
  );
  const [agentType, setAgentType] = useState(AGENT_TYPE_OPTIONS[1]?.value ?? "agent");
  const [memoryEnabledValue, setMemoryEnabledValue] = useState(
    String(MEMORY_BANK_OPTIONS[1]?.value ?? false)
  );
  const [memoryToolType, setMemoryToolType] = useState("");
  const [primaryUseCustom, setPrimaryUseCustom] = useState(false);
  const [secondaryUseCustom, setSecondaryUseCustom] = useState(false);
  const [tertiaryUseCustom, setTertiaryUseCustom] = useState(false);
  const [primaryModelId, setPrimaryModelId] = useState("");
  const [secondaryModelId, setSecondaryModelId] = useState("");
  const [tertiaryModelId, setTertiaryModelId] = useState("");
  const [mcpServers, setMcpServers] = useState<string[]>([""]);
  const [mcpServerIds, setMcpServerIds] = useState<string[]>([""]);
  const [mcpOptions, setMcpOptions] = useState<
    { id: string; name: string; serverUrl: string; label: string }[]
  >([]);
  const [isMcpLoading, setIsMcpLoading] = useState(false);
  const [openMcpDropdownIndex, setOpenMcpDropdownIndex] = useState<number | null>(null);
  const mcpDropdownRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [connectorConfigIds, setConnectorConfigIds] = useState<string[][]>([[]]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [modelsLoadError, setModelsLoadError] = useState("");
  const [defaultModels, setDefaultModels] = useState<LlmDefaults | null>(null);
  const [isDefaultsLoading, setIsDefaultsLoading] = useState(false);
  const [defaultsLoadError, setDefaultsLoadError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const [modelTemplates, setModelTemplates] = useState<ModelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [templatesLoadError, setTemplatesLoadError] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
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
  const [awsCredentialId, setAwsCredentialId] = useState("");
  const [awsCredentialOptions, setAwsCredentialOptions] = useState<AwsCredentialOption[]>([]);
  const [isAwsCredentialsLoading, setIsAwsCredentialsLoading] = useState(false);
  const [awsCredentialsLoadError, setAwsCredentialsLoadError] = useState("");

  const agentId = useMemo(() => toSnakeCase(agentName), [agentName]);
  const isAwsAgentCoreSelected = deploymentTarget === "bedrock_agentcore";
  const isVertexAgentEngineSelected = deploymentTarget === "vertex";
  const updatePromptField = useCallback(
    (key: PromptFieldKey, value: string) => {
      setPromptFields((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Fetch connectors
  useEffect(() => {
    if (!isModalOpen) return;
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
        }
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setConnectorOptions([]);
        }
      }
    })();
    return () => ctrl.abort();
  }, [base, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;
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
  }, [base, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;
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
  }, [base, isModalOpen]);

  // Fetch MCP servers
  useEffect(() => {
    if (!isModalOpen) return;
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
                return {
                  id,
                  name,
                  serverUrl,
                  label: name ? `${name} | ${serverUrl}` : serverUrl,
                };
              })
              .filter(Boolean) as { id: string; name: string; serverUrl: string; label: string }[]
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
  }, [base, isModalOpen]);

  const fetchConnectorConfig = useCallback(async (value: string) => {
    if (!value || configDataMap[value] !== undefined) return;
    setConfigDataMap((prev) => ({ ...prev, [value]: null }));
    try {
      const res = await fetch(`${base}/connectors/${value}/config`, {
        headers: { accept: "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setConfigDataMap((prev) => ({ ...prev, [value]: data }));
      } else {
        setConfigDataMap((prev) => {
          const next = { ...prev };
          delete next[value];
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to fetch connector config:", err);
      setConfigDataMap((prev) => {
        const next = { ...prev };
        delete next[value];
        return next;
      });
    }
  }, [base, configDataMap]);

  useEffect(() => {
    if (!connectorOptions.length) return;
    connectorOptions.forEach((opt) => {
      fetchConnectorConfig(opt.value);
    });
  }, [connectorOptions, fetchConnectorConfig]);

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
    normalizeString(agentName).length > 0 &&
    agentId.length > 0 &&
    normalizeString(description).length > 0 &&
    PROMPT_FIELD_DEFINITIONS.every(
      (field) =>
        !field.required || normalizeString(promptFields[field.key]).length > 0
    ) &&
    effectivePrimaryModelId.length > 0 &&
    (!primaryUseCustom || primaryModelId.length > 0) &&
    (!secondaryUseCustom || secondaryModelId.length > 0) &&
    (!tertiaryUseCustom || tertiaryModelId.length > 0) &&
    (!isAwsAgentCoreSelected || Boolean(awsCredentialId)) &&
    (!isVertexAgentEngineSelected ||
      memoryEnabledValue !== "true" ||
      Boolean(memoryToolType));

  // Toast auto hide
  useEffect(() => {
    if (!isToastVisible) return;
    const t = setTimeout(() => setIsToastVisible(false), 3000);
    return () => clearTimeout(t);
  }, [isToastVisible]);

  // Fetch Models
  useEffect(() => {
    if (!isModalOpen) return;
    const ctrl = new AbortController();
    (async () => {
      setIsModelsLoading(true);
      setModelsLoadError("");
      try {
        const res = await fetch(`${base}/llms/`, {
          headers: { accept: "application/json" },
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) {
          setModelsLoadError(getErrorMessage(data, "Unable to load models."));
          return;
        }
        setModelOptions(
          data
            .flatMap((item: unknown) => {
              const record = item as Record<string, unknown>;
              const id = typeof record.model_id === "string" ? record.model_id.trim() : "";
              if (!id) return [];
              const provider = typeof record.provider === "string" ? record.provider.trim() : "";
              return [
                {
                  value: id,
                  label: typeof record.name === "string" && record.name.trim() ? record.name.trim() : id,
                  secondary: provider ? `${provider} | ${id}` : id,
                  iconSrc: provider ? getProviderIconSrc(provider) : null,
                },
              ];
            })
            .sort((a, b) =>
              a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true })
            )
        );
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setModelsLoadError("Unable to load models.");
        }
      } finally {
        setIsModelsLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [base, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen || !isAwsAgentCoreSelected) {
      return;
    }

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
  }, [base, isAwsAgentCoreSelected, isModalOpen]);

  useEffect(() => {
    if (!isVertexAgentEngineSelected) {
      setMemoryEnabledValue(String(MEMORY_BANK_OPTIONS[1]?.value ?? false));
      setMemoryToolType("");
      return;
    }

    if (memoryEnabledValue !== "true") {
      setMemoryToolType("");
    }
  }, [isVertexAgentEngineSelected, memoryEnabledValue]);

  useEffect(() => {
    if (!isAwsAgentCoreSelected) {
      setAwsCredentialId("");
    }
  }, [isAwsAgentCoreSelected]);

  useEffect(() => {
    if (!isModalOpen) return;
    const ctrl = new AbortController();
    (async () => {
      setIsDefaultsLoading(true);
      setDefaultsLoadError("");
      try {
        const res = await fetch(`${base}/llms/defaults`, {
          headers: { accept: "application/json" },
          signal: ctrl.signal,
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
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDefaultsLoadError("Unable to load default LLMs.");
        setDefaultModels(null);
      } finally {
        setIsDefaultsLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [base, isModalOpen]);

  // Fetch Templates
  useEffect(() => {
    if (!isModalOpen) return;
    const ctrl = new AbortController();
    (async () => {
      setIsTemplatesLoading(true);
      setTemplatesLoadError("");
      try {
        const res = await fetch(`${base}/agent/templates`, {
          headers: { accept: "application/json" },
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data)) {
          setModelTemplates([]);
          setTemplatesLoadError(getErrorMessage(data, "Unable to load templates."));
          return;
        }
        setModelTemplates(data);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setModelTemplates([]);
        setTemplatesLoadError("Unable to load templates.");
      } finally {
        setIsTemplatesLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [base, isModalOpen]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const t = modelTemplates.find((x) => x.template_id === selectedTemplateId);
    if (!t) return;
    setAgentName(t.name || "");
    setDescription(t.description || "");
    setPromptFields({
      prompt_role: t.prompt_role || t.instruction || "",
      prompt_objectives: t.prompt_objectives || "",
      prompt_behavior: t.prompt_behavior || "",
      prompt_output_format: t.prompt_output_format || "",
      prompt_constraints: t.prompt_constraints || "",
      prompt_safety: t.prompt_safety || "",
      prompt_tools_instructions: t.prompt_tools_instructions || "",
      prompt_policy: t.prompt_policy || "",
      prompt_examples: t.prompt_examples || "",
      prompt_additional_info: t.prompt_additional_info || "",
    });
    setPrimaryUseCustom(Boolean(t.model_id?.trim()));
    setPrimaryModelId(t.model_id?.trim() || "");
    setSecondaryUseCustom(false);
    setSecondaryModelId("");
    setTertiaryUseCustom(false);
    setTertiaryModelId("");
  }, [selectedTemplateId, modelTemplates]);

  const resetForm = () => {
    setAgentName("");
    setActiveAgentFormTab(0);
    setDescription("");
    setPromptFields({
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
    });
    setDeploymentTarget(DEPLOYMENT_TARGET_OPTIONS[0]?.value ?? "");
    setAgentType(AGENT_TYPE_OPTIONS[1]?.value ?? "agent");
    setMemoryEnabledValue(String(MEMORY_BANK_OPTIONS[1]?.value ?? false));
    setMemoryToolType("");
    setPrimaryUseCustom(false);
    setSecondaryUseCustom(false);
    setTertiaryUseCustom(false);
    setPrimaryModelId("");
    setSecondaryModelId("");
    setTertiaryModelId("");
    setMcpServers([""]);
    setMcpServerIds([""]);
    setConnectorConfigIds([[]]);
    setSkillIds([""]);
    setSubAgentIds([]);
    setGuardrailsEnabled(false);
    setGuardrailPiiPatterns(DEFAULT_GUARDRAIL_PII_PATTERNS);
    setGuardrailSensitivePatternsText("");
    setGuardrailHarmfulKeywords([]);
    setKnowledgeFiles([]);
    setConfigDataMap({});
    setDefaultModels(null);
    setDefaultsLoadError("");
    setSubmitError("");
    setSuccess("");
    setSelectedTemplateId("");
    setAwsCredentialId("");
    setAwsCredentialOptions([]);
    setAwsCredentialsLoadError("");
  };

  const openModal = () => { resetForm(); setIsModalOpen(true); };
  const closeModal = () => { if (!isCreating) setIsModalOpen(false); };

  // For connectorConfigIds (string[][])
  const updateList = (i: number, val: string[]) => {
    setConnectorConfigIds((prev) =>
      prev.map((x, idx) => (idx === i ? val : x))
    );
  };

  // For mcpServers (string[]) — each entry is a plain string
  const updateMcpServer = (i: number, val: string) => {
    setMcpServers((prev) => prev.map((x, idx) => (idx === i ? val : x)));
    setMcpServerIds((prev) => prev.map((x, idx) => (idx === i ? "" : x)));
  };

  const addToList = (setter: Dispatch<SetStateAction<string[]>>) =>
    setter((p) => [...p, ""]);

  const removeFromList = (setter: Dispatch<SetStateAction<string[]>>, i: number) =>
    setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const normalizeList = (vals: string[]) => vals.map((v) => v.trim()).filter(Boolean);
  const normalizeMcpServerIds = (vals: string[]) =>
    vals.map((v) => v.trim()).filter(Boolean);

  const normalizeManualMcpServers = (urls: string[], ids: string[]) =>
    urls
      .map((url, index) => {
        const trimmedUrl = url.trim();
        const id = ids[index]?.trim() ?? "";
        return id ? "" : trimmedUrl;
      })
      .filter(Boolean);

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

  const getGuardrailsConfig = () => {
    if (!guardrailsEnabled) {
      return { additionalProp1: {} };
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

  const handleCreate = async () => {
    if (!isFormValid) {
      setSubmitError("Please fill all required fields.");
      return;
    }
    setIsCreating(true);
    setSubmitError("");
    setSuccess("");
    try {
      const knowledgeFileIds = await uploadKnowledgeFiles();
      const res = await fetch(`${base}/agent/`, {
        method: "POST",
        headers: { accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          name: normalizeString(agentName),
          description: normalizeString(description),
          primary_use_global: !primaryUseCustom,
          primary_model_id: primaryUseCustom ? effectivePrimaryModelId || null : null,
          secondary_use_global: !secondaryUseCustom,
          secondary_model_id: secondaryUseCustom ? effectiveSecondaryModelId || null : null,
          tertiary_use_global: !tertiaryUseCustom,
          tertiary_model_id: tertiaryUseCustom ? effectiveTertiaryModelId || null : null,
          tools: "",
          skill_ids: normalizeList(skillIds),
          mcp_server_ids: normalizeMcpServerIds(mcpServerIds),
          mcp_servers: normalizeManualMcpServers(mcpServers, mcpServerIds),
            connector_config_ids: connectorConfigIds.flat(),
            deployment_target: deploymentTarget || null,
            aws_credential_id: isAwsAgentCoreSelected ? awsCredentialId || null : null,
            prompt_role: normalizeString(promptFields.prompt_role),
            prompt_objectives: normalizeString(promptFields.prompt_objectives),
            prompt_behavior: normalizeString(promptFields.prompt_behavior),
            prompt_output_format: normalizeString(promptFields.prompt_output_format),
            prompt_constraints: normalizeString(promptFields.prompt_constraints),
            prompt_safety: normalizeString(promptFields.prompt_safety),
            prompt_tools_instructions: normalizeString(
              promptFields.prompt_tools_instructions
            ),
            prompt_policy: normalizeString(promptFields.prompt_policy),
            prompt_examples: normalizeString(promptFields.prompt_examples),
            prompt_additional_info: normalizeString(
              promptFields.prompt_additional_info
            ),
            memory_enabled: isVertexAgentEngineSelected
              ? memoryEnabledValue === "true"
              : false,
            memory_tool_type:
              isVertexAgentEngineSelected && memoryEnabledValue === "true"
                ? memoryToolType || null
                : null,
            isEnabled: true,
            sub_agents: subAgentIds,
            type: agentType || "agent",
            guardrail_sensitive_data: guardrailsEnabled,
            guardrails_config: getGuardrailsConfig(),
            knowledge_file_ids: knowledgeFileIds,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(getErrorMessage(data, "Unable to create agent."));
        return;
      }
      setSuccess("Agent created successfully!");
      await onCreateSuccess?.();
      setTimeout(() => {
        setIsModalOpen(false);
        setToastMessage("Agent created successfully.");
        setIsToastVisible(true);
      }, 1400);
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to create agent."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const addConnector = () => {
    setConnectorConfigIds((prev) => [...prev, []]);
  };

  const addSkill = () => {
    setSkillIds((prev) => [...prev, ""]);
  };

  const removeSkill = (index: number) => {
    setSkillIds((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const removeConnector = (index: number) => {
    setConnectorConfigIds((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const llmFields: LlmFieldConfig[] = [
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
      Logo: Workflow,
    },
    {
      key: "tertiary",
      label: "Tertiary LLM",
      useCustom: tertiaryUseCustom,
      setUseCustom: setTertiaryUseCustom,
      setModelId: setTertiaryModelId,
      effectiveModelId: effectiveTertiaryModelId,
      defaultOption: tertiaryDefaultOption,
      Logo: Workflow,
    },
    
  ];
  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)] transition hover:bg-[#3f39d6] active:scale-95"
      >
        <Plus size={18} />  
        Create New Agent
        <Bot size={18}/>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <ModalCard zIndexClassName="z-[75]" onBackdropClick={closeModal}>
          <ModalCardPanel maxWidthClassName="max-w-5xl" className="max-h-[92vh]">
            <ModalCardHeader
              title="Create New Agent"
              subtitle="Fill the details below"
              icon={<Bot className="h-4 w-4" />}
              actions={
                <div className="relative flex items-center">
                  <LayoutTemplate size={14} className="pointer-events-none absolute left-2.5 text-white/70" />
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={isTemplatesLoading || modelTemplates.length === 0}
                    title={templatesLoadError || undefined}
                    className={`appearance-none rounded-lg pl-8 pr-7 py-1.5 text-xs font-medium outline-none transition focus:ring-2 focus:ring-white/20 ${
                      templatesLoadError
                        ? "cursor-not-allowed border border-red-200/60 bg-white/10 text-white/70"
                        : isTemplatesLoading || modelTemplates.length === 0
                          ? "cursor-not-allowed border border-white/15 bg-white/10 text-white/45"
                          : "border border-white/20 bg-white/10 text-white hover:border-white/35"
                    }`}
                  >
                    <option value="" className="text-slate-900">
                      {isTemplatesLoading
                        ? "Loading templates..."
                        : templatesLoadError
                          ? "Templates unavailable"
                          : modelTemplates.length === 0
                            ? "No templates available"
                            : "Use a template"}
                    </option>
                    {modelTemplates.map((t) => (
                      <option key={t.template_id} value={t.template_id} className="text-slate-900">
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 text-white/70" />
                </div>
              }
              onClose={closeModal}
            />

            {/* Form Content */}
            <ModalCardBody className="flex-1 overflow-y-auto flex flex-col gap-4">

              <AgentFormPages
                activeTab={activeAgentFormTab}
                onTabChange={setActiveAgentFormTab}
                identity={(
                  <Identity
                    agentName={agentName}
                    description={description}
                    onAgentNameChange={setAgentName}
                    onDescriptionChange={setDescription}
                  />
                )}
                deployment={(
                  <Deployment
                    deploymentTarget={deploymentTarget}
                    agentType={agentType}
                    memoryEnabledValue={memoryEnabledValue}
                    memoryToolType={memoryToolType}
                    awsCredentialId={awsCredentialId}
                    awsCredentialOptions={awsCredentialOptions}
                    isAwsCredentialsLoading={isAwsCredentialsLoading}
                    awsCredentialsLoadError={awsCredentialsLoadError}
                    isAwsAgentCoreSelected={isAwsAgentCoreSelected}
                    isVertexAgentEngineSelected={isVertexAgentEngineSelected}
                    onDeploymentTargetChange={setDeploymentTarget}
                    onAgentTypeChange={setAgentType}
                    onMemoryEnabledValueChange={setMemoryEnabledValue}
                    onMemoryToolTypeChange={setMemoryToolType}
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
                    modelsLoadError={modelsLoadError}
                    defaultsLoadError={defaultsLoadError}
                  />
                )}
                capabilities={(
                  <Capabilities
                    mcpServers={mcpServers}
                    mcpOptions={mcpOptions}
                    isMcpLoading={isMcpLoading}
                    openMcpDropdownIndex={openMcpDropdownIndex}
                    mcpDropdownRefs={mcpDropdownRefs}
                    connectorConfigIds={connectorConfigIds}
                    connectorOptions={connectorOptions}
                    configDataMap={configDataMap}
                    skillIds={skillIds}
                    skillOptions={skillOptions}
                    isSkillsLoading={isSkillsLoading}
                    onMcpValueChange={updateMcpServer}
                    onMcpDropdownToggle={(index) =>
                      setOpenMcpDropdownIndex((current) => (current === index ? null : index))
                    }
                    onMcpDropdownClose={() => setOpenMcpDropdownIndex(null)}
                    onMcpClear={(index) => {
                      setMcpServerIds((prev) => prev.map((value, i) => (i === index ? "" : value)));
                      setMcpServers((prev) => prev.map((value, i) => (i === index ? "" : value)));
                      setOpenMcpDropdownIndex(null);
                    }}
                    onMcpSelect={(index, option) => {
                      setMcpServers((prev) =>
                        prev.map((value, i) => (i === index ? option.name || option.serverUrl : value))
                      );
                      setMcpServerIds((prev) =>
                        prev.map((value, i) => (i === index ? option.id : value))
                      );
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
                      updateList(index, Array.isArray(value) ? value : [value])
                    }
                    onSkillAdd={addSkill}
                    onSkillRemove={removeSkill}
                    onSkillChange={(index, value) =>
                      setSkillIds((prev) => prev.map((item, i) => (i === index ? value : item)))
                    }
                  />
                )}
                subAgents={(
                  <SubAgents
                    agentId={agentId}
                    subAgentIds={subAgentIds}
                    agentOptions={agentOptions}
                    isAgentOptionsLoading={isAgentOptionsLoading}
                    onChange={setSubAgentIds}
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
                  <KnowledgeSources
                    files={knowledgeFiles}
                    onFilesChange={setKnowledgeFiles}
                  />
                )}
              />
              {/* Error */}
              {submitError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium">Creation failed</p>
                    <p className="mt-0.5 text-red-600">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium">Agent created successfully</p>
                    <p className="mt-0.5 text-green-600">Your new agent is ready. Closing in a moment…</p>
                  </div>
                </div>
              )}
            </ModalCardBody>

            {/* Footer */}
            <ModalCardFooter className="justify-between bg-slate-50">
              <p className="text-xs text-gray-400">
                {!isFormValid && !success
                  ? <>Fields marked <span className="text-red-400">*</span> are required</>
                  : null}
              </p>

              <div className="flex gap-2.5">
                <button
                  onClick={closeModal}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!isFormValid || isCreating || !!success}
                  className={`flex min-w-[132px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${success ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                >
                  {isCreating ? (
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating…
                    </>
                  ) : success ? (
                    <>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      Created!
                    </>
                  ) : (
                    "Create Agent"
                  )}
                  <Bot size={18}/>
                </button>
              </div>
            </ModalCardFooter>
          </ModalCardPanel>
        </ModalCard>
      )}

      {/* Toast */}
      {isToastVisible && (
        <div className="fixed bottom-6 right-6 z-[80] flex items-center gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-xl shadow-black/10">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{toastMessage}</p>
            <p className="text-xs text-gray-400">Your agent is now live</p>
          </div>
        </div>
      )}
    </>
  );
}

