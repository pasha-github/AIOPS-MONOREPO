"use client";

import { ChevronRight, Link2, Plug } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
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

  if (isLoading) {
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
      <div className="mt-6 rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-8 text-sm text-[#b91c1c]">
        {loadError}
      </div>
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

  if (visibleConnectors.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-[#e6eaf3] bg-white px-6 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
          <Link2 className="h-6 w-6" />
        </div>
        <p className="mt-4 text-base font-semibold text-[#111827]">
          No connectors found
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      {visibleConnectors.map((connector) => (
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
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSelectedConnector(connector);
                setIsViewOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#cbd2ff] px-3 py-2 text-sm font-semibold text-[#4f49e2] transition hover:bg-[#eef2ff]"
              aria-label={`View more about ${connector.name}`}
              title={`View more about ${connector.name}`}
            >
              View more
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <ViewConnector
        isOpen={isViewOpen}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={() => setIsViewOpen(false)}
      />
    </div>
  );
}
