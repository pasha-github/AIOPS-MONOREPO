"use client";

import { Link2, Pencil, Plug, Trash2, X } from "lucide-react";
import { useState } from "react";
import { type ConnectorItem } from "./staticData";

const providerLogoMap: Record<string, string> = {
  ServiceNow: "/img/ServiceNow.png",
  Mule: "/img/Mule.png",
  Teams:
    "data:image/png;base64,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",
  MQ: "/img/MQ.png",
  SAP: "/img/SAP.png",
  SalesForce: "/img/SalesForce.png",
  "MainFrame 400": "/img/MainFrame 400.png",
  Jira: "/img/Jira.jfif",
  Slack: "/img/Slack.png",
  Zoom: "/img/Zoom.png",
  Zendesk: "/img/Zendesk.png",
  Exchange: "/img/Exchange.png",
  Gmail: "/img/Gmail.png",
};

const formatDateTime = (value: string) => {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return { date: "--", time: "--" };
  }
  return {
    date: date.toLocaleDateString("en-US"),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

type DisplayConnectorsProps = {
  connectors: ConnectorItem[];
  searchTerm?: string;
  onDeleteConnector?: (connectorId: number) => void;
};

export default function DisplayConnectors({
  connectors,
  searchTerm,
  onDeleteConnector,
}: DisplayConnectorsProps) {
  const [deleteTarget, setDeleteTarget] = useState<ConnectorItem | null>(null);

  if (connectors.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-[#e6eaf3] bg-white px-6 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
          <Link2 className="h-6 w-6" />
        </div>
        <p className="mt-4 text-base font-semibold text-[#111827]">
          No connectors yet
        </p>
        <p className="mt-2 text-sm text-[#6b7280]">
          Add a connector to start integrating your systems.
        </p>
      </div>
    );
  }

  const normalizedSearch = (searchTerm ?? "").trim().toLowerCase();
  const visibleConnectors = normalizedSearch
    ? connectors.filter((connector) => {
        const provider = connector.provider_code?.toLowerCase() ?? "";
        const type = connector.connector_type?.toLowerCase() ?? "";
        return provider.includes(normalizedSearch) || type.includes(normalizedSearch);
      })
    : connectors;

  if (visibleConnectors.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-[#e6eaf3] bg-white px-6 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
          <Link2 className="h-6 w-6" />
        </div>
        <p className="mt-4 text-base font-semibold text-[#111827]">
          No connectors found
        </p>
        <p className="mt-2 text-sm text-[#6b7280]">
          Try a different search term.
        </p>
      </div>
    );
  }

  const showAddCard = visibleConnectors.length < 3;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      {visibleConnectors.map((connector) => {
        const isActive = String(connector.is_active).toUpperCase() === "Y";
        const created = formatDateTime(connector.created_at);
        const updated = formatDateTime(connector.updated_at);
        const logoSrc = providerLogoMap[connector.provider_code] ?? "";
        const activeClass = isActive
          ? "bg-[#158a00] text-white"
          : "bg-[#e8f5e1] text-[#158a00] border border-[#cfe9c1]";
        const inactiveClass = isActive
          ? "bg-[#f3f4f6] text-[#9ca3af] border border-[#e5e7eb]"
          : "bg-[#ff2d2d] text-white";
        return (
          <div
            key={connector.id}
            className="rounded-2xl bg-white p-5 shadow-[0_12px_30px_-24px_rgba(16,24,40,0.35)] ring-1 ring-[#eef1f7]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]">
                    <Plug className="h-4 w-4" />
                  </span>
                  <p className="text-xl font-semibold text-[#111827]">
                    {connector.provider_code}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-5 text-[#6b7280]">
                  Created: {created.date} {created.time}
                </p>
                <p className="mt-1.5 text-sm leading-5 text-[#6b7280]">
                  Updated: {updated.date} {updated.time}
                </p>
              </div>
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={`${connector.provider_code} logo`}
                  className="h-12 w-24 object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="h-10 w-16" aria-hidden="true" />
              )}
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex flex-1 items-center gap-3">
                <span
                  className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${activeClass}`}
                >
                  Active
                </span>
                <span
                  className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${inactiveClass}`}
                >
                  Inactive
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#cbd2ff] text-[#4f49e2] transition hover:bg-[#eef2ff]"
                  aria-label={`Edit ${connector.provider_code} connector`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(connector)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#fecaca] text-[#ef4444] transition hover:bg-[#fee2e2]"
                  aria-label={`Delete ${connector.provider_code} connector`}
                  title="Delete connector"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {showAddCard ? (
        <button
          type="button"
          className="rounded-2xl border border-dashed border-[#d6dcea] bg-[#f8fafc] p-6 text-center text-sm text-[#6b7280] transition hover:border-[#c7d2fe] hover:bg-[#f3f6ff]"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
            <Link2 className="h-5 w-5" />
          </div>
          <p className="mt-4 text-base font-semibold text-[#111827]">
            Add another connector
          </p>
          <p className="mt-1 text-sm text-[#6b7280]">
            Connect more systems to expand coverage.
          </p>
        </button>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#fee2e2] bg-[#fff5f5] px-6 py-4">
              <div className="flex items-center gap-2 text-[#b91c1c]">
                <Trash2 className="h-5 w-5" />
                <h4 className="text-lg font-semibold">Delete Connector</h4>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b91c1c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#374151]">
                Are you sure you want to delete{" "}
                <span className="rounded-md bg-[#fee2e2] px-2 py-0.5 font-semibold text-[#b91c1c]">
                  {deleteTarget.provider_code}
                </span>
                ?
              </p>
              <p className="mt-3 text-xs text-[#9b1c1c]">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!deleteTarget) {
                    return;
                  }
                  onDeleteConnector?.(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-xl bg-[#ef4444] px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] hover:bg-[#dc2626]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
