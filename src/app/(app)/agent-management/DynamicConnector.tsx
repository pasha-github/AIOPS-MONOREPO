import { ChevronDown, LucideIcon, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CustomDropdown } from "./CustomDropdown";
import { DynamicDropdownFieldProps, DynamicListFieldProps } from "./types";

export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10";

export type DropdownMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export const getDropdownMenuPosition = (trigger: HTMLElement): DropdownMenuPosition => {
  const rect = trigger.getBoundingClientRect();
  const viewportPadding = 8;
  const menuGap = 4;
  const preferredMaxHeight = 240;
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const availableHeight = spaceBelow - menuGap;
  const maxHeight = Math.max(120, Math.min(preferredMaxHeight, availableHeight));

  return {
    top: Math.min(window.innerHeight - viewportPadding, rect.bottom + menuGap),
    left: Math.max(viewportPadding, rect.left),
    width: rect.width,
    maxHeight,
  };
};

export function Field({
  label, hint, required, children, Logo
}: {
  Logo?: LucideIcon;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {Logo ? <Logo className="h-4 w-4 text-[#475569]" /> : null}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs leading-snug text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

export function DynamicListField({
  label, hint, values, placeholder, onAdd, onRemove, onChange
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
  Logo,
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
    <Field label={label} hint={hint} Logo={Logo}>
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
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
  Logo,
  label,
  hint,
  values,
  options,
  placeholder = "Select option",
  onAdd,
  onRemove,
  onChange,
}: {
  Logo?: LucideIcon;
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
  const [menuPosition, setMenuPosition] = useState<DropdownMenuPosition | null>(null);
  const containerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (openIndex === null) return;
    const container = containerRefs.current[openIndex];
    if (!container) return;
    setMenuPosition(getDropdownMenuPosition(container));
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;

    const handlePointerDown = (event: MouseEvent) => {
      const container = containerRefs.current[openIndex];
      const target = event.target as Node;
      if (!container) return;
      if (!container.contains(target) && !menuRef.current?.contains(target)) {
        setOpenIndex(null);
      }
    };

    updateMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [openIndex, updateMenuPosition]);

  return (
    <Field label={label} hint={hint} Logo={Logo}>
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

              {openIndex === index && menuPosition ? createPortal(
                <div
                  ref={menuRef}
                  className="fixed z-[120] overflow-auto rounded-lg border bg-white shadow-lg"
                  style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: menuPosition.width,
                    maxHeight: menuPosition.maxHeight,
                  }}
                >
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
                </div>,
                document.body
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

export function ThemedSingleDropdown({
  value,
  options,
  placeholder = "Select option",
  onChange,
  disabled = false,
  includePlaceholderOption = true,
}: {
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  includePlaceholderOption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<DropdownMenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (!containerRef.current) return;
    setMenuPosition(getDropdownMenuPosition(containerRef.current));
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    updateMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        className={`${inputClass} flex items-start justify-between hover:border-indigo-400 ${
          disabled ? "cursor-not-allowed bg-gray-100 text-gray-400" : "cursor-pointer"
        }`}
      >
        <span className={selectedOption ? "text-sm text-gray-900" : "text-sm text-gray-400"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className={`mt-1 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && menuPosition ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] overflow-auto rounded-lg border bg-white shadow-lg"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          {includePlaceholderOption ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
            >
              {placeholder}
            </button>
          ) : null}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="w-full border-b px-3 py-2 text-left hover:bg-gray-50 last:border-b-0"
            >
              <div className="text-sm font-medium text-gray-900">{option.label}</div>
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
