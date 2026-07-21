"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AgentDropdownType = "all" | "agent" | "automation";

type DropdownAgentTypeProps = {
  value: AgentDropdownType;
  onChange: (value: AgentDropdownType) => void;
  allCount?: number;
  conversationalCount?: number;
  automationCount?: number;
};

const OPTIONS: Array<{
  value: AgentDropdownType;
  label: string;
  title: string;
}> = [
  {
    value: "all",
    label: "All Agents",
    title: "All Agents",
  },
  {
    value: "agent",
    label: "Conversational Agents",
    title: "Conversational Agent",
  },
  {
    value: "automation",
    label: "Automation Agents",
    title: "Automation Agent",
  },
];

export default function DropdownAgentType({
  value,
  onChange,
  allCount,
  conversationalCount,
  automationCount,
}: DropdownAgentTypeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0];

  const getCount = (optionValue: AgentDropdownType) => {
    if (optionValue === "all") {
      return allCount;
    }

    return optionValue === "automation" ? automationCount : conversationalCount;
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition"
      >
        <span className="text-lg font-semibold text-[#111827]">
          {selectedOption.title}
        </span>
        {typeof getCount(selectedOption.value) === "number" ? (
          <span className="rounded-md border border-[#cbd2ff] px-2 py-0.5 text-xs font-semibold text-[#5b4cf0]">
            {getCount(selectedOption.value)}
          </span>
        ) : null}
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#64748b] transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div className="absolute left-0 z-50 mt-2 w-[260px] overflow-hidden rounded-xl border border-[#dbe3f0] bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
          {OPTIONS.map((option) => {
            const isSelected = option.value === value;
            const count = getCount(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold transition ${
                  isSelected
                    ? "bg-[#eef2ff] text-[#4f49e2]"
                    : "text-[#334155] hover:bg-[#f8faff]"
                }`}
              >
                <span>{option.label}</span>
                {typeof count === "number" ? (
                  <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] leading-none text-indigo-600">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
