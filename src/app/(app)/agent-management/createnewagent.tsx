import { useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, Plus, LayoutTemplate  } from "lucide-react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { getProviderIconSrc } from "../llm-management/llmHelpers";
import { DynamicDropdownField, DynamicListField } from "./DynamicConnector";
import ModelSelect, { ModelOption } from "./ModelSelect";
import { CreateNewAgentProps, ModelTemplate } from "./types";

const toSnakeCase = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

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

export default function CreateNewAgent({ onCreateSuccess }: CreateNewAgentProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const base = trimTrailingSlash(llmManagerApiBaseUrl);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [modelId, setModelId] = useState("");
  const [mcpServers, setMcpServers] = useState<string[]>([""]);
  const [connectorConfigIds, setConnectorConfigIds] = useState<string[][]>([[]]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [modelsLoadError, setModelsLoadError] = useState("");
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
  const [isConnectorsLoading, setIsConnectorsLoading] = useState(false);
  const [configDataMap, setConfigDataMap] = useState<Record<string, any>>({});

  const agentId = useMemo(() => toSnakeCase(agentName), [agentName]);

  // Fetch connectors
  useEffect(() => {
    if (!isModalOpen) return;
    const ctrl = new AbortController();
    (async () => {
      setIsConnectorsLoading(true);
      try {
        const res = await fetch(`${base}/connectors/`, {
          headers: { accept: "application/json" },
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setConnectorOptions(
            data.map((item: any) => ({
              value: item.connector_config_id ?? item.id ?? "",
              label: item.name ?? item.connector_config_id ?? item.id ?? "",
            }))
          );
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setConnectorOptions([]);
      } finally {
        setIsConnectorsLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [base, isModalOpen]);

  const fetchConnectorConfig = async (value: string) => {
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
  };

  useEffect(() => {
    if (!connectorOptions.length) return;
    connectorOptions.forEach((opt) => {
      fetchConnectorConfig(opt.value);
    });
  }, [connectorOptions]);

  const isFormValid =
    normalizeString(agentName).length > 0 &&
    agentId.length > 0 &&
    normalizeString(description).length > 0 &&
    normalizeString(instruction).length > 0 &&
    modelId.length > 0;

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
            .flatMap((item: any) => {
              const id = item?.model_id?.trim();
              if (!id) return [];
              const provider = item?.provider?.trim() || "";
              return [
                {
                  value: id,
                  label: item?.name?.trim() || id,
                  secondary: provider ? `${provider} | ${id}` : id,
                  iconSrc: provider ? getProviderIconSrc(provider) : null,
                },
              ];
            })
            .sort((a, b) =>
              a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true })
            )
        );
      } catch (e: any) {
        if (e?.name !== "AbortError") setModelsLoadError("Unable to load models.");
      } finally {
        setIsModelsLoading(false);
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
    setInstruction(t.instruction || "");
    setModelId(t.model_id?.trim() || "");
  }, [selectedTemplateId, modelTemplates]);

  const resetForm = () => {
    setAgentName("");
    setDescription("");
    setInstruction("");
    setModelId("");
    setMcpServers([""]);
    setConnectorConfigIds([[]]);
    setConfigDataMap({});
    setSubmitError("");
    setSuccess("");
    setSelectedTemplateId("");
  };

  const openModal = () => { resetForm(); setIsModalOpen(true); };
  const closeModal = () => { if (!isCreating) setIsModalOpen(false); };

  const updateList = (i: number, val: string[]) => {
    setConnectorConfigIds((prev) =>
      prev.map((x, idx) => (idx === i ? val : x))
    );
  };

  const addToList = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter((p) => [...p, ""]);

  const removeFromList = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const normalizeList = (vals: string[]) => vals.map((v) => v.trim()).filter(Boolean);

  const handleCreate = async () => {
    if (!isFormValid) {
      setSubmitError("Please fill all required fields.");
      return;
    }
    setIsCreating(true);
    setSubmitError("");
    setSuccess("");
    try {
      const res = await fetch(`${base}/agent/`, {
        method: "POST",
        headers: { accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          name: normalizeString(agentName),
          description: normalizeString(description),
          instruction: normalizeString(instruction),
          model_id: modelId,
          tools: "",
          mcp_servers: normalizeList(mcpServers),
          connector_config_ids: connectorConfigIds.flat(),
          isEnabled: true,
          sub_agents: [],
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
    } catch {
      setSubmitError("Unable to create agent.");
    } finally {
      setIsCreating(false);
    }
  };

  const addConnector = () => {
    setConnectorConfigIds((prev) => [...prev, []]);
  };

  const removeConnector = (index: number) => {
    setConnectorConfigIds((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

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
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Bot size={18} />
                </div>
                <div>
                  {/* ← doc 2 header text sizes */}
                  <h1 className="text-sm font-semibold text-gray-900 leading-tight">Create New Agent</h1>
                  <p className="text-xs text-gray-400 mt-0.5">Fill the details below</p>
                </div>
              </div>

              <div className="relative flex items-center">
                <LayoutTemplate size={14} className="pointer-events-none absolute left-2.5 text-indigo-400" />
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={isTemplatesLoading || modelTemplates.length === 0}
                  title={templatesLoadError || undefined}
                  className={`appearance-none rounded-lg pl-8 pr-7 py-1.5 text-xs font-medium outline-none transition focus:ring-2 focus:ring-indigo-500/10 ${
                    templatesLoadError
                      ? "cursor-not-allowed border border-red-200 bg-red-50 text-red-500"
                      : isTemplatesLoading || modelTemplates.length === 0
                        ? "cursor-not-allowed border border-indigo-100 bg-indigo-50 text-indigo-300"
                        : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300"
                  }`}
                >
                  <option value="">
                    {isTemplatesLoading
                      ? "Loading templates..."
                      : templatesLoadError
                        ? "Templates unavailable"
                        : modelTemplates.length === 0
                          ? "No templates available"
                          : "Use a template"}
                  </option>
                  {modelTemplates.map((t) => (
                    <option key={t.template_id} value={t.template_id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2 text-indigo-400" />
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

              {/* Identity */}
              {/* ← doc 2 section label style */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Identity</p>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <p className="text-xs leading-snug text-gray-400">Human-readable display name for this agent</p>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., Customer Support Assistant"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>

              {/* Behavior & Intelligence */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Behaviour</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs leading-snug text-gray-400">Brief summary of what this agent does</p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this agent do?"
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 resize-y"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    System Instruction <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs leading-snug text-gray-400">System prompt defining personality and behaviour</p>
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="You are a helpful AI assistant that..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 resize-y"
                  />
                </div>
              </div>

              {/* Language Model */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Model</p>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                  Language Model <span className="text-red-500">*</span>
                </label>
                <p className="text-xs leading-snug text-gray-400">The LLM this agent will use to generate responses</p>
                <ModelSelect
                  value={modelId}
                  options={modelOptions}
                  placeholder="Choose a language model"
                  loading={isModelsLoading}
                  disabled={isModelsLoading || modelOptions.length === 0}
                  onChange={setModelId}
                />
                {modelsLoadError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    {modelsLoadError}
                  </p>
                )}
              </div>

              {/* Capabilities */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Capabilities</p>

              <div className="space-y-4">
                <DynamicListField
                  label="MCP Servers"
                  hint="URLs of Model Context Protocol servers"
                  values={mcpServers}
                  placeholder="https://mcp.example.com/sse"
                  onAdd={() => addToList(setMcpServers)}
                  onRemove={(i) => removeFromList(setMcpServers, i)}
                  onChange={(i, v) => updateList(i, v)}
                />

                <DynamicDropdownField
                  label="Connector Config"
                  values={connectorConfigIds}
                  options={connectorOptions}
                  configDataMap={configDataMap}
                  onAdd={addConnector}
                  onRemove={removeConnector}
                  onChange={(i, val) => updateList(i, val)}
                />
              </div>

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
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-4 bg-slate-50 flex justify-between items-center">
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
                  className={`flex min-w-[132px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    success ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"
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
                </button>
              </div>
            </div>
          </div>
        </div>
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