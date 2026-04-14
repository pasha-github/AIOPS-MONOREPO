"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ModelSelectProps } from "../../types";


export function ModelSelect({
  value,
  options,
  placeholder,
  disabled,
  loading,
  onChange,
}: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        className="w-full flex justify-between px-3 py-2 border rounded-lg"
      >
        <span>
          {loading
            ? "Loading..."
            : selected
            ? selected.label
            : placeholder}
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="absolute w-full bg-white border mt-1 rounded-lg shadow">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-gray-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}