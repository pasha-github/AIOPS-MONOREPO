"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getDropdownMenuPosition,
  inputClass,
  type DropdownMenuPosition,
} from "./DynamicConnector";

type OptionItem = {
  label: string;
  value: string;
};

type ConnectorConfigRecord = {
  connector_config_id?: string;
  name?: string;
};

type Props = {
  value: string[];
  options: OptionItem[];
  configDataMap?: Record<string, unknown>;
  placeholder?: string;
  onChange: (val: string[]) => void;
};

const isConnectorConfigRecord = (value: unknown): value is ConnectorConfigRecord => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const getConnectorConfigRecords = (value: unknown): ConnectorConfigRecord[] => {
  if (Array.isArray(value)) {
    return value.filter(isConnectorConfigRecord);
  }

  return isConnectorConfigRecord(value) ? [value] : [];
};

export function CustomDropdown({
  value,
  options,
  configDataMap,
  placeholder,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<DropdownMenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (!containerRef.current) return;
    setMenuPosition(getDropdownMenuPosition(containerRef.current));
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    updateMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const selectedLabel = (() => {
    if (!value || value.length === 0) {
      return placeholder || "Select connector";
    }

    const selectedId = value[0];

    for (const option of options) {
      const rowConfig = configDataMap?.[option.value];
      if (!rowConfig) {
        continue;
      }

      const configs = getConnectorConfigRecords(rowConfig);
      const match = configs.find((item) => item.connector_config_id === selectedId);
      if (match) {
        return match.name || selectedId;
      }
    }

    return selectedId;
  })();

  const getConfigIds = (connectorId: string): string[] => {
    const rowConfig = configDataMap?.[connectorId];

    if (!rowConfig) return [];

    return getConnectorConfigRecords(rowConfig)
      .map((item) => item.connector_config_id)
      .filter((id): id is string => Boolean(id));
  };

  const getConfigName = (connectorId: string, configId: string) => {
    const rowConfig = configDataMap?.[connectorId];

    if (!rowConfig) {
      return configId;
    }

    const found = getConnectorConfigRecords(rowConfig).find(
      (item) => item.connector_config_id === configId
    );

    return found?.name || configId;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => setOpen((current) => !current)}
        className={`${inputClass} flex cursor-pointer items-start justify-between hover:border-indigo-400`}
      >
        <span className="whitespace-pre-line text-sm">{selectedLabel}</span>
        <ChevronDown size={16} className="mt-1" />
      </div>

      {open && menuPosition ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] overflow-auto rounded-lg border bg-white shadow-lg"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
          >
            Select Connector
          </button>

          {options.map((option) => {
            const configIds = getConfigIds(option.value);
            return (
              <div key={option.value} className="border-b last:border-b-0">
                <div className="bg-gray-50 px-3 py-1 text-xs text-gray-500">
                  {option.label}
                </div>

                {configIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange([id]);
                      setOpen(false);
                    }}
                    className="w-full cursor-pointer px-3 py-2 text-left hover:bg-gray-100"
                  >
                    <div className="text-sm font-medium leading-tight text-gray-900">
                      {getConfigName(option.value, id)}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
