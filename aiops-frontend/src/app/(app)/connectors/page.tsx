"use client";

import Searchbar from "@/components/Searchbar";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { ThemedSingleDropdown } from "../agent-management/DynamicConnector";
import DisplayConnectors from "./DisplayConnectors";
import SetConnectorConfig from "./SetConnectorConfig";
import ShowConnectorConfig from "./ShowConnectorConfig";
import ViewConnector from "./ViewConnector";

export type ConnectorAction = "set" | "show" | "view";
export type ConnectorCategory = "enterprise" | "helper";
export type ConnectorFilter = "all" | ConnectorCategory;
export type ConnectorItem = {
  id: string;
  name: string;
  category?: string | null;
};

const CONNECTOR_FILTER_OPTIONS: Array<{
  value: ConnectorFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "enterprise", label: "Enterprise" },
  { value: "helper", label: "Helper" },
];

export default function ConnectorsPage() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const [searchValue, setSearchValue] = useState("");
  const [connectorFilter, setConnectorFilter] = useState<ConnectorFilter>("all");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorItem | null>(null);
  const [activeModal, setActiveModal] = useState<ConnectorAction | null>(null);
  const connectorsApiBase = trimTrailingSlash(llmManagerApiBaseUrl);

  const closeConnectorModal = () => {
    setActiveModal(null);
  };

  return (
    <section className="min-h-[calc(100vh-160px)] rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-2xl font-semibold text-[#10131a]">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
            <Link2 className="h-5 w-5" />
          </span>
          Connectors
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-[#344054]">
              Connector Type
            </p>
            <div className="w-[110px]">
            <ThemedSingleDropdown
              value={connectorFilter}
              options={CONNECTOR_FILTER_OPTIONS}
              placeholder="All"
              includePlaceholderOption={false}
              onChange={(value) =>
                setConnectorFilter((value as ConnectorFilter) || "all")
              }
            />
            </div>
          </div>
          <Searchbar
            value={searchValue}
            onChange={setSearchValue}
            name="connector_search"
            placeholder="Search connectors.."
          />
        </div>
      </div>

      <DisplayConnectors
        searchTerm={searchValue}
        connectorFilter={connectorFilter}
        selectedConnectorId={selectedConnector?.id ?? null}
        onSelectedConnectorChange={setSelectedConnector}
        onOpenConnectorAction={(connector, action) => {
          setSelectedConnector(connector);
          setActiveModal(action);
        }}
      />
      <ViewConnector
        isOpen={activeModal === "view"}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={closeConnectorModal}
      />
      <SetConnectorConfig
        key={`set-config-${selectedConnector?.id ?? "none"}`}
        isOpen={activeModal === "set"}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={closeConnectorModal}
      />
      <ShowConnectorConfig
        key={`show-config-${selectedConnector?.id ?? "none"}`}
        isOpen={activeModal === "show"}
        connectorId={selectedConnector?.id ?? null}
        connectorName={selectedConnector?.name ?? null}
        connectorsApiBase={connectorsApiBase}
        onClose={closeConnectorModal}
      />
    </section>
  );
}
