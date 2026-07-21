"use client";

import { ChevronDown, Link2, Plus, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import {
  DynamicDropdownField,
  getDropdownMenuPosition,
  inputClass,
  SimpleDropdownField,
  type DropdownMenuPosition,
} from "../DynamicConnector";

type McpOption = {
  id: string;
  name: string;
  serverUrl: string;
  label: string;
};

type CapabilitiesProps = {
  mcpServers: string[];
  mcpOptions: McpOption[];
  isMcpLoading: boolean;
  openMcpDropdownIndex: number | null;
  mcpDropdownRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  connectorConfigIds: string[][];
  connectorOptions: { value: string; label: string }[];
  configDataMap: Record<string, unknown>;
  skillIds: string[];
  skillOptions: { value: string; label: string }[];
  isSkillsLoading: boolean;
  onMcpValueChange: (index: number, value: string) => void;
  onMcpDropdownToggle: (index: number) => void;
  onMcpDropdownClose: () => void;
  onMcpClear: (index: number) => void;
  onMcpSelect: (index: number, option: McpOption) => void;
  onMcpAdd: () => void;
  onMcpRemove: (index: number) => void;
  onConnectorAdd: () => void;
  onConnectorRemove: (index: number) => void;
  onConnectorChange: (index: number, value: string[] | string) => void;
  onSkillAdd: () => void;
  onSkillRemove: (index: number) => void;
  onSkillChange: (index: number, value: string) => void;
};

export default function Capabilities({
  mcpServers,
  mcpOptions,
  isMcpLoading,
  openMcpDropdownIndex,
  mcpDropdownRefs,
  connectorConfigIds,
  connectorOptions,
  configDataMap,
  skillIds,
  skillOptions,
  isSkillsLoading,
  onMcpValueChange,
  onMcpDropdownToggle,
  onMcpDropdownClose,
  onMcpClear,
  onMcpSelect,
  onMcpAdd,
  onMcpRemove,
  onConnectorAdd,
  onConnectorRemove,
  onConnectorChange,
  onSkillAdd,
  onSkillRemove,
  onSkillChange,
}: CapabilitiesProps) {
  const [mcpMenuPosition, setMcpMenuPosition] = useState<DropdownMenuPosition | null>(null);
  const mcpMenuRef = useRef<HTMLDivElement | null>(null);

  const updateMcpMenuPosition = useCallback(() => {
    if (openMcpDropdownIndex === null) return;
    const container = mcpDropdownRefs.current[openMcpDropdownIndex];
    if (!container) return;
    setMcpMenuPosition(getDropdownMenuPosition(container));
  }, [mcpDropdownRefs, openMcpDropdownIndex]);

  useEffect(() => {
    if (openMcpDropdownIndex === null) return;

    const handlePointerDown = (event: MouseEvent) => {
      const activeContainer = mcpDropdownRefs.current[openMcpDropdownIndex];
      const target = event.target as Node;
      if (!activeContainer) return;
      if (!activeContainer.contains(target) && !mcpMenuRef.current?.contains(target)) {
        onMcpDropdownClose();
      }
    };

    const animationFrame = window.requestAnimationFrame(updateMcpMenuPosition);
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updateMcpMenuPosition);
    window.addEventListener("scroll", updateMcpMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateMcpMenuPosition);
      window.removeEventListener("scroll", updateMcpMenuPosition, true);
    };
  }, [mcpDropdownRefs, onMcpDropdownClose, openMcpDropdownIndex, updateMcpMenuPosition]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
          <div className="relative h-5 w-5 shrink-0">
            <Image src="/img/mcp.png" alt="MCP" fill className="object-contain" />
          </div>
          MCP Servers
        </label>
        <p className="text-xs leading-snug text-gray-400">
          Type a custom URL or choose from registered MCP servers
        </p>

        <div className="flex flex-col gap-2">
          {mcpServers.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                ref={(node) => {
                  mcpDropdownRefs.current[index] = node;
                }}
                className="relative w-full"
              >
                <input
                  type="text"
                  value={value}
                  onChange={(event) => onMcpValueChange(index, event.target.value)}
                  placeholder="https://mcp.example.com/sse"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => onMcpDropdownToggle(index)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  <ChevronDown size={16} />
                </button>

                {openMcpDropdownIndex === index && mcpMenuPosition ? createPortal(
                  <div
                    ref={mcpMenuRef}
                    className="fixed z-[120] overflow-auto rounded-lg border bg-white shadow-lg"
                    style={{
                      top: mcpMenuPosition.top,
                      left: mcpMenuPosition.left,
                      width: mcpMenuPosition.width,
                      maxHeight: mcpMenuPosition.maxHeight,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onMcpClear(index)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                    >
                      Show MCP
                    </button>
                    {isMcpLoading ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Loading MCP servers...</div>
                    ) : mcpOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No MCP servers found</div>
                    ) : (
                      mcpOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => onMcpSelect(index, option)}
                          className="w-full border-b px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {option.name || option.serverUrl}
                          </div>
                          <div className="break-all text-xs text-gray-500">{option.serverUrl}</div>
                        </button>
                      ))
                    )}
                  </div>,
                  document.body
                ) : null}
              </div>

              <button
                type="button"
                onClick={onMcpAdd}
                title="Add"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
              >
                <Plus size={14} />
              </button>

              {mcpServers.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onMcpRemove(index)}
                  title="Remove"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <DynamicDropdownField
        Logo={Link2}
        label="Connector Config"
        values={connectorConfigIds}
        options={connectorOptions}
        configDataMap={configDataMap}
        onAdd={onConnectorAdd}
        onRemove={onConnectorRemove}
        onChange={onConnectorChange}
      />

      <SimpleDropdownField
        Logo={Sparkles}
        label="Skill"
        hint={isSkillsLoading ? "Loading registered skills" : "Choose from registered skills"}
        values={skillIds}
        options={skillOptions}
        placeholder="Select skill"
        onAdd={onSkillAdd}
        onRemove={onSkillRemove}
        onChange={onSkillChange}
      />
    </div>
  );
}
