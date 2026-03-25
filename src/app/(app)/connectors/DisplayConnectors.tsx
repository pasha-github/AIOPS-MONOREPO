"use client";

import { ChevronRight, Eye, Link2, Plug, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import SetConnectorConfig from "./SetConnectorConfig";
import ShowConnectorConfig from "./ShowConnectorConfig";
import ViewConnector from "./ViewConnector";

type ConnectorItem = {
  id: string;
  name: string;
};

type DisplayConnectorsProps = {
  searchTerm?: string;
};

const getLogoSrc = (connectorId: string) =>
  `/img/${connectorId.toLowerCase()}.png`;

export default function DisplayConnectors({ searchTerm }: DisplayConnectorsProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorItem | null>(
    null
  );
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSetConfigOpen, setIsSetConfigOpen] = useState(false);
  const [isShowConfigOpen, setIsShowConfigOpen] = useState(false);
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

    loadConnectors().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setLoadError("Unable to load connectors.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [connectorsUrl]);

  if (isLoading && connectors.length === 0) {
    return (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`connector-skeleton-${index}`}
            className="animate-pulse rounded-2xl bg-white p-5 shadow-[0_12px_30px_-24px_rgba(16,24,40,0.35)] ring-1 ring-[#eef1f7]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-1 items-center gap-3">
                <span className="h-8 w-8 rounded-full bg-[#edf2f9]" />
                <span className="h-6 w-40 rounded bg-[#edf2f9]" />
              </div>
              <span className="h-12 w-24 rounded bg-[#edf2f9]" />
            </div>
            <div className="mt-6 flex justify-end">
              <span className="h-9 w-28 rounded-lg bg-[#edf2f9]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <>
        <div className="mt-6 rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-8 text-sm text-[#b91c1c]">
          {loadError}
        </div>
        <ViewConnector
          isOpen={isViewOpen}
          connectorId={selectedConnector?.id ?? null}
          connectorName={selectedConnector?.name ?? null}
          connectorsApiBase={connectorsApiBase}
          onClose={() => setIsViewOpen(false)}
        />
        <SetConnectorConfig
          isOpen={isSetConfigOpen}
          connectorId={selectedConnector?.id ?? null}
          connectorName={selectedConnector?.name ?? null}
          connectorsApiBase={connectorsApiBase}
          onClose={() => setIsSetConfigOpen(false)}
        />
        <ShowConnectorConfig
          isOpen={isShowConfigOpen}
          connectorId={selectedConnector?.id ?? null}
          connectorName={selectedConnector?.name ?? null}
          connectorsApiBase={connectorsApiBase}
          onClose={() => setIsShowConfigOpen(false)}
        />
      </>
    );
  }

  const normalizedSearch = (searchTerm ?? "").trim().toLowerCase();
  const visibleConnectors = normalizedSearch
    ? connectors.filter((connector) => {
        const id = connector.id.toLowerCase();
        const name = connector.name.toLowerCase();
        return id.includes(normalizedSearch) || name.includes(normalizedSearch);
      })
    : connectors;
  const showCardShimmer = isLoading && connectors.length > 0;

  if (visibleConnectors.length === 0) {
    return (
      <>
        <div className="mt-6 rounded-2xl border border-[#e6eaf3] bg-white px-6 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
            <Link2 className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-[#111827]">
            No connectors found
          </p>
        </div>
        <ViewConnector
          isOpen={isViewOpen}
          connectorId={selectedConnector?.id ?? null}
          connectorName={selectedConnector?.name ?? null}
          connectorsApiBase={connectorsApiBase}
          onClose={() => setIsViewOpen(false)}
        />
        <SetConnectorConfig
          isOpen={isSetConfigOpen}
          connectorId={selectedConnector?.id ?? null}
          connectorName={selectedConnector?.name ?? null}
          connectorsApiBase={connectorsApiBase}
          onClose={() => setIsSetConfigOpen(false)}
        />
        <ShowConnectorConfig
          isOpen={isShowConfigOpen}
          connectorId={selectedConnector?.id ?? null}
          connectorName={selectedConnector?.name ?? null}
          connectorsApiBase={connectorsApiBase}
          onClose={() => setIsShowConfigOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {visibleConnectors.map((connector) => (
          (() => {
            const isSelected = selectedConnector?.id === connector.id;
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
              <img
                src={getLogoSrc(connector.id)}
                alt={`${connector.name} logo`}
                className="h-12 w-24 object-contain"
                loading="lazy"
              />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedConnector(connector);
                  setIsSetConfigOpen(true);
                }}
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
                onClick={() => {
                  setSelectedConnector(connector);
                  setIsShowConfigOpen(true);
                }}
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
                onClick={() => {
                  setSelectedConnector(connector);
                  setIsViewOpen(true);
                }}
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
          })()
        ))}
      </div>
      <ViewConnector
        isOpen={isViewOpen}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={() => setIsViewOpen(false)}
      />
      <SetConnectorConfig
        key={`set-config-${selectedConnector?.id ?? "none"}`}
        isOpen={isSetConfigOpen}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={() => setIsSetConfigOpen(false)}
      />
      <ShowConnectorConfig
        key={`show-config-${selectedConnector?.id ?? "none"}`}
        isOpen={isShowConfigOpen}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={() => setIsShowConfigOpen(false)}
      />
    </>
  );
}
