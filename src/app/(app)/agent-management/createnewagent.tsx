"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Loader2, Plus, Trash2, X } from "lucide-react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { getProviderIconSrc } from "../llm-management/llmHelpers";

type CreateNewAgentProps = {
  onCreateSuccess?: () => void | Promise<void>;
};

type ActionResult = {
  ok: boolean;
  error?: string;
};

type ModelOption = {
  value: string;
  label: string;
  secondary: string;
  iconSrc: string | null;
};

type ModelSelectProps = {
  value: string;
  options: ModelOption[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
};

const toSnakeCase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

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

const normalizeString = (value: string) => value.trim();

function ModelSelect({
  value,
  options,
  placeholder,
  disabled,
  loading,
  onChange,
}: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
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

  const selectedOption = options.find((option) => option.value === value) ?? null;
  const displayLabel = loading
    ? "Loading models..."
    : selectedOption?.label || placeholder;
  const displaySecondary = selectedOption?.secondary || "";
  const displayClass = !value || loading ? "text-[#9ca3af]" : "text-[#111827]";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (disabled || loading) {
            return;
          }
          setIsOpen((previous) => !previous);
        }}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm outline-none transition focus-within:border-[#4f49e2] focus-within:ring-2 focus-within:ring-[#4f49e2]/20 ${
          disabled || loading
            ? "cursor-not-allowed border-[#e0e5f0] bg-white/90"
            : "border-[#e0e5f0] bg-white"
        }`}
      >
        <span className="min-w-0">
          <span className={`flex items-center gap-2 ${displayClass}`}>
            {selectedOption?.iconSrc ? (
              <Image
                src={selectedOption.iconSrc}
                alt={`${selectedOption.label} logo`}
                width={18}
                height={18}
                className="h-[18px] w-[18px] flex-none object-contain"
              />
            ) : null}
            <span className="truncate">{displayLabel}</span>
          </span>
          {value && displaySecondary ? (
            <span className="mt-0.5 block truncate text-xs text-[#64748b]">
              {displaySecondary}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 flex-none text-[#9ca3af]" />
      </button>

      {isOpen && !disabled && !loading ? (
        <div className="relative z-30 mt-2 w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-[#6b7280] hover:bg-[#eef2ff]"
          >
            {placeholder}
          </button>
          <div className="max-h-72 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm ${
                  option.value === value
                    ? "bg-[#eef2ff] text-[#4f49e2]"
                    : "text-[#111827] hover:bg-[#f3f4f6]"
                }`}
              >
                <span className="flex items-center gap-2">
                  {option.iconSrc ? (
                    <Image
                      src={option.iconSrc}
                      alt={`${option.label} logo`}
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] flex-none object-contain"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    <span className="block truncate text-xs text-[#6b7280]">
                      {option.secondary}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CreateNewAgent({ onCreateSuccess }: CreateNewAgentProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const agentManagerApiBase = trimTrailingSlash(llmManagerApiBaseUrl);
  const llmListUrl = `${agentManagerApiBase}/llms/`;
  const agentCreateUrl = `${agentManagerApiBase}/agent/`;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [modelId, setModelId] = useState("");
  const [mcpServers, setMcpServers] = useState<string[]>([""]);
  const [connectorConfigIds, setConnectorConfigIds] = useState<string[]>([""]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [modelsLoadError, setModelsLoadError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const agentId = useMemo(() => toSnakeCase(agentName), [agentName]);
  const trimmedName = normalizeString(agentName);
  const trimmedDescription = normalizeString(description);
  const trimmedInstruction = normalizeString(instruction);

  const isFormValid =
    trimmedName.length > 0 &&
    agentId.length > 0 &&
    trimmedDescription.length > 0 &&
    trimmedInstruction.length > 0 &&
    modelId.length > 0;

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }
    const timer = setTimeout(() => setIsToastVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [isToastVisible]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const controller = new AbortController();
    const loadModels = async () => {
      setIsModelsLoading(true);
      setModelsLoadError("");
      try {
        const response = await fetch(llmListUrl, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
          setModelOptions([]);
          setModelsLoadError(getErrorMessage(data, "Unable to load models."));
          return;
        }

        const options = data
          .map((item) => {
            const record =
              item && typeof item === "object" && !Array.isArray(item)
                ? (item as Record<string, unknown>)
                : null;
            if (!record) {
              return null;
            }
            const itemModelId =
              typeof record.model_id === "string" ? record.model_id.trim() : "";
            if (!itemModelId) {
              return null;
            }
            const provider =
              typeof record.provider === "string" ? record.provider.trim() : "";
            const modelName =
              typeof record.name === "string" && record.name.trim()
                ? record.name.trim()
                : itemModelId;
            const iconSrc = provider ? getProviderIconSrc(provider) : null;

            return {
              value: itemModelId,
              label: modelName,
              secondary: provider ? `${provider} | ${itemModelId}` : itemModelId,
              iconSrc,
            } satisfies ModelOption;
          })
          .filter((item): item is ModelOption => item !== null)
          .sort((left, right) =>
            left.label.localeCompare(right.label, undefined, {
              sensitivity: "base",
              numeric: true,
            })
          );

        setModelOptions(options);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setModelOptions([]);
        setModelsLoadError("Unable to load models.");
      } finally {
        setIsModelsLoading(false);
      }
    };

    loadModels();
    return () => controller.abort();
  }, [isModalOpen]);

  const resetForm = () => {
    setAgentName("");
    setDescription("");
    setInstruction("");
    setModelId("");
    setMcpServers([""]);
    setConnectorConfigIds([""]);
    setSubmitError("");
  };

  const openModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isCreating) {
      return;
    }
    setIsModalOpen(false);
  };

  const updateTextList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    nextValue: string
  ) => {
    setter((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? nextValue : item
      )
    );
  };

  const addTextField = (
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((previous) => [...previous, ""]);
  };

  const removeTextField = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) => {
    setter((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const normalizeStringList = (values: string[]) =>
    values.map((value) => value.trim()).filter((value) => value.length > 0);

  const handleCreateAgent = async (): Promise<ActionResult> => {
    if (!isFormValid) {
      setSubmitError("Fill name, description, instructions, and model.");
      return { ok: false, error: "Form validation failed." };
    }

    setIsCreating(true);
    setSubmitError("");

    const payload = {
      agent_id: agentId,
      name: trimmedName,
      description: trimmedDescription,
      instruction: trimmedInstruction,
      model_id: modelId,
      tools: "",
      mcp_servers: normalizeStringList(mcpServers),
      connector_config_ids: normalizeStringList(connectorConfigIds),
      isEnabled: true,
      sub_agents: [] as string[],
    };

    try {
      const response = await fetch(agentCreateUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorMessage = getErrorMessage(data, "Unable to create agent.");
        setSubmitError(errorMessage);
        return { ok: false, error: errorMessage };
      }

      setIsModalOpen(false);
      setToastMessage("Agent created successfully.");
      setIsToastVisible(true);
      await onCreateSuccess?.();
      return { ok: true };
    } catch {
      const errorMessage = "Unable to create agent.";
      setSubmitError(errorMessage);
      return { ok: false, error: errorMessage };
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] transition hover:bg-[#3f39d6]"
      >
        <Plus className="h-4 w-4" />
        Create New Agent
      </button>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/30 px-4 py-4">
          <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#eef1f7] px-6 py-4">
              <h4 className="text-lg font-semibold text-[#111827]">
                Create Agent
              </h4>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f4f6] text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#111827]">
                    Agent name <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(event) => setAgentName(event.target.value)}
                    placeholder="Enter agent name"
                    className="w-full rounded-xl border border-[#e0e5f0] px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#111827]">
                    Agent ID (auto)
                  </span>
                  <input
                    type="text"
                    value={agentId}
                    readOnly
                    placeholder="auto_generated_agent_id"
                    className="w-full rounded-xl border border-[#e0e5f0] bg-[#f8fafc] px-4 py-2.5 text-sm text-[#334155] outline-none"
                  />
                  <span className="block text-xs text-[#64748b]">
                    Generated as snake_case from agent name.
                  </span>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#111827]">
                    Description <span className="text-[#ef4444]">*</span>
                  </span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe this agent"
                    rows={3}
                    className="w-full rounded-xl border border-[#e0e5f0] px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#111827]">
                    Instructions <span className="text-[#ef4444]">*</span>
                  </span>
                  <textarea
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder="Write agent instructions"
                    rows={3}
                    className="w-full rounded-xl border border-[#e0e5f0] px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-[#111827]">
                  Model <span className="text-[#ef4444]">*</span>
                </span>
                <ModelSelect
                  value={modelId}
                  options={modelOptions}
                  placeholder="Select model"
                  loading={isModelsLoading}
                  disabled={isModelsLoading || modelOptions.length === 0}
                  onChange={setModelId}
                />
                {modelsLoadError ? (
                  <p className="text-sm text-[#dc2626]">{modelsLoadError}</p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-[#111827]">
                    MCP Servers
                  </span>
                  <div className="space-y-2">
                    {mcpServers.map((server, index) => (
                      <div key={`mcp-${index}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={server}
                          onChange={(event) =>
                            updateTextList(
                              setMcpServers,
                              index,
                              event.target.value
                            )
                          }
                          placeholder="https://example.com/mcp"
                          className="w-full rounded-xl border border-[#e0e5f0] px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
                        />
                        <button
                          type="button"
                          onClick={() => addTextField(setMcpServers)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce3f1] text-[#4f49e2] transition hover:bg-[#eef2ff]"
                          title="Add MCP server"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        {mcpServers.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeTextField(setMcpServers, index)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#fecdd3] text-[#ef4444] transition hover:bg-[#fff1f2]"
                            title="Remove MCP server"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-semibold text-[#111827]">
                    Connector Config IDs
                  </span>
                  <div className="space-y-2">
                    {connectorConfigIds.map((connectorId, index) => (
                      <div
                        key={`connector-id-${index}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={connectorId}
                          onChange={(event) =>
                            updateTextList(
                              setConnectorConfigIds,
                              index,
                              event.target.value
                            )
                          }
                          placeholder="connector_config_id"
                          className="w-full rounded-xl border border-[#e0e5f0] px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
                        />
                        <button
                          type="button"
                          onClick={() => addTextField(setConnectorConfigIds)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce3f1] text-[#4f49e2] transition hover:bg-[#eef2ff]"
                          title="Add connector config"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        {connectorConfigIds.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              removeTextField(setConnectorConfigIds, index)
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#fecdd3] text-[#ef4444] transition hover:bg-[#fff1f2]"
                            title="Remove connector config"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {submitError ? (
                <p className="text-sm font-medium text-[#dc2626]">{submitError}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAgent}
                disabled={isCreating || !isFormValid}
                className={`inline-flex min-w-[148px] items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white ${
                  isCreating || !isFormValid
                    ? "cursor-not-allowed bg-[#c7c4f7]"
                    : "bg-[#4f49e2] shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] hover:bg-[#3f39d6]"
                }`}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isCreating ? "Creating..." : "Create Agent"}
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
    </>
  );
}
