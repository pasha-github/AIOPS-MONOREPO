"use client";

import type { ReactNode } from "react";
import { ChevronRight, Eye, Plug, Settings2 } from "lucide-react";

type StaticConnectorCardsProps = {
  searchTerm?: string;
};

type StaticConnector = {
  id: string;
  name: string;
  logoSrc: string;
};

const renderStaticLogo = (connector: StaticConnector): ReactNode => {
  if (connector.id === "elasticsearch_static") {
    return (
      <div className="flex h-12 w-24 items-center justify-center">
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
          <circle cx="32" cy="18" r="12" fill="#f4d13d" />
          <circle cx="20" cy="30" r="12" fill="#2bb4f3" />
          <circle cx="44" cy="30" r="12" fill="#ef4e8a" />
          <circle cx="25" cy="46" r="12" fill="#1ba9a4" />
          <circle cx="39" cy="46" r="12" fill="#63c74d" />
        </svg>
      </div>
    );
  }

  if (connector.id === "dynatrace_static") {
    return (
      <div className="flex h-12 w-24 items-center justify-center">
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
          <polygon points="16,14 34,14 26,28 8,28" fill="#8dd400" />
          <polygon points="36,14 54,14 54,32 36,32" fill="#8dd400" />
          <polygon points="8,30 26,30 26,48 8,48" fill="#6f2cff" />
          <polygon points="28,30 46,30 38,50 20,50" fill="#3ac7ff" />
          <polygon points="48,30 56,18 56,46 40,50" fill="#8dd400" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={connector.logoSrc}
      alt={`${connector.name} logo`}
      className="h-12 w-24 object-contain"
      loading="lazy"
    />
  );
};

const STATIC_CONNECTORS: StaticConnector[] = [
  {
    id: "elasticsearch_static",
    name: "Elastic Search",
    logoSrc: "/img/elasticsearch.webp",
  },
  {
    id: "ibm_ace_static",
    name: "IBM ACE",
    logoSrc: "/img/ibm_mq_connector.png",
  },
  {
    id: "informatica_static",
    name: "Informatica",
    logoSrc: "/img/Informatica.png",
  },
  {
    id: "dynatrace_static",
    name: "Dynatrace",
    logoSrc: "/img/dynatrace.webp",
  },
  {
    id: "apigee_static",
    name: "Apigee",
    logoSrc: "/img/ApiGee.webp",
  },
  {
    id: "mulesoft_static",
    name: "Mulesoft",
    logoSrc: "/img/Mule.png",
  },
];

export default function StaticConnectorCards({
  searchTerm,
}: StaticConnectorCardsProps) {
  const normalizedSearch = (searchTerm ?? "").trim().toLowerCase();
  const visibleConnectors = normalizedSearch
    ? STATIC_CONNECTORS.filter((connector) =>
        connector.name.toLowerCase().includes(normalizedSearch)
      )
    : STATIC_CONNECTORS;

  return (
    <>
      {visibleConnectors.map((connector) => (
        <div
          key={connector.id}
          className="relative rounded-2xl bg-white p-5 shadow-[0_12px_30px_-24px_rgba(16,24,40,0.35)] ring-1 ring-[#eef1f7] transition-all duration-200 hover:shadow-[0_20px_34px_-24px_rgba(79,73,226,0.45)] hover:ring-[#d7defe]"
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
            {renderStaticLogo(connector)}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#4f49e2] px-3 py-2 text-sm font-semibold text-white opacity-60 shadow-[0_10px_22px_-14px_rgba(79,73,226,0.85)]"
              aria-label={`Set config for ${connector.name}`}
              title="Static connector preview"
            >
              <Settings2 className="h-4 w-4" />
              Set Config
            </button>
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#cbd2ff] px-3 py-2 text-sm font-semibold text-[#4f49e2] opacity-60 shadow-[0_6px_16px_-12px_rgba(79,73,226,0.8)]"
              aria-label={`Show config for ${connector.name}`}
              title="Static connector preview"
            >
              <Eye className="h-4 w-4" />
              Show Config
            </button>
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#cbd2ff] px-3 py-2 text-sm font-semibold text-[#4f49e2] opacity-60 shadow-[0_6px_16px_-12px_rgba(79,73,226,0.8)]"
              aria-label={`View details about ${connector.name}`}
              title="Static connector preview"
            >
              View Details
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

    </>
  );
}
