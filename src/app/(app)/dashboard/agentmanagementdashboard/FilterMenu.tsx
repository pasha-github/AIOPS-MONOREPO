"use client";

import { Filter } from "lucide-react";

import type { AgentFilter } from "./types";

type FilterMenuProps = {
  agentFilter: AgentFilter;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: AgentFilter) => void;
};

const options: Array<{ label: string; value: AgentFilter }> = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Stopped", value: "stopped" },
];

export default function FilterMenu({
  agentFilter,
  isOpen,
  onToggle,
  onSelect,
}: FilterMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 rounded-xl border border-[#e3e7f2] px-3 py-2 text-sm font-medium text-[#111827] shadow-[0_6px_14px_-12px_rgba(16,24,40,0.3)]"
      >
        <Filter className="h-4 w-4" />
        Filter
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.3)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`w-full px-4 py-2 text-left text-sm ${
                agentFilter === option.value
                  ? "bg-[#eef2ff] text-[#4f49e2]"
                  : "text-[#111827] hover:bg-[#f3f4f6]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
