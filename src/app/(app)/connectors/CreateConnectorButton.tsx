"use client";

import {
  AGENT_API_BASE_URL,
  AGENT_CONNECTORS_BASE_URL,
  AGENT_ORG_KEY,
} from "@/config/agent";
import { ChevronDown, Plug, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type AgentTypeOption = {
  code: string;
  name: string;
};

type ConnectorSchemaField = {
  field: string;
  type: string;
  label: string;
  value?: string;
};

type SelectOption = { value: string; label: string };

type RoundedSelectProps = {
  value: string;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
};

function RoundedSelect({
  value,
  options,
  placeholder,
  disabled,
  loading,
  onChange,
}: RoundedSelectProps) {
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

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? "";
  const displayLabel = loading ? "Loading..." : selectedLabel || placeholder;
  const displayClass = loading || !value ? "text-[#9ca3af]" : "text-[#111827]";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (disabled || loading) {
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm outline-none transition focus-within:border-[#4f49e2] focus-within:ring-2 focus-within:ring-[#4f49e2]/20 ${
          disabled || loading
            ? "cursor-not-allowed border-[#e5e7eb] bg-[#edf0f6]"
            : "border-[#e0e5f0] bg-white"
        }`}
      >
        <span className={displayClass}>{displayLabel}</span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>

      {isOpen && !disabled && !loading ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.4)]">
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
          <div className="max-h-56 overflow-auto">
            {options.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
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
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CreateConnectorButtonProps = {
  onCreated?: () => void;
  renderTrigger?: (props: { open: () => void }) => React.ReactNode;
};

export default function CreateConnectorButton({
  onCreated,
  renderTrigger,
}: CreateConnectorButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [agentTypes, setAgentTypes] = useState<SelectOption[]>([]);
  const [enterpriseOptions, setEnterpriseOptions] = useState<SelectOption[]>([]);
  const [selectedAgentType, setSelectedAgentType] = useState("");
  const [selectedEnterprise, setSelectedEnterprise] = useState("");
  const [schemaFields, setSchemaFields] = useState<ConnectorSchemaField[]>([]);
  const [step, setStep] = useState<"select" | "schema">("select");
  const [isAgentTypesLoading, setIsAgentTypesLoading] = useState(false);
  const [isEnterpriseLoading, setIsEnterpriseLoading] = useState(false);
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [schemaError, setSchemaError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const apiBase = AGENT_API_BASE_URL.endsWith("/")
    ? AGENT_API_BASE_URL.slice(0, -1)
    : AGENT_API_BASE_URL;
  const connectorsBase = AGENT_CONNECTORS_BASE_URL.endsWith("/")
    ? AGENT_CONNECTORS_BASE_URL.slice(0, -1)
    : AGENT_CONNECTORS_BASE_URL;

  const agentTypesUrl = useMemo(
    () => `${apiBase}/aiops/agent/types?orgKey=${encodeURIComponent(AGENT_ORG_KEY)}`,
    [apiBase]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    const loadTypes = async () => {
      setIsAgentTypesLoading(true);
      setLoadError("");
      try {
        const response = await fetch(agentTypesUrl, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!isMounted) {
          return;
        }
        if (response.ok && Array.isArray(data?.agentTypes)) {
          const mapped = (data.agentTypes as AgentTypeOption[]).map((item) => ({
            value: item.code,
            label: item.name,
          }));
          setAgentTypes(mapped);
        } else {
          setAgentTypes([]);
          setLoadError("Unable to load agent types.");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (isMounted) {
          setAgentTypes([]);
          setLoadError("Unable to load agent types.");
        }
      } finally {
        if (isMounted) {
          setIsAgentTypesLoading(false);
        }
      }
    };

    loadTypes();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [agentTypesUrl, isOpen]);

  useEffect(() => {
    if (!selectedAgentType) {
      setEnterpriseOptions([]);
      setSelectedEnterprise("");
      setSchemaFields([]);
      setStep("select");
      localStorage.removeItem("connector-agent-type");
      localStorage.removeItem("connector-enterprise");
      return;
    }

    localStorage.setItem("connector-agent-type", selectedAgentType);
    let isMounted = true;
    const controller = new AbortController();
    const loadEnterprises = async () => {
      setIsEnterpriseLoading(true);
      setLoadError("");
      try {
        const url = `${apiBase}/aiops/agent/subtypes?agentType=${encodeURIComponent(
          selectedAgentType
        )}&orgKey=${encodeURIComponent(AGENT_ORG_KEY)}`;
        const response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!isMounted) {
          return;
        }
        if (response.ok && Array.isArray(data?.agents)) {
          const mapped = (data.agents as string[]).map((item) => ({
            value: item,
            label: item,
          }));
          setEnterpriseOptions(mapped);
        } else {
          setEnterpriseOptions([]);
          setLoadError("Unable to load enterprises.");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (isMounted) {
          setEnterpriseOptions([]);
          setLoadError("Unable to load enterprises.");
        }
      } finally {
        if (isMounted) {
          setIsEnterpriseLoading(false);
        }
      }
    };

    loadEnterprises();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiBase, selectedAgentType]);

  useEffect(() => {
    if (selectedEnterprise) {
      localStorage.setItem("connector-enterprise", selectedEnterprise);
    } else {
      localStorage.removeItem("connector-enterprise");
    }
  }, [selectedEnterprise]);

  const canProceed = Boolean(selectedAgentType && selectedEnterprise);
  const closeModal = () => {
    setIsOpen(false);
    setStep("select");
    setSchemaFields([]);
    setSchemaError("");
    setSubmitError("");
    setSelectedAgentType("");
    setSelectedEnterprise("");
    localStorage.removeItem("connector-agent-type");
    localStorage.removeItem("connector-enterprise");
  };

  const handleLoadSchema = async () => {
    if (!canProceed || isSchemaLoading) {
      return;
    }
    setIsSchemaLoading(true);
    setSchemaError("");
    try {
      const url = `${connectorsBase}/aiops/connectors/schemas?provider_code=${encodeURIComponent(
        selectedEnterprise
      )}`;
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "X-Organization-Key": AGENT_ORG_KEY,
        },
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data?.schema)) {
        setSchemaFields(
          (data.schema as ConnectorSchemaField[]).map((field) => ({
            ...field,
            value: field.value ?? "",
          }))
        );
        setStep("schema");
      } else {
        setSchemaFields([]);
        setSchemaError("Unable to load connector schema.");
      }
    } catch (error) {
      setSchemaFields([]);
      setSchemaError("Unable to load connector schema.");
    } finally {
      setIsSchemaLoading(false);
    }
  };

  const handleSubmitConnector = async () => {
    if (step !== "schema" || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const url = `${connectorsBase}/aiops/connectors?orgKey=${encodeURIComponent(
        AGENT_ORG_KEY
      )}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "X-Organization-Key": AGENT_ORG_KEY,
        },
        body: JSON.stringify({
          provider_code: selectedEnterprise,
          schema: schemaFields.map((field) => ({
            field: field.field,
            type: field.type,
            label: field.label,
            value: field.value ?? "",
          })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const apiError =
          typeof data === "object" && data
            ? "detail" in data
              ? String((data as { detail?: string }).detail ?? "")
              : "message" in data
                ? String((data as { message?: string }).message ?? "")
                : ""
            : "";
        const sanitized = apiError
          .replace(/^(.*?)(?:\s*[:\-]\s*)(\d{3})(?:\s*[-:]\s*.*)?$/, "$1")
          .trim();
        setSubmitError(sanitized || "Unable to create connector.");
        return;
      }

      onCreated?.();
      closeModal();
    } catch (error) {
      setSubmitError("Unable to create connector.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openModal = () => setIsOpen(true);

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ open: openModal })
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(79,73,226,0.65)]"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.65)]">
            <div className="flex items-center justify-between bg-[#4f49e2] px-6 py-4 text-white">
              <h3 className="text-lg font-semibold">Create Credentials</h3>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-8 py-6">
              <div className="space-y-2">
                <h4 className="text-xl font-semibold text-[#101828]">
                  Connect your system
                </h4>
                <p className="text-sm text-[#6b7280]">
                  {step === "schema" ? "Step 2 of 2" : "Step 1 of 2"}
                </p>
                <div className="flex max-w-xs items-center gap-2 pt-1">
                  {[1, 2].map((index) => (
                    <span
                      key={index}
                      className={`h-1.5 flex-1 rounded-full ${
                        step === "schema"
                          ? "bg-[#4f49e2]"
                          : index === 1
                            ? "bg-[#4f49e2]"
                            : "bg-[#e2e8f0]"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-[#eef1f7] bg-white p-6 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.15)]">
                {loadError || schemaError || submitError ? (
                  <div className="mb-4 rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
                    {loadError || schemaError || submitError}
                  </div>
                ) : null}
                {step === "select" ? (
                  <>
                    <div className="mb-5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]">
                          <Plug className="h-4 w-4" />
                        </span>
                        <h5 className="text-lg font-semibold text-[#111827]">
                        Configure the connector experience
                        </h5>
                      </div>
                      <p className="mt-2 text-sm text-[#6b7280]">
                        Pick the type and enterprise to connect.
                      </p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="text-sm font-semibold text-[#111827]">
                        <span>Agent type</span>
                        <div className="mt-2">
                          <RoundedSelect
                            value={selectedAgentType}
                            options={agentTypes}
                            placeholder="Select agent type"
                            loading={isAgentTypesLoading}
                            onChange={(value) => {
                              setSelectedAgentType(value);
                              setSelectedEnterprise("");
                              setSchemaFields([]);
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-[#111827]">
                        <span>Enterprise</span>
                        <div className="mt-2">
                          <RoundedSelect
                            value={selectedEnterprise}
                            options={enterpriseOptions}
                            placeholder="Select enterprise"
                            disabled={!selectedAgentType}
                            loading={isEnterpriseLoading}
                            onChange={(value) => setSelectedEnterprise(value)}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    {schemaFields.map((field) => (
                      <label
                        key={field.field}
                        className="text-sm font-semibold text-[#111827]"
                      >
                        <span>{field.label}</span>
                        <input
                          type={field.type === "password" ? "password" : "text"}
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setSchemaFields((prev) =>
                              prev.map((item) =>
                                item.field === field.field
                                  ? { ...item, value: nextValue }
                                  : item
                              )
                            );
                          }}
                          placeholder={`Enter ${field.label}`}
                          className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#eef1f7] px-8 py-4">
              <button
                type="button"
                onClick={() => {
                  if (step === "schema") {
                    setStep("select");
                    return;
                  }
                }}
                className="rounded-xl border border-[#e5e7eb] px-7 py-2.5 text-sm font-semibold text-[#4f49e2]"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={step === "schema" ? handleSubmitConnector : handleLoadSchema}
                disabled={
                  step === "schema"
                    ? isSubmitting
                    : !canProceed || isSchemaLoading
                }
                className={`min-w-[110px] rounded-xl px-7 py-2.5 text-sm font-semibold text-white ${
                  step === "schema"
                    ? isSubmitting
                      ? "cursor-not-allowed bg-[#c7c4f7]"
                      : "bg-[#4f49e2] shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)]"
                    : canProceed
                    ? "bg-[#4f49e2] shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)]"
                    : "cursor-not-allowed bg-[#c7c4f7]"
                }`}
              >
                {step === "schema"
                  ? isSubmitting
                    ? "Submitting..."
                    : "Submit"
                  : isSchemaLoading
                    ? "Loading..."
                    : "Next"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
