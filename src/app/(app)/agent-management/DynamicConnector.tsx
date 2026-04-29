import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DynamicDropdownFieldProps, DynamicListFieldProps } from "./types";
import { CustomDropdown } from "./CustomDropdown"

export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10";

export function Field({
  label, hint, required, children,
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

export function DynamicListField({
  label, hint, values, placeholder, onAdd, onRemove, onChange,
}: DynamicListFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        {values.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={val}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder={placeholder}
              className={inputClass}
            />
            <button
              type="button"
              onClick={onAdd}
              title="Add"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
            >
              <Plus size={14} />
            </button>
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                title="Remove"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </Field>
  );
}

export function DynamicDropdownField({
  label,
  hint,
  values,
  options,
  placeholder,
  onAdd,
  onRemove,
  onChange,
  configDataMap,
}: DynamicDropdownFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        {values.map((val: string[], i: number) =>(
          <div key={i} className="flex items-center gap-2">

            <CustomDropdown
              value={val || []}   
              options={options}
              configDataMap={configDataMap}
              placeholder={placeholder}
              onChange={(selectedIds: string[]) => onChange(i, selectedIds)}
            />

            <button
              type="button"
              onClick={onAdd}
              className="h-9 w-9 border rounded bg-indigo-50"
            >
              +
            </button>
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                title="Remove"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </Field>
  );
}

export function SimpleDropdownField({
  label,
  hint,
  values,
  options,
  placeholder = "Select option",
  onAdd,
  onRemove,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  options: { value: string; label: string }[];
  placeholder?: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, value: string) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (openIndex === null) return;

    const handlePointerDown = (event: MouseEvent) => {
      const container = containerRefs.current[openIndex];
      if (!container) return;
      if (!container.contains(event.target as Node)) {
        setOpenIndex(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openIndex]);

  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              ref={(node) => {
                containerRefs.current[index] = node;
              }}
              className="relative w-full"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenIndex((current) => (current === index ? null : index))
                }
                className={`${inputClass} flex items-start justify-between cursor-pointer hover:border-indigo-400`}
              >
                <span className={value ? "text-sm text-gray-900" : "text-sm text-gray-400"}>
                  {options.find((option) => option.value === value)?.label ?? placeholder}
                </span>
                <ChevronDown size={16} className="mt-1 shrink-0" />
              </button>

              {openIndex === index ? (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(index, "");
                      setOpenIndex(null);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                  >
                    {placeholder}
                  </button>
                  {options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(index, option.value);
                        setOpenIndex(null);
                      }}
                      className="w-full border-b px-3 py-2 text-left hover:bg-gray-50 last:border-b-0"
                    >
                      <div className="text-sm font-medium text-gray-900">{option.label}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onAdd}
              title="Add"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
            >
              <Plus size={14} />
            </button>
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                title="Remove"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </Field>
  );
}
