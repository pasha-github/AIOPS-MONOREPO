"use client";

import { Lock, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CONNECTOR_CONFIG_SCHEMAS,
  type ConfigField,
} from "./connectorSchemas";

type SetConnectorConfigProps = {
  isOpen: boolean;
  connectorId: string | null;
  connectorName: string | null;
  connectorsApiBase: string;
  mode?: "create" | "edit";
  onClose: () => void;
};

type ConfigValue = {
  name: string;
  value: string;
};

type ConnectorConfigRecord = {
  created_at: string;
  config: ConfigValue[];
  connector_id: string;
  name: string;
  connector_config_id: string;
  description: string | null;
  updated_at: string;
};

type FormState = {
  configName: string;
  fieldsState: Record<string, string>;
  editingConfigId: string | null;
};

const normalizeConnectorSchemaKey = (connectorId: string | null) => {
  if (!connectorId) {
    return "";
  }

  const normalized = connectorId.toLowerCase();
  return normalized === "ibm_mq" || normalized === "mq"
    ? "ibm_mq_connector"
    : normalized;
};

const getDefaultFieldsState = (fields: ConfigField[]) =>
  Object.fromEntries(fields.map((field) => [field.name, ""])) as Record<
    string,
    string
  >;

const getLatestConfigRecord = (records: ConnectorConfigRecord[]) =>
  [...records].sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at).getTime();
    const rightTime = new Date(right.updated_at || right.created_at).getTime();
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  })[0] ?? null;

const buildFormState = (
  fields: ConfigField[],
  record?: ConnectorConfigRecord | null
): FormState => {
  const fieldsState = getDefaultFieldsState(fields);

  if (!record) {
    return {
      configName: "",
      fieldsState,
      editingConfigId: null,
    };
  }

  record.config.forEach((item) => {
    fieldsState[item.name] = item.value ?? "";
  });

  return {
    configName: record.name ?? "",
    fieldsState,
    editingConfigId: record.connector_config_id,
  };
};

const getModalCopy = (mode: "create" | "edit") => ({
  title: mode === "edit" ? "Update Config" : "Set Config",
  action: mode === "edit" ? "Update" : "Set",
  pendingAction: mode === "edit" ? "Updating..." : "Setting...",
  successAction: mode === "edit" ? "Updated!" : "Saved!",
  successMessage:
    mode === "edit"
      ? "Connector config updated successfully!"
      : "Connector config saved successfully!",
  submitError:
    mode === "edit"
      ? "Unable to update connector config."
      : "Unable to set connector config.",
});

export default function SetConnectorConfig({
  isOpen,
  connectorId,
  connectorName,
  connectorsApiBase,
  mode = "create",
  onClose,
}: SetConnectorConfigProps) {
  const schema = useMemo(() => {
    if (!connectorId) {
      return [];
    }
    return CONNECTOR_CONFIG_SCHEMAS[normalizeConnectorSchemaKey(connectorId)] ?? [];
  }, [connectorId]);

  const emptyFormState = useMemo(() => buildFormState(schema), [schema]);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [initialFormState, setInitialFormState] = useState<FormState>(emptyFormState);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const copy = getModalCopy(mode);

  const applyFormState = useCallback(
    (nextState: FormState, nextPrefillError = "") => {
      setFormState(nextState);
      setInitialFormState(nextState);
      setPrefillError(nextPrefillError);
      setSubmitError("");
      setSuccessMessage("");
      setIsSubmitting(false);
      setIsPrefilling(false);
    },
    []
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!connectorId || mode === "create") {
      queueMicrotask(() => applyFormState(emptyFormState));
      return;
    }

    const controller = new AbortController();

    const loadExistingConfig = async () => {
      setSubmitError("");
      setPrefillError("");
      setIsSubmitting(false);
      setIsPrefilling(true);

      const response = await fetch(
        `${connectorsApiBase}/connectors/${encodeURIComponent(connectorId)}/config`,
        {
          method: "GET",
          headers: { accept: "application/json" },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load current connector config.");
      }

      const latestRecord = getLatestConfigRecord(
        (await response.json()) as ConnectorConfigRecord[]
      );

      applyFormState(
        buildFormState(schema, latestRecord),
        latestRecord ? "" : "No saved config was found for this connector."
      );
    };

    loadExistingConfig().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      applyFormState(emptyFormState, "Unable to load current connector config.");
    });

    return () => controller.abort();
  }, [applyFormState, connectorId, connectorsApiBase, emptyFormState, isOpen, mode, schema]);

  if (!isOpen || !connectorId) {
    return null;
  }

  const resetAndClose = () => {
    applyFormState(emptyFormState);
    onClose();
  };

  const isFormValid =
    Boolean(formState.configName.trim()) &&
    schema.every((field) =>
      field.required ? Boolean(formState.fieldsState[field.name]?.trim()) : true
    );

  const isDirty =
    formState.configName.trim() !== initialFormState.configName.trim() ||
    schema.some(
      (field) =>
        (formState.fieldsState[field.name] ?? "") !==
        (initialFormState.fieldsState[field.name] ?? "")
    );

  const isSubmitEnabled =
    !isSubmitting &&
    !isPrefilling &&
    isFormValid &&
    (mode === "create" || (Boolean(formState.editingConfigId) && isDirty));

  const payload = {
    connector_id: connectorId,
    name: formState.configName.trim(),
    config: schema.map((field) => ({
      name: field.name,
      value: formState.fieldsState[field.name] ?? "",
    })),
  };

  const submitConfig = async () => {
    if (!isSubmitEnabled) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const collectionEndpoint = `${connectorsApiBase}/connectors/${encodeURIComponent(
        connectorId
      )}/config`;
      const patchRequests =
        mode === "edit" && formState.editingConfigId
          ? [
              {
                url: `${collectionEndpoint}/${encodeURIComponent(
                  formState.editingConfigId
                )}`,
                body: payload,
              },
              {
                url: collectionEndpoint,
                body: {
                  ...payload,
                  connector_config_id: formState.editingConfigId,
                },
              },
            ]
          : [{ url: collectionEndpoint, body: payload }];

      let response: Response | null = null;

      for (const request of patchRequests) {
        response = await fetch(request.url, {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request.body),
        });

        if (response.ok) {
          break;
        }
      }

      if (!response?.ok) {
        throw new Error(copy.submitError);
      }

      setSuccessMessage(copy.successMessage);
      setTimeout(() => {
        resetAndClose();
      }, 1500);
    } catch {
      setSubmitError(copy.submitError);
      setIsSubmitting(false);
    }
  };

  if (schema.length === 0) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.65)]">
          <div className="flex items-center justify-between bg-[#4f49e2] px-6 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Settings2 className="h-4 w-4" />
              </span>
              <p className="text-lg font-semibold">{copy.title}</p>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-6 py-5 text-sm text-[#b91c1c]">
            Configuration schema is not available for this connector:
            <span className="ml-1 font-semibold">{connectorId}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.65)]">
        <div className="flex items-center justify-between bg-[#4f49e2] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Settings2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-semibold">{copy.title}</p>
              <p className="text-xs text-white/80">{connectorName || connectorId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {isPrefilling ? (
            <div className="space-y-4">
              <div className="animate-pulse rounded-xl border border-[#eef1f7] bg-white p-4">
                <div className="h-4 w-28 rounded bg-[#edf2f9]" />
                <div className="mt-3 h-12 rounded-xl bg-[#edf2f9]" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: Math.max(schema.length, 4) }).map((_, index) => (
                  <div
                    key={`edit-config-skeleton-${index}`}
                    className="animate-pulse rounded-xl border border-[#eef1f7] bg-white p-4"
                  >
                    <div className="h-4 w-24 rounded bg-[#edf2f9]" />
                    <div className="mt-3 h-11 rounded-xl bg-[#edf2f9]" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <label className="block text-sm font-semibold text-[#111827]">
                Name <span className="text-[#dc2626]">*</span>
                <input
                  type="text"
                  value={formState.configName}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      configName: event.target.value,
                    }))
                  }
                  name="connector_config_name"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
                  placeholder="Enter connector name"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                {schema.map((field) => (
                  <label
                    key={field.name}
                    className="text-sm font-semibold text-[#111827]"
                  >
                    {field.label}{" "}
                    {field.required ? (
                      <span className="text-[#dc2626]">*</span>
                    ) : (
                      <span className="text-[#94a3b8]">(Optional)</span>
                    )}
                    <div className="relative mt-2">
                      {field.secret ? (
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                      ) : null}
                      <input
                        type={field.secret ? "password" : "text"}
                        value={formState.fieldsState[field.name] ?? ""}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            fieldsState: {
                              ...current.fieldsState,
                              [field.name]: event.target.value,
                            },
                          }))
                        }
                        name={field.name.toLowerCase()}
                        autoComplete={field.secret ? "new-password" : "off"}
                        autoCorrect="off"
                        spellCheck={false}
                        className={`w-full rounded-xl border border-[#e0e5f0] bg-white py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20 ${
                          field.secret ? "px-10" : "px-4"
                        }`}
                        placeholder={field.placeholder || `Enter ${field.label}`}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {prefillError ? (
            <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
              {prefillError}
            </div>
          ) : null}
          {submitError ? (
            <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
              {submitError}
            </div>
          ) : null}
          {successMessage ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-[#22c55e]"
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
                <p className="font-medium">
                  {mode === "edit" ? "Connector config updated" : "Connector config saved"}
                </p>
                <p className="mt-0.5 text-[#15803d]">
                  {successMessage} Closing in a moment...
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitConfig}
            disabled={!isSubmitEnabled || Boolean(successMessage)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] ${
              !isSubmitEnabled || Boolean(successMessage)
                ? "cursor-not-allowed bg-[#c7c4f7]"
                : "bg-[#4f49e2] hover:bg-[#4338ca]"
            }`}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
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
                {copy.pendingAction}
              </span>
            ) : successMessage ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                {copy.successAction}
              </span>
            ) : (
              copy.action
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
