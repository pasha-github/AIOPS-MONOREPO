"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AwsBooleanValue = "true" | "false";

type DefaultOption = {
  value: AwsBooleanValue;
  label: string;
};

const DEFAULT_OPTIONS: DefaultOption[] = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
];

type AwsBooleanSelectProps = {
  value: AwsBooleanValue;
  onChange: (value: AwsBooleanValue) => void;
  disabled?: boolean;
};

export default function AwsBooleanSelect({
  value,
  onChange,
  disabled = false,
}: AwsBooleanSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = DEFAULT_OPTIONS.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [disabled, isOpen]);

  return (
    <div ref={containerRef} className="relative mt-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((previous) => !previous)}
        className={`flex w-full items-center justify-between rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-left text-sm text-[#111827] outline-none transition focus-within:border-[#4f49e2] focus-within:ring-2 focus-within:ring-[#4f49e2]/20 ${
          disabled ? "cursor-not-allowed bg-[#f8fafc] text-[#94a3b8]" : ""
        }`}
      >
        <span>{selectedOption?.label ?? "False"}</span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>

      {isOpen && !disabled ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
          {DEFAULT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm ${
                option.value === value
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
