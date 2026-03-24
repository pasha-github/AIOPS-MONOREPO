"use client";

import { Eye, EyeOff, ListTree, X } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 py-8">
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
                      const hiddenValue = item.value ? "•".repeat(18) : "";
                      return (
                        <div
                          key={itemKey}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                              {item.name}
                            </p>
                            <p className="mt-1 break-all text-sm text-[#111827]">
                              {secret && !isVisible ? hiddenValue : item.value}
                            </p>
                          </div>
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
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
