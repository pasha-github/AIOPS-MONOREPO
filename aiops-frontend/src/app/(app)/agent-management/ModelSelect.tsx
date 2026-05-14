"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

export type ModelOption = {
  value: string;
  label: string;
  secondary: string;
  iconSrc: string | null;
};

type ModelSelectProps = {
  value: string;
  options: ModelOption[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (v: string) => void;
};

export default function ModelSelect({
  value, options, placeholder, disabled, loading, onChange,
}: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled && !loading) setIsOpen((p) => !p); }}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
          disabled || loading
            ? "cursor-not-allowed border-dashed border-gray-200 bg-gray-100 text-gray-400"
            : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.iconSrc && (
            <Image src={selected.iconSrc} alt="" width={18} height={18} className="shrink-0 rounded-sm object-contain" />
          )}
          {loading ? (
            <span className="text-gray-400">Loading models…</span>
          ) : selected ? (
            <span className="min-w-0">
              <span className="block truncate">{selected.label}</span>
              <span className="block truncate text-xs text-gray-400">{selected.secondary}</span>
            </span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && !disabled && !loading && (
        <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => { onChange(""); setIsOpen(false); }}
            className="w-full px-3 py-2.5 text-left text-sm text-gray-400 hover:bg-gray-50"
          >
            {placeholder}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setIsOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition ${
                o.value === value
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {o.iconSrc && (
                <Image src={o.iconSrc} alt="" width={18} height={18} className="shrink-0 rounded-sm object-contain" />
              )}
              <span className="min-w-0">
                <span className="block truncate">{o.label}</span>
                <span className="block truncate text-xs text-gray-400">{o.secondary}</span>
              </span>
              {o.value === value && (
                <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}