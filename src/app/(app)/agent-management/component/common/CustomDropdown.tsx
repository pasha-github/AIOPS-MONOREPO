"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { inputClass } from "./DynamicConnector";
import { Props } from "../../types";

export function CustomDropdown({
  value,
  options,
  configDataMap,
  placeholder,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  console.log("CustomDropdown Rendered with value:", options);
  console.log("Config Data Map:", configDataMap);
  const selectedLabel = (() => {
    if (!value || value.length === 0) {
      return placeholder || "Select connector";
    }

    const selectedId = value[0];

    for (const o of options) {
      const rowConfig = configDataMap?.[o.value];

      const ids: string[] = rowConfig
        ? Array.isArray(rowConfig)
          ? rowConfig.map((d: any) => d.connector_config_id)
          : rowConfig.connector_config_id
            ? [rowConfig.connector_config_id]
            : []
        : [];

      if (ids.includes(selectedId)) {
        return `${o.label}`;
      }
    }

    return selectedId;
  })();
  //  Get IDs
  const getConfigIds = (connectorId: string): string[] => {
    const rowConfig = configDataMap?.[connectorId];

    if (!rowConfig) return [];

    return Array.isArray(rowConfig)
      ? rowConfig.map((d: any) => d.connector_config_id).filter(Boolean)
      : rowConfig.connector_config_id
        ? [rowConfig.connector_config_id]
        : [];
  };

  return (
    <div className="relative w-full">
      {/* Trigger */}
      <div
        onClick={() => setOpen(!open)}
        className={`${inputClass} flex items-start justify-between cursor-pointer hover:border-indigo-400`}
      >
        <span className="text-sm whitespace-pre-line">
          {selectedLabel}
        </span>

        <ChevronDown size={16} className="mt-1" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-auto">

          {options.map((o) => {
            const configIds = getConfigIds(o.value);
            console.log(`Option: ${o.label}, Config IDs:`, configIds);
            return (
              <div key={o.value} className="border-b">

                {/* 🔹 Connector Name */}
                <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50">
                  {o.label}
                </div>

                {/* 🔹 IDs */}
                {configIds.map((id) => {
                  const rowConfig = configDataMap?.[o.value];

                  let configName = id;

                  if (rowConfig) {
                    const found = Array.isArray(rowConfig)
                      ? rowConfig.find((d: any) => d.connector_config_id === id)
                      : rowConfig.connector_config_id === id
                        ? rowConfig
                        : null;

                    if (found?.name) {
                      configName = found.name;
                    }
                  }

                  return (
                    <div
                      key={id}
                      onClick={() => {
                        onChange([id]);
                        setOpen(false);
                      }}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {/* ✅ SHOW NAME HERE */}
                      <div className="text-sm font-medium leading-tight">
                        {configName}
                      </div>

                      {/* ID below */}
                      <div className="text-xs text-gray-500">
                        Config ID: {id}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}