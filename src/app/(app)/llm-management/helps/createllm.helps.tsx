"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import type { RoundedSelectProps } from "./llm.types";

export default function RoundedSelect({
  value,
  options,
  placeholder,
  disabled,
  leadingIconSrc,
  leadingIconAlt,
  onChange,
}: RoundedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedLabel =
    options.find((option) => option.value === value) ?? null;

  const displayLabel = selectedLabel?.label || placeholder;
  const displayClass = !value ? "text-[#9ca3af]" : "text-[#111827]";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition ${
          disabled
            ? "cursor-not-allowed border-[#e0e5f0] bg-white/90"
            : "border-[#e0e5f0] bg-white"
        }`}
      >
        <span className={`flex items-center gap-2 ${displayClass}`}>
          {(selectedLabel?.iconSrc || leadingIconSrc) && (
            <Image
              src={selectedLabel?.iconSrc || leadingIconSrc || ""}
              alt={
                selectedLabel
                  ? `${selectedLabel.label} logo`
                  : leadingIconAlt || "icon"
              }
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
          )}
          <span>{displayLabel}</span>
        </span>

        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border bg-white shadow">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-indigo-50"
          >
            {placeholder}
          </button>

          <div className="max-h-56 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm ${
                  option.value === value
                    ? "bg-indigo-50 text-indigo-600"
                    : "hover:bg-gray-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  {option.iconSrc && (
                    <Image
                      src={option.iconSrc}
                      alt={`${option.label} logo`}
                      width={20}
                      height={20}
                    />
                  )}
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}