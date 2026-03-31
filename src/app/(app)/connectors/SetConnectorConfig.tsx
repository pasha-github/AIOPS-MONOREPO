"use client";

import { Lock, Settings2, X } from "lucide-react";
import { useMemo, useState } from "react";

type SetConnectorConfigProps = {
  isOpen: boolean;
  connectorId: string | null;
  connectorName: string | null;
  connectorsApiBase: string;
  onClose: () => void;
};

type ConfigField = {
  name: string;
  label: string;
  required: boolean;
  secret?: boolean;
  placeholder?: string;
};

const CONNECTOR_CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
  datadog_connector: [
    {
      name: "DD_API_KEY",
      label: "DD API Key",
      required: true,
      secret: true,
      placeholder: "Enter DD API key",
    },
    {
      name: "DD_APP_KEY",
      label: "DD App Key",
      required: true,
      secret: true,
      placeholder: "Enter DD App key",
    },
    {
      name: "DD_SITE",
      label: "DD Site",
      required: false,
      placeholder: "https://api.us5.datadoghq.com",
    },
    {
      name: "prefix",
      label: "Prefix",
      required: false,
      placeholder: "Enter prefix",
    },
  ],
  servicenow_connector: [
    {
      name: "SERVICENOW_INSTANCE_URL",
      label: "ServiceNow Instance URL",
      required: true,
      placeholder: "Enter instance URL",
    },
    {
      name: "SERVICENOW_USERNAME",
      label: "ServiceNow Username",
      required: true,
      placeholder: "Enter username",
    },
    {
      name: "SERVICENOW_PASSWORD",
      label: "ServiceNow Password",
      required: true,
      secret: true,
      placeholder: "Enter password",
    },
    {
      name: "SERVICENOW_AUTH_TYPE",
      label: "ServiceNow Auth Type",
      required: false,
      placeholder: "Enter auth type",
    },
    {
      name: "prefix",
      label: "Prefix",
      required: false,
      placeholder: "Servicenow",
    },
  ],
  ibm_mq_connector: [
    {
      name: "URL_BASE",
      label: "URL Base",
      required: true,
      placeholder: "Enter base URL",
    },
    {
      name: "USER_NAME",
      label: "User Name",
      required: true,
      placeholder: "Enter username",
    },
    {
      name: "PASSWORD",
      label: "Password",
      required: true,
      secret: true,
      placeholder: "Enter password",
    },
    {
      name: "LOGS_URL",
      label: "Logs URL",
      required: true,
      placeholder: "Enter logs URL",
    },
    {
      name: "SSH_URL",
      label: "SSH URL",
      required: true,
      placeholder: "Enter SSH URL",
    },
    {
      name: "VERIFY_TLS",
      label: "Verify TLS",
      required: false,
      placeholder: "true or false",
    },
    {
      name: "prefix",
      label: "Prefix",
      required: false,
      placeholder: "IBM MQ",
    },
  ],
};

const getDefaultFieldsState = (fields: ConfigField[]) => {
  const entries = fields.map((field) => [field.name, ""] as const);
  return Object.fromEntries(entries) as Record<string, string>;
};

export default function SetConnectorConfig({
  isOpen,
  connectorId,
  connectorName,
  connectorsApiBase,
  onClose,
}: SetConnectorConfigProps) {
  const schema = useMemo(() => {
    if (!connectorId) {
      return [];
    }
    return CONNECTOR_CONFIG_SCHEMAS[connectorId] ?? [];
  }, [connectorId]);

  const [configName, setConfigName] = useState("");
  const [fieldsState, setFieldsState] = useState<Record<string, string>>(() =>
    getDefaultFieldsState(schema)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (!isOpen || !connectorId) {
    return null;
  }

  const resetAndClose = () => {
    setConfigName("");
    setFieldsState(getDefaultFieldsState(schema));
    setSubmitError("");
    setIsSubmitting(false);
    onClose();
  };

  const isFormValid = (() => {
    if (!configName.trim()) {
      return false;
    }
    return schema.every((field) =>
      field.required ? Boolean(fieldsState[field.name]?.trim()) : true
    );
  })();

  const submitConfig = async () => {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const endpoint = `${connectorsApiBase}/connectors/${encodeURIComponent(
        connectorId
      )}/config`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connector_id: connectorId,
          name: configName.trim(),
          config: schema.map((field) => ({
            name: field.name,
            value: fieldsState[field.name] ?? "",
          })),
        }),
      });

      if (!response.ok) {
        setSubmitError("Unable to set connector config.");
        setIsSubmitting(false);
        return;
      }

      resetAndClose();
    } catch {
      setSubmitError("Unable to set connector config.");
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
              <p className="text-lg font-semibold">Set Config</p>
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
              <p className="text-lg font-semibold">Set Config</p>
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
          <label className="block text-sm font-semibold text-[#111827]">
            Name <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={configName}
              onChange={(event) => setConfigName(event.target.value)}
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
              <label key={field.name} className="text-sm font-semibold text-[#111827]">
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
                    value={fieldsState[field.name] ?? ""}
                    onChange={(event) =>
                      setFieldsState((prev) => ({
                        ...prev,
                        [field.name]: event.target.value,
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

          {submitError ? (
            <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
              {submitError}
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
            disabled={isSubmitting || !isFormValid}
            className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] ${
              isSubmitting || !isFormValid
                ? "cursor-not-allowed bg-[#c7c4f7]"
                : "bg-[#4f49e2] hover:bg-[#4338ca]"
            }`}
          >
            {isSubmitting ? "Setting..." : "Set"}
          </button>
        </div>
      </div>
    </div>
  );
}
