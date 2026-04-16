"use client";

import { ChevronRight, Eye, Plug, Settings2 } from "lucide-react";

type StaticConnectorCardsProps = {
  searchTerm?: string;
};

type StaticConnector = {
  id: string;
  name: string;
  logoSrc: string;
};

const STATIC_CONNECTORS: StaticConnector[] = [
  {
    id: "elasticsearch_static",
    name: "Elastic Search",
    logoSrc: "/img/elasticsearch.jpeg",
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
    logoSrc: "/img/dynatrace.png",
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
  {
    id: "JVM",
    name: "Java Virtual Machine",
    logoSrc: "/img/JVM.png",
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
            <img
              src={connector.logoSrc}
              alt={`${connector.name} logo`}
              className="h-12 w-24 object-contain"
              loading="lazy"
            />
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
