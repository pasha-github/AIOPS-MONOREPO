"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import type { RoundedSelectProps } from "../helps/llm.types";

// export this
export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10";

// export this
export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs leading-snug text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

// export this
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </p>
  );
}

// export this
export function RoundedSelect({
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

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label || placeholder;
  const iconSrc = selected?.iconSrc || leadingIconSrc;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((p) => !p)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
          disabled
            ? "cursor-not-allowed border-dashed border-gray-200 bg-gray-100 text-gray-400"
            : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        }`}
      >
        <span className="flex items-center gap-2">
          {iconSrc && (
            <Image
              src={iconSrc}
              alt={leadingIconAlt || "icon"}
              width={18}
              height={18}
              className="shrink-0 rounded-sm"
            />
          )}
          <span className={!selected ? "text-gray-400" : ""}>
            {displayLabel}
          </span>
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          } ${disabled ? "text-gray-300" : "text-gray-400"}`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-gray-50 ${
                o.value === value
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-700"
              }`}
            >
              {o.iconSrc && (
                <Image
                  src={o.iconSrc}
                  alt={o.label}
                  width={18}
                  height={18}
                  className="shrink-0 rounded-sm"
                />
              )}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}