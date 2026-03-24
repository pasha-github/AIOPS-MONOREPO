"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Bot, ChevronDown, Plus, Trash2, X, LayoutTemplate } from "lucide-react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { getProviderIconSrc } from "../llm-management/llmHelpers";

type CreateNewAgentProps = {
  onCreateSuccess?: () => void | Promise<void>;
};

type ActionResult = { ok: boolean; error?: string };

type ModelOption = {
  value: string;
  label: string;
  secondary: string;
  iconSrc: string | null;
};

type ModelTemplate = {
  template_id: string;
  name: string;
  description?: string;
  instruction?: string;
  model_id?: string;
};

const toSnakeCase = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const normalizeString = (value: string) => value.trim();

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object" && "message" in payload && typeof (payload as any).message === "string") {
    return String((payload as any).message);
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div ref={ref} className="relative">
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
export default function CreateNewAgent({ onCreateSuccess }: CreateNewAgentProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const base = trimTrailingSlash(llmManagerApiBaseUrl);

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
  const [success, setSuccess] = useState("");
  const [modelTemplates, setModelTemplates] = useState<ModelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [templatesLoadError, setTemplatesLoadError] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // agentId is still computed and sent to the backend — just not shown in the UI
  const agentId = useMemo(() => toSnakeCase(agentName), [agentName]);

  const isFormValid =
    normalizeString(agentName).length > 0 &&
    agentId.length > 0 &&
    normalizeString(description).length > 0 &&
    normalizeString(instruction).length > 0 &&
    modelId.length > 0;

  /* toast auto-hide */
  useEffect(() => {
    if (!isToastVisible) return;
    const t = setTimeout(() => setIsToastVisible(false), 3000);
    return () => clearTimeout(t);
  }, [isToastVisible]);

  /* load models */
  useEffect(() => {
    if (!isModalOpen) return;
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
      } catch (e: any) {
        if (e?.name !== "AbortError") setModelsLoadError("Unable to load models.");
      } finally { setIsModelsLoading(false); }
    })();
    return () => ctrl.abort();
  }, [base, isModalOpen]);

  /* load templates */
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
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setModelTemplates([]);
        setTemplatesLoadError("Unable to load templates.");
      } finally {
        setIsTemplatesLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [base, isModalOpen]);

  /* apply template */
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
    setAgentName(""); setDescription(""); setInstruction(""); setModelId("");
    setMcpServers([""]); setConnectorConfigIds([""]); setSubmitError(""); setSuccess(""); setSelectedTemplateId("");
  };

  const openModal = () => { resetForm(); setIsModalOpen(true); };
  const closeModal = () => { if (!isCreating) setIsModalOpen(false); };

  const updateList = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
    setter((p) => p.map((x, idx) => idx === i ? v : x));
  const addToList = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter((p) => [...p, ""]);
  const removeFromList = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    setter((p) => p.length <= 1 ? p : p.filter((_, idx) => idx !== i));
  const normalizeList = (vals: string[]) => vals.map((v) => v.trim()).filter(Boolean);

  const handleCreate = async () => {
    if (!isFormValid) { setSubmitError("Please fill all required fields."); return; }
    setIsCreating(true); setSubmitError(""); setSuccess("");
    try {
      const res = await fetch(`${base}/agent/`, {
        method: "POST",
        headers: { accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,  // still sent to backend
          name: normalizeString(agentName),
          description: normalizeString(description),
          instruction: normalizeString(instruction),
          model_id: modelId,
          tools: "",
          mcp_servers: normalizeList(mcpServers),
          connector_config_ids: normalizeList(connectorConfigIds),
          isEnabled: true,
          sub_agents: [],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSubmitError(getErrorMessage(data, "Unable to create agent.")); return; }
      setSuccess("Agent created successfully!");
      await onCreateSuccess?.();
      setTimeout(() => { setIsModalOpen(false); setToastMessage("Agent created successfully."); setIsToastVisible(true); }, 1400);
    } catch { setSubmitError("Unable to create agent."); }
    finally { setIsCreating(false); }
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-95"
      >
        <Plus size={16} />
        Create New Agent
      </button>

      {/* ── Modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-6 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Bot size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 leading-tight">Create Agent</h2>
                <p className="mt-0.5 text-xs text-gray-400">Configure a new agent from scratch or from a template</p>
              </div>

              {/* Template picker */}
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

              <button
                onClick={closeModal}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-gray-200"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">

              {/* ── Identity ── */}
              <SectionLabel>Identity</SectionLabel>

              {/* Agent Name only — Agent ID is hidden from UI but still sent to the backend */}
              <Field label="Agent Name" required hint="Human-readable display name for this agent">
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Support Bot"
                  className={inputClass}
                />
              </Field>

              {/* ── Behaviour ── */}
              <SectionLabel>Behaviour</SectionLabel>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Description" required hint="Brief summary of what this agent does">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Handles customer support queries"
                    rows={3}
                    className={`${inputClass} resize-y`}
                  />
                </Field>

                <Field label="System Instruction" required hint="System prompt defining personality and behaviour">
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
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
                  value={modelId}
                  options={modelOptions}
                  placeholder="Select a model"
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

              {/* ── Feedback ── */}
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
            <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
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

      {/* ── Toast ── */}
      {isToastVisible && (
        <div className="fixed bottom-6 right-6 z-[80] flex items-center gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-xl shadow-black/10">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{toastMessage}</p>
            <p className="text-xs text-gray-400">The agent is now available</p>
          </div>
          <button onClick={() => setIsToastVisible(false)} className="ml-2 text-gray-300 hover:text-gray-500">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
