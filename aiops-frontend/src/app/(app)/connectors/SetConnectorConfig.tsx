"use client";

import {
  ModalCard,
  ModalCardBody,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardPanel,
} from "@/components/modalcards";
import { Lock, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ConfigField,
  fetchConnectorSchema,
} from "./connectorSchemas";

type SetConnectorConfigProps = {
  isOpen: boolean;
  connectorId: string | null;
  connectorName: string | null;
  connectorsApiBase: string;
  onClose: () => void;
};

type FormState = {
  configName: string;
  fieldsState: Record<string, string>;
};

const MODAL_COPY = {
  title: "Set Config",
  action: "Set",
  pendingAction: "Setting...",
  successAction: "Saved!",
  successMessage: "Connector config saved successfully!",
  submitError: "Unable to set connector config.",
};

const getDefaultFieldsState = (fields: ConfigField[]) =>
  Object.fromEntries(fields.map((field) => [field.name, ""])) as Record<
    string,
    string
  >;

const buildFormState = (fields: ConfigField[]): FormState => ({
  configName: "",
  fieldsState: getDefaultFieldsState(fields),
});

export default function SetConnectorConfig({
  isOpen,
  connectorId,
  connectorName,
  connectorsApiBase,
  onClose,
}: SetConnectorConfigProps) {
  const [schema, setSchema] = useState<ConfigField[]>([]);
  const [hasLoadedSchema, setHasLoadedSchema] = useState(false);
  const emptyFormState = useMemo(() => buildFormState(schema), [schema]);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const applyFormState = useCallback((nextState: FormState, nextPrefillError = "") => {
    setFormState(nextState);
    setPrefillError(nextPrefillError);
    setSubmitError("");
    setSuccessMessage("");
    setIsSubmitting(false);
    setIsPrefilling(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !connectorId) {
      return;
    }

    const controller = new AbortController();

    const loadSchema = async () => {
      setSubmitError("");
      setPrefillError("");
      setIsSubmitting(false);
      setIsPrefilling(true);
      setSuccessMessage("");
      setHasLoadedSchema(false);

      const nextSchema = await fetchConnectorSchema(
        connectorId,
        connectorsApiBase
      );

      setSchema(nextSchema);
      setHasLoadedSchema(true);
      applyFormState(buildFormState(nextSchema));
    };

    loadSchema().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setSchema([]);
      setHasLoadedSchema(true);
      applyFormState(buildFormState([]), "Unable to load connector schema.");
    });

    return () => controller.abort();
  }, [applyFormState, connectorId, connectorsApiBase, isOpen]);

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

  const isSubmitEnabled = !isSubmitting && !isPrefilling && isFormValid;

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
      const response = await fetch(
        `${connectorsApiBase}/connectors/${encodeURIComponent(connectorId)}/config`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(MODAL_COPY.submitError);
      }

      setSuccessMessage(MODAL_COPY.successMessage);
      setTimeout(() => {
        resetAndClose();
      }, 1500);
    } catch {
      setSubmitError(MODAL_COPY.submitError);
      setIsSubmitting(false);
    }
  };

  if (isPrefilling || !hasLoadedSchema) {
    return (
      <ModalCard>
        <ModalCardPanel maxWidthClassName="max-w-2xl">
          <ModalCardHeader
            title={MODAL_COPY.title}
            subtitle={connectorName || connectorId}
            icon={<Settings2 className="h-4 w-4" />}
            onClose={resetAndClose}
          />

          <ModalCardBody className="space-y-4">
            <div className="space-y-4">
              <div className="animate-pulse rounded-xl border border-[#eef1f7] bg-white p-4">
                <div className="h-4 w-28 rounded bg-[#edf2f9]" />
                <div className="mt-3 h-12 rounded-xl bg-[#edf2f9]" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: Math.max(schema.length, 4) }).map((_, index) => (
                  <div
                    key={`config-schema-loading-${index}`}
                    className="animate-pulse rounded-xl border border-[#eef1f7] bg-white p-4"
                  >
                    <div className="h-4 w-24 rounded bg-[#edf2f9]" />
                    <div className="mt-3 h-11 rounded-xl bg-[#edf2f9]" />
                  </div>
                ))}
              </div>
            </div>
          </ModalCardBody>

          <ModalCardFooter>
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
            >
              Cancel
            </button>
          </ModalCardFooter>
        </ModalCardPanel>
      </ModalCard>
    );
  }

  if (schema.length === 0) {
    return (
      <ModalCard>
        <ModalCardPanel maxWidthClassName="max-w-lg">
          <ModalCardHeader
            title={MODAL_COPY.title}
            icon={<Settings2 className="h-4 w-4" />}
            onClose={resetAndClose}
          />
          <ModalCardBody className="text-sm text-[#b91c1c]">
            Configuration schema is not available for this connector:
            <span className="ml-1 font-semibold">{connectorId}</span>
          </ModalCardBody>
        </ModalCardPanel>
      </ModalCard>
    );
  }

  return (
    <ModalCard>
      <ModalCardPanel maxWidthClassName="max-w-2xl">
        <ModalCardHeader
          title={MODAL_COPY.title}
          subtitle={connectorName || connectorId}
          icon={<Settings2 className="h-4 w-4" />}
          onClose={resetAndClose}
        />

        <ModalCardBody className="space-y-4">
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
                <p className="font-medium">Connector config saved</p>
                <p className="mt-0.5 text-[#15803d]">
                  {successMessage} Closing in a moment...
                </p>
              </div>
            </div>
          ) : null}
        </ModalCardBody>

        <ModalCardFooter>
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
                {MODAL_COPY.pendingAction}
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
                {MODAL_COPY.successAction}
              </span>
            ) : (
              MODAL_COPY.action
            )}
          </button>
        </ModalCardFooter>
      </ModalCardPanel>
    </ModalCard>
  );
}
