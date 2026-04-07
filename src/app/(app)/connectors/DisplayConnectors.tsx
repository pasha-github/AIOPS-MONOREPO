"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Link2,
  Pencil,
  Plug,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import SetConnectorConfig from "./SetConnectorConfig";
import ShowConnectorConfig from "./ShowConnectorConfig";
import ViewConnector from "./ViewConnector";

type ConnectorItem = {
  id: string;
  name: string;
};

type ConnectorConfigRecord = {
  created_at: string;
  connector_config_id: string;
  updated_at: string;
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

type DisplayConnectorsProps = {
  searchTerm?: string;
};

type ModalType = "view" | "set" | "edit" | "show" | null;

const CONNECTOR_LOGO_MAP: Record<string, string> = {
  datadog_connector: "/img/datadog_connector.png",
  servicenow_connector: "/img/servicenow_connector.png",
  ibm_mq: "/img/MQ.png",
  mq: "/img/MQ.png",
};

const getLogoSrc = (connectorId: string) =>
  CONNECTOR_LOGO_MAP[connectorId.toLowerCase()] ??
  `/img/${connectorId.toLowerCase()}.png`;

const getLatestConfigRecord = (records: ConnectorConfigRecord[]) =>
  [...records].sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at).getTime();
    const rightTime = new Date(right.updated_at || right.created_at).getTime();
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  })[0] ?? null;

const ConnectorCardSkeleton = ({ index }: { index: number }) => (
  <div
    key={`connector-skeleton-${index}`}
    className="animate-pulse rounded-2xl bg-white p-5 shadow-[0_12px_30px_-24px_rgba(16,24,40,0.35)] ring-1 ring-[#eef1f7]"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-1 items-center gap-3">
        <span className="h-8 w-8 rounded-full bg-[#edf2f9]" />
        <span className="h-6 w-40 rounded bg-[#edf2f9]" />
      </div>
      <span className="h-10 w-10 rounded-xl bg-[#edf2f9]" />
    </div>
    <div className="mt-5 flex justify-end">
      <span className="h-12 w-24 rounded bg-[#edf2f9]" />
    </div>
    <div className="mt-6 flex justify-end">
      <span className="h-9 w-28 rounded-lg bg-[#edf2f9]" />
    </div>
  </div>
);

export default function DisplayConnectors({ searchTerm }: DisplayConnectorsProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorItem | null>(
    null
  );
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConnectorItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const connectorsApiBase = trimTrailingSlash(llmManagerApiBaseUrl);

  const connectorsUrl = useMemo(
    () => `${connectorsApiBase}/connectors/`,
    [connectorsApiBase]
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadConnectors = async () => {
      setIsLoading(true);
      setLoadError("");
      const response = await fetch(connectorsUrl, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const data = (await response.json()) as ConnectorItem[];
      setConnectors(data);
      setIsLoading(false);
    };
 console.log("data", connectors);
    loadConnectors().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setLoadError("Unable to load connectors.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [connectorsUrl]);

  useEffect(() => {
    if (!openActionMenuId) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setOpenActionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openActionMenuId]);

  const normalizedSearch = (searchTerm ?? "").trim().toLowerCase();
  const visibleConnectors = normalizedSearch
    ? connectors.filter((connector) => {
        const id = connector.id.toLowerCase();
        const name = connector.name.toLowerCase();
        return id.includes(normalizedSearch) || name.includes(normalizedSearch);
      })
    : connectors;
  const showCardShimmer = isLoading && connectors.length > 0;

  const openConnectorModal = (
    connector: ConnectorItem,
    modal: Exclude<ModalType, null>
  ) => {
    setSelectedConnector(connector);
    setOpenActionMenuId(null);
    setActiveModal(modal);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const configListResponse = await fetch(
        `${connectorsApiBase}/connectors/${encodeURIComponent(deleteTarget.id)}/config`,
        {
          method: "GET",
          headers: { accept: "application/json" },
        }
      );

      if (!configListResponse.ok) {
        throw new Error("Unable to load connector config.");
      }

      const configRecords = (await configListResponse.json()) as ConnectorConfigRecord[];
      const latestRecord = getLatestConfigRecord(configRecords);

      if (!latestRecord?.connector_config_id) {
        setDeleteError("No saved config was found for this connector.");
        setIsDeleting(false);
        return;
      }

      const deleteResponse = await fetch(
        `${connectorsApiBase}/connectors/${encodeURIComponent(
          deleteTarget.id
        )}/config/${encodeURIComponent(latestRecord.connector_config_id)}`,
        {
          method: "DELETE",
          headers: { accept: "application/json" },
        }
      );

      if (!deleteResponse.ok) {
        let errorPayload: unknown = null;
        try {
          errorPayload = await deleteResponse.json();
        } catch {
          errorPayload = null;
        }
        throw new Error(
          getErrorDetail(errorPayload, "Unable to delete connector config.")
        );
      }

      setDeleteTarget(null);
      setDeleteError("");
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Unable to delete connector config."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const connectorModals = (
    <>
      <ViewConnector
        isOpen={activeModal === "view"}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={() => setActiveModal(null)}
      />
      <SetConnectorConfig
        key={`set-config-${selectedConnector?.id ?? "none"}`}
        isOpen={activeModal === "set"}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={() => setActiveModal(null)}
      />
      <SetConnectorConfig
        key={`edit-config-${selectedConnector?.id ?? "none"}`}
        isOpen={activeModal === "edit"}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        mode="edit"
        onClose={() => setActiveModal(null)}
      />
      <ShowConnectorConfig
        key={`show-config-${selectedConnector?.id ?? "none"}`}
        isOpen={activeModal === "show"}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={() => setActiveModal(null)}
      />
    </>
  );

  let content: ReactElement;

  if (isLoading && connectors.length === 0) {
    content = (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <ConnectorCardSkeleton key={index} index={index} />
        ))}
      </div>
    );
  } else if (loadError) {
    content = (
      <div className="mt-6 rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-8 text-sm text-[#b91c1c]">
        {loadError}
      </div>
    );
  } else if (visibleConnectors.length === 0) {
    content = (
      <div className="mt-6 rounded-2xl border border-[#e6eaf3] bg-white px-6 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
          <Link2 className="h-6 w-6" />
        </div>
        <p className="mt-4 text-base font-semibold text-[#111827]">
          No connectors found
        </p>
      </div>
    );
  } else {
    content = (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {visibleConnectors.map((connector) => {
          const isSelected = selectedConnector?.id === connector.id;
          const isMenuOpen = openActionMenuId === connector.id;

          return (
            <div
              key={connector.id}
              className={`relative rounded-2xl bg-white p-5 transition-all duration-200 ${
                isSelected
                  ? "shadow-[0_22px_40px_-28px_rgba(79,73,226,0.65)] ring-2 ring-[#cbd2ff]"
                  : "shadow-[0_12px_30px_-24px_rgba(16,24,40,0.35)] ring-1 ring-[#eef1f7] hover:shadow-[0_20px_34px_-24px_rgba(79,73,226,0.45)] hover:ring-[#d7defe]"
              }`}
            >
              {showCardShimmer ? (
                <div className="pointer-events-none absolute inset-0 animate-pulse bg-[#ffffff]/70" />
              ) : null}

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]">
                      <Plug className="h-4 w-4" />
                    </span>
                    <p className="text-xl font-semibold text-[#111827]">
                      {connector.name}
                    </p>
                  </div>
                </div>

                <div ref={isMenuOpen ? actionMenuRef : null} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenActionMenuId((current) =>
                        current === connector.id ? null : connector.id
                      )
                    }
                    disabled={showCardShimmer}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8e1f0] text-[#475569] transition hover:bg-[#eef2ff] hover:text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Open actions for ${connector.name}`}
                    title={`Open actions for ${connector.name}`}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isMenuOpen ? (
                    <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)]">
                      <button
                        type="button"
                        onClick={() => openConnectorModal(connector, "edit")}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#2563eb] hover:bg-[#eff6ff]"
                      >
                        <Pencil className="h-4 w-4" />
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(connector);
                          setDeleteError("");
                          setOpenActionMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#b91c1c] hover:bg-[#fff1f2]"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="my-4 flex justify-end">
                <img
                  src={getLogoSrc(connector.id)}
                  alt={`${connector.name} logo`}
                  className="h-12 w-24 object-contain"
                  loading="lazy"
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => openConnectorModal(connector, "set")}
                  disabled={showCardShimmer}
                  className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#4f49e2] px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_-14px_rgba(79,73,226,0.85)] transition-all duration-150 hover:bg-[#3f39d6] active:translate-y-px active:scale-[0.97] active:shadow-none"
                  aria-label={`Set config for ${connector.name}`}
                  title={`Set config for ${connector.name}`}
                >
                  <Settings2 className="h-4 w-4" />
                  Set Config
                </button>
                <button
                  type="button"
                  onClick={() => openConnectorModal(connector, "show")}
                  disabled={showCardShimmer}
                  className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#cbd2ff] px-3 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_6px_16px_-12px_rgba(79,73,226,0.8)] transition-all duration-150 hover:bg-[#eef2ff] active:translate-y-px active:scale-[0.97] active:shadow-none"
                  aria-label={`Show config for ${connector.name}`}
                  title={`Show config for ${connector.name}`}
                >
                  <Eye className="h-4 w-4" />
                  Show Config
                </button>
                <button
                  type="button"
                  onClick={() => openConnectorModal(connector, "view")}
                  disabled={showCardShimmer}
                  className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#cbd2ff] px-3 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_6px_16px_-12px_rgba(79,73,226,0.8)] transition-all duration-150 hover:bg-[#eef2ff] active:translate-y-px active:scale-[0.97] active:shadow-none"
                  aria-label={`View details about ${connector.name}`}
                  title={`View details about ${connector.name}`}
                >
                  View Details
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {content}
      {connectorModals}
      {deleteTarget ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#fee2e2] bg-[#fff5f5] px-6 py-4">
              <div className="flex items-center gap-2 text-[#b91c1c]">
                <Trash2 className="h-5 w-5" />
                <h4 className="text-lg font-semibold">Delete Config</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                    setDeleteError("");
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b91c1c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#374151]">
                Delete the current config for{" "}
                <span className="rounded-md bg-[#fee2e2] px-2 py-0.5 font-semibold text-[#b91c1c]">
                  {deleteTarget.name}
                </span>
                ?
              </p>
              <p className="mt-3 text-xs text-[#9b1c1c]">
                This Action can not be undone
              </p>
              {deleteError ? (
                <p className="mt-3 text-sm text-[#dc2626]">{deleteError}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                    setDeleteError("");
                  }
                }}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] ${
                  isDeleting
                    ? "cursor-not-allowed bg-[#fca5a5]"
                    : "bg-[#ef4444] hover:bg-[#dc2626]"
                }`}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
