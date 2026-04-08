"use client";

import { Check, Eye, EyeOff, ListTree, Pencil, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

type ShowConnectorConfigProps = {
  isOpen: boolean;
  connectorId: string | null;
  connectorName: string | null;
  connectorsApiBase: string;
  onClose: () => void;
};

type EditingTarget = {
  recordId: string;
  fieldName: string;
  value: string;
};

const isSecretField = (fieldName: string) => {
  const normalized = fieldName.toUpperCase();
  return (
    normalized.includes("API_KEY") ||
    normalized.includes("APP_KEY") ||
    normalized.includes("PASSWORD") ||
    normalized.includes("SECRET") ||
    normalized.includes("TOKEN")
  );
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getErrorDetail = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof (payload as { detail?: unknown }).detail === "string"
  ) {
    return String((payload as { detail: string }).detail);
  }

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

export default function ShowConnectorConfig({
  isOpen,
  connectorId,
  connectorName,
  connectorsApiBase,
  onClose,
}: ShowConnectorConfigProps) {
  const [records, setRecords] = useState<ConnectorConfigRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  const [savingItemKey, setSavingItemKey] = useState<string | null>(null);
  const [editError, setEditError] = useState("");

  const configUrl = useMemo(() => {
    if (!connectorId) {
      return "";
    }
    return `${connectorsApiBase}/connectors/${encodeURIComponent(connectorId)}/config`;
  }, [connectorId, connectorsApiBase]);

  useEffect(() => {
    if (!isOpen || !connectorId || !configUrl) {
      return;
    }

    const controller = new AbortController();

    const loadConfig = async () => {
      setIsLoading(true);
      setLoadError("");
      setVisibleSecrets({});
      setEditingTarget(null);
      setSavingItemKey(null);
      setEditError("");

      const response = await fetch(configUrl, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const payload = (await response.json()) as ConnectorConfigRecord[];
      setRecords(payload);
      setIsLoading(false);
    };

    loadConfig().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setLoadError("Unable to load connector config.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [configUrl, connectorId, isOpen]);

  if (!isOpen || !connectorId) {
    return null;
  }

  const handleEditStart = (recordId: string, fieldName: string, value: string) => {
    setEditError("");
    setEditingTarget({ recordId, fieldName, value });
  };

  const handleEditCancel = () => {
    setEditingTarget(null);
    setSavingItemKey(null);
    setEditError("");
  };

  const handleEditSave = async (record: ConnectorConfigRecord) => {
    if (
      !connectorId ||
      !editingTarget ||
      editingTarget.recordId !== record.connector_config_id
    ) {
      return;
    }

    const itemKey = `${record.connector_config_id}-${editingTarget.fieldName}`;
    const nextConfig = record.config.map((item) =>
      item.name === editingTarget.fieldName
        ? { ...item, value: editingTarget.value }
        : item
    );
    const collectionEndpoint = `${connectorsApiBase}/connectors/${encodeURIComponent(
      connectorId
    )}/config`;
    const requests = [
      {
        url: `${collectionEndpoint}/${encodeURIComponent(record.connector_config_id)}`,
        body: {
          connector_id: connectorId,
          name: record.name,
          config: nextConfig,
        },
      },
      {
        url: collectionEndpoint,
        body: {
          connector_id: connectorId,
          connector_config_id: record.connector_config_id,
          name: record.name,
          config: nextConfig,
        },
      },
    ];

    setSavingItemKey(itemKey);
    setEditError("");

    try {
      let response: Response | null = null;

      for (const request of requests) {
        response = await fetch(request.url, {
          method: "PATCH",
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
        let errorPayload: unknown = null;
        try {
          errorPayload = await response?.json();
        } catch {
          errorPayload = null;
        }
        throw new Error(
          getErrorDetail(errorPayload, "Unable to update connector config.")
        );
      }

      setRecords((previous) =>
        previous.map((item) =>
          item.connector_config_id === record.connector_config_id
            ? {
                ...item,
                config: nextConfig,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
      setEditingTarget(null);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Unable to update connector config."
      );
    } finally {
      setSavingItemKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.65)]">
        <div className="flex items-center justify-between bg-[#4f49e2] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <ListTree className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-semibold">Show Config</p>
              <p className="text-xs text-white/80">{connectorName || connectorId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`show-config-skeleton-${index}`}
                  className="animate-pulse rounded-xl border border-[#eef1f7] bg-white p-4"
                >
                  <div className="h-5 w-56 rounded bg-[#edf2f9]" />
                  <div className="mt-3 h-4 w-full rounded bg-[#edf2f9]" />
                  <div className="mt-2 h-4 w-5/6 rounded bg-[#edf2f9]" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
              {loadError}
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-[#e6eaf3] bg-white px-6 py-10 text-center">
              <p className="text-base font-semibold text-[#111827]">
                No config records found
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <section
                  key={record.connector_config_id}
                  className="overflow-hidden rounded-xl border border-[#e7ecf7] bg-white"
                >
                  <div className="border-b border-[#eef1f7] bg-[#f8faff] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">
                          {record.name}
                        </p>
                        <p className="mt-1 text-xs text-[#64748b]">
                          Config ID: {record.connector_config_id}
                        </p>
                      </div>
                      <div className="text-right text-xs text-[#64748b]">
                        <p>Created: {formatDateTime(record.created_at)}</p>
                        <p className="mt-1">Updated: {formatDateTime(record.updated_at)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-[#eef1f7] px-4">
                    {record.config.map((item) => {
                      const itemKey = `${record.connector_config_id}-${item.name}`;
                      const secret = isSecretField(item.name);
                      const isVisible = Boolean(visibleSecrets[itemKey]);
                      const isEditing =
                        editingTarget?.recordId === record.connector_config_id &&
                        editingTarget.fieldName === item.name;
                      const isSaving = savingItemKey === itemKey;
                      const hiddenValue = item.value ? "•".repeat(18) : "";

                      return (
                        <div
                          key={itemKey}
                          className="flex items-start justify-between gap-3 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                              {item.name}
                            </p>
                            {isEditing ? (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type={secret ? "password" : "text"}
                                  value={editingTarget.value}
                                  onChange={(event) =>
                                    setEditingTarget((current) =>
                                      current
                                        ? { ...current, value: event.target.value }
                                        : current
                                    )
                                  }
                                  autoFocus
                                  className="min-w-0 flex-1 rounded-lg border border-[#cbd2ff] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleEditSave(record)}
                                  disabled={isSaving}
                                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#bbf7d0] text-[#16a34a] transition hover:bg-[#f0fdf4] disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Save ${item.name}`}
                                  title={`Save ${item.name}`}
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleEditCancel}
                                  disabled={isSaving}
                                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Cancel editing ${item.name}`}
                                  title={`Cancel editing ${item.name}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <p className="mt-1 break-all text-sm text-[#111827]">
                                {secret && !isVisible ? hiddenValue : item.value}
                              </p>
                            )}
                          </div>

                          {!isEditing ? (
                            <div className="flex items-center gap-2">
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleEditStart(
                                      record.connector_config_id,
                                      item.name,
                                      item.value
                                    )
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd2ff] text-[#4f49e2] transition hover:bg-[#eef2ff]"
                                  aria-label={`Edit ${item.name}`}
                                  title={`Edit ${item.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {secret ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleSecrets((prev) => ({
                                        ...prev,
                                        [itemKey]: !prev[itemKey],
                                      }))
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd2ff] text-[#4f49e2] transition hover:bg-[#eef2ff]"
                                    aria-label={`${isVisible ? "Hide" : "Show"} ${item.name}`}
                                    title={`${isVisible ? "Hide" : "Show"} ${item.name}`}
                                  >
                                    {isVisible ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                ) : null}
                              </>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {editError && editingTarget?.recordId === record.connector_config_id ? (
                    <div className="border-t border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
                      {editError}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
