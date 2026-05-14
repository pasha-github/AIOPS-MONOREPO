"use client";

import { ChevronDown, Plug, X } from "lucide-react";
import { useEffect, useState } from "react";
import { renderMarkdownBlocks } from "../dashboard/logs";
import {
  fetchConnectorDetails,
  type ConnectorDetails,
} from "./connectorSchemas";
type ViewConnectorProps = {
  isOpen: boolean;
  connectorId: string | null;
  connectorName: string | null;
  connectorsApiBase: string;
  onClose: () => void;
};

export default function ViewConnector({
  isOpen,
  connectorId,
  connectorName,
  connectorsApiBase,
  onClose,
}: ViewConnectorProps) {
  const [details, setDetails] = useState<ConnectorDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openDocs, setOpenDocs] = useState(true);
  const [openTools, setOpenTools] = useState(true);
  const [openConfig, setOpenConfig] = useState(true);

  useEffect(() => {
    if (!isOpen || !connectorId) {
      return;
    }

    const controller = new AbortController();
    const loadDetails = async () => {
      setIsLoading(true);
      setLoadError("");
      const payload = await fetchConnectorDetails(
        connectorId,
        connectorsApiBase
      );
      setDetails(payload);
      setIsLoading(false);
    };

    loadDetails().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setLoadError("Unable to load connector details.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [connectorId, connectorsApiBase, isOpen]);

  if (!isOpen || !connectorId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.65)]">
        <div className="flex items-center justify-between bg-[#4f49e2] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Plug className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-semibold">{connectorName}</p>
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
                  key={`view-connector-skeleton-${index}`}
                  className="animate-pulse rounded-xl border border-[#eef1f7] bg-white p-4"
                >
                  <div className="h-5 w-40 rounded bg-[#edf2f9]" />
                  <div className="mt-3 h-4 w-full rounded bg-[#edf2f9]" />
                  <div className="mt-2 h-4 w-4/5 rounded bg-[#edf2f9]" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
              {loadError}
            </div>
          ) : details ? (
            <div className="space-y-4">
              <section className="overflow-hidden rounded-xl border border-[#e7ecf7]">
                <button
                  type="button"
                  onClick={() => setOpenDocs((prev) => !prev)}
                  className="flex w-full items-center justify-between bg-[#f8faff] px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-[#111827]">
                    Documentation
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#4f49e2] transition ${
                      openDocs ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openDocs ? (
                  <div className="bg-white px-4 py-4 text-sm leading-6 text-[#374151] whitespace-pre-line">
                    {renderMarkdownBlocks(details.documentation)}
                  </div>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-xl border border-[#e7ecf7]">
                <button
                  type="button"
                  onClick={() => setOpenTools((prev) => !prev)}
                  className="flex w-full items-center justify-between bg-[#f8faff] px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-[#111827]">Tools</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#4f49e2] transition ${
                      openTools ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openTools ? (
                  <div className="space-y-3 bg-white px-4 py-4">
                    {details.tools.map((tool) => (
                      <div
                        key={tool.name}
                        
                      >
                        <p className="text-sm font-semibold text-[#111827]">
                          {tool.name}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#4b5563]">
                          {tool.documentation}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-xl border border-[#e7ecf7]">
                <button
                  type="button"
                  onClick={() => setOpenConfig((prev) => !prev)}
                  className="flex w-full items-center justify-between bg-[#f8faff] px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-[#111827]">
                    Config Variables
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#4f49e2] transition ${
                      openConfig ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openConfig ? (
                  <div className="divide-y divide-[#eef1f7] bg-white px-4">
                    {details.config_variables.map((variable) => (
                      <div
                        key={variable.name}
                        className="flex items-center justify-between py-3"
                      >
                        <p className="text-sm font-semibold text-[#111827]">
                          {variable.name}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            variable.required
                              ? "bg-[#fee2e2] text-[#b91c1c]"
                              : "bg-[#e5e7eb] text-[#374151]"
                          }`}
                        >
                          {variable.required ? "Required" : "Optional"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
