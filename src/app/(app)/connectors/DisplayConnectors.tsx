"use client";

import ActionMenu, { type ActionMenuItem } from "@/components/ActionMenu";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { EyeIcon, Info, Link2, Minus, Plus, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ConnectorAction,
  ConnectorCategory,
  ConnectorFilter,
  ConnectorItem,
} from "./page";
import StaticConnectorCards, { filterStaticConnectors } from "./StaticConnectorCards";

type DisplayConnectorsProps = {
  searchTerm?: string;
  connectorFilter: ConnectorFilter;
  selectedConnectorId: string | null;
  onSelectedConnectorChange: (connector: ConnectorItem | null) => void;
  onOpenConnectorAction: (
    connector: ConnectorItem,
    action: Exclude<ConnectorAction, never>
  ) => void;
};

const getLogoSrc = (connectorId: string) =>
  `/img/${connectorId.toLowerCase()}.png`;

const FALLBACK_LOGO_SRC = "/file.png";

const SECTION_TITLES: Record<ConnectorCategory, string> = {
  enterprise: "Enterprise Connectors",
  helper: "Helper Connectors",
};

const SECTION_DESCRIPTIONS: Record<ConnectorCategory, string> = {
  enterprise: "Business and platform integrations used across enterprise workflows.",
  helper: "Utility connectors that support runtime helpers and lightweight actions.",
};

const SECTION_LABEL_STYLES: Record<ConnectorCategory, string> = {
  enterprise: "text-[#4f49e2]",
  helper: "text-[#0f766e]",
};

const normalizeConnectorCategory = (
  category?: string | null
): ConnectorCategory => (category?.trim().toLowerCase() === "helper" ? "helper" : "enterprise");

function ConnectorLogo({
  connectorId,
  connectorName,
}: {
  connectorId: string;
  connectorName: string;
}) {
  const [src, setSrc] = useState(() => getLogoSrc(connectorId));

  useEffect(() => {
    setSrc(getLogoSrc(connectorId));
  }, [connectorId]);

  return (
    <img
      src={src}
      alt={`${connectorName} logo`}
      className="h-12 w-24 object-contain"
      loading="lazy"
      onError={() => {
        if (src !== FALLBACK_LOGO_SRC) {
          setSrc(FALLBACK_LOGO_SRC);
        }
      }}
    />
  );
}

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
      <span className="h-12 w-24 rounded bg-[#edf2f9]" />
    </div>
    <div className="mt-6 flex justify-end">
      <span className="h-9 w-28 rounded-lg bg-[#edf2f9]" />
    </div>
  </div>
);

export default function DisplayConnectors({
  searchTerm,
  connectorFilter,
  selectedConnectorId,
  onSelectedConnectorChange,
  onOpenConnectorAction,
}: DisplayConnectorsProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isHelperExpanded, setIsHelperExpanded] = useState(false);
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

  const normalizedSearch = (searchTerm ?? "").trim().toLowerCase();
  const visibleConnectors = normalizedSearch
    ? connectors.filter((connector) => {
        const id = connector.id.toLowerCase();
        const name = connector.name.toLowerCase();
        return id.includes(normalizedSearch) || name.includes(normalizedSearch);
      })
    : connectors;
  const visibleStaticConnectors = filterStaticConnectors(searchTerm);
  const enterpriseConnectors = visibleConnectors.filter(
    (connector) => normalizeConnectorCategory(connector.category) === "enterprise"
  );
  const helperConnectors = visibleConnectors.filter(
    (connector) => normalizeConnectorCategory(connector.category) === "helper"
  );
  const visibleSections =
    connectorFilter === "all"
      ? [
          {
            category: "enterprise" as const,
            connectors: enterpriseConnectors,
            staticConnectors: visibleStaticConnectors,
          },
          {
            category: "helper" as const,
            connectors: helperConnectors,
            staticConnectors: [],
          },
        ]
      : [
          {
            category: connectorFilter,
            connectors:
              connectorFilter === "enterprise"
                ? enterpriseConnectors
                : helperConnectors,
            staticConnectors:
              connectorFilter === "enterprise" ? visibleStaticConnectors : [],
          },
        ];
  const visibleConnectorCount =
    visibleConnectors.length +
    (connectorFilter === "helper" ? 0 : visibleStaticConnectors.length);
  const showCardShimmer = isLoading && connectors.length > 0;
  if (isLoading && connectors.length === 0) {
    return (
      <>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <ConnectorCardSkeleton key={index} index={index} />
        ))}
      </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
      <div className="mt-6 rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-8 text-sm text-[#b91c1c]">
        {loadError}
      </div>
      </>
    );
  }

  if (visibleConnectorCount === 0) {
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
      </>
    );
  }

  return (
    <>
      <div className="mt-6 space-y-4">
        {visibleSections.map(({ category, connectors, staticConnectors }) => {
          if (connectors.length === 0 && staticConnectors.length === 0) {
            return null;
          }

          const isHelperSection = category === "helper";
          const isSectionExpanded = !isHelperSection || isHelperExpanded;
          const ToggleIcon = isHelperExpanded ? Minus : Plus;

          return (
            <section key={category} className="space-y-4">
              <div className="flex items-end justify-between gap-4 border-b border-[#edf2f7] pb-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#111827]">
                    {SECTION_TITLES[category]}
                  </h3>
                  <p className="mt-1 text-sm text-[#667085]">
                    {SECTION_DESCRIPTIONS[category]}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] ${SECTION_LABEL_STYLES[category]}`}
                  >
                    {category === "helper" ? "Helper" : "Enterprise"}
                  </span>
                  {isHelperSection ? (
                    <button
                      type="button"
                      onClick={() => setIsHelperExpanded((current) => !current)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbe4f2] bg-white text-[#0f766e] transition hover:bg-[#f0fdfa]"
                      aria-label={
                        isHelperExpanded
                          ? "Collapse helper connectors"
                          : "Expand helper connectors"
                      }
                    >
                      <ToggleIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {isSectionExpanded ? (
              <div className="grid gap-6 lg:grid-cols-3">
                {connectors.map((connector) => {
          const isSelected = selectedConnectorId === connector.id;
          const connectorActions: ActionMenuItem[] = [
            {
              label: "Set Connection",
              icon: Settings2,
              onClick: () => {
                onSelectedConnectorChange(connector);
                onOpenConnectorAction(connector, "set");
              },
              tone: "text-[#4f49e2]",
              hoverTone: "hover:bg-[#f6f8ff]",
            },
            {
              label: "View Connection",
              icon: EyeIcon,
              onClick: () => {
                onSelectedConnectorChange(connector);
                onOpenConnectorAction(connector, "show");
              },
              tone: "text-[#4f49e2]",
              hoverTone: "hover:bg-[#f6f8ff]",
            },
            {
              label: "View Tool Details",
              icon: Info,
              onClick: () => {
                onSelectedConnectorChange(connector);
                onOpenConnectorAction(connector, "view");
              },
              tone: "text-[#4f49e2]",
              hoverTone: "hover:bg-[#f6f8ff]",
            },
          ];

          return (
            <ActionMenu
              key={connector.id}
              align="left"
              estimatedMenuHeight={132}
              actions={connectorActions}
              renderButton={({ isOpen, buttonRef, toggle }) => (
                <button
                  ref={buttonRef}
                  type="button"
                  disabled={showCardShimmer}
                  onClick={() => {
                    if (showCardShimmer) {
                      return;
                    }
                    onSelectedConnectorChange(connector);
                    toggle();
                  }}
                  className={`group relative w-full rounded-2xl bg-white px-5 py-6 text-left transition-all duration-300 ${
                    isSelected || isOpen
                      ? "shadow-[0_20px_36px_-28px_rgba(79,73,226,0.65)] ring-2 ring-[#cbd2ff]"
                      : "shadow-[0_12px_30px_-24px_rgba(16,24,40,0.22)] ring-1 ring-[#eef1f7]"
                  } ${
                    showCardShimmer
                      ? "cursor-default"
                      : "cursor-pointer hover:shadow-[0_20px_34px_-24px_rgba(79,73,226,0.38)] hover:ring-[#d7defe] focus:outline-none focus:ring-2 focus:ring-[#4f49e2] focus:ring-offset-2"
                  }`}
                >
                  {showCardShimmer ? (
                    <div className="pointer-events-none absolute inset-0 animate-pulse bg-[#ffffff]/70" />
                  ) : null}

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]">
                          <Link2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-[22px] font-semibold text-[#111827] transition-all duration-150 group-hover:font-bold">
                            {connector.name}
                          </p>
                        </div>
                      </div>
                    </div>
                    <ConnectorLogo
                      connectorId={connector.id}
                      connectorName={connector.name}
                    />
                  </div>
                </button>
              )}
            />
          );
                })}
                {staticConnectors.length > 0 ? (
                  <StaticConnectorCards connectors={staticConnectors} />
                ) : null}
              </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
