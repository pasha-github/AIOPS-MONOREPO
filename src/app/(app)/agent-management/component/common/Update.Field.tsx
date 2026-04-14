"use client";

import {FieldProps} from "../../types";


export function Field({ label, hint, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      {hint && (
        <p className="text-xs leading-snug text-gray-400">{hint}</p>
      )}

      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {children}
        </p>
    );
}