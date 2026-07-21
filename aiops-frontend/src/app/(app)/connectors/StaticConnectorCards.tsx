"use client";

import ComingSoon from "@/components/comingsoon";
import { Link2 } from "lucide-react";

type StaticConnectorCardsProps = {
  connectors?: StaticConnector[];
};

export type StaticConnector = {
  id: string;
  name: string;
  logoSrc: string;
};

export const STATIC_CONNECTORS: StaticConnector[] = [

  {
    id: "Oracle-Integration-Cloud",
    name: "Oracle Integration Cloud",
    logoSrc: "/img/Oracle-Integration-Cloud.png",
  },
  {
    id: "Apache-Nifi",
    name: "Apache Nifi",
    logoSrc: "/img/Apache-NiFi.png",
  },
  {
    id: "Oracle-Data-Integrator",
    name: "Oracle Data Integrator",
    logoSrc: "/img/Oracle-Data-Integrator.png",
  },
  {
    id: "Oracle-Universal-Content-Management",
    name: "Oracle Universal-Content Management",
    logoSrc: "/img/Oracle-Universal-Content-Management.png",
  },
  {
    id: "elasticsearch_static",
    name: "Elastic Search",
    logoSrc: "/img/elasticsearch.jpeg",
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
  {
    id: "Apache-Kafka",
    name: "Apache Kafka",
    logoSrc: "/img/apache-kafka.png",
  },
  
];

export function filterStaticConnectors(searchTerm?: string) {
  const normalizedSearch = (searchTerm ?? "").trim().toLowerCase();
  return normalizedSearch
    ? STATIC_CONNECTORS.filter((connector) =>
        connector.name.toLowerCase().includes(normalizedSearch)
      )
    : STATIC_CONNECTORS;
}

export default function StaticConnectorCards({
  connectors = STATIC_CONNECTORS,
}: StaticConnectorCardsProps) {
  return (
    <>
      {connectors.map((connector) => (
        <div
          key={connector.id}
          className="relative rounded-2xl bg-white px-5 py-6 shadow-[0_12px_30px_-24px_rgba(16,24,40,0.22)] ring-1 ring-[#eef1f7] transition-all duration-200 hover:shadow-[0_20px_34px_-24px_rgba(79,73,226,0.28)] hover:ring-[#d7defe]"
        >
          <ComingSoon />
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]">
                  <Link2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[22px] font-semibold text-[#111827]">
                    {connector.name}
                  </p>
                </div>
              </div>
            </div>
            <img
              src={connector.logoSrc}
              alt={`${connector.name} logo`}
              className="h-12 w-24 object-contain"
              loading="lazy"
            />
          </div>
        </div>
      ))}

    </>
  );
}
