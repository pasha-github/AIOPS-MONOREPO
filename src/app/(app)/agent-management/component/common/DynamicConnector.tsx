import { Plus, Trash2 } from "lucide-react";
import { DynamicListFieldProps } from "../../types";
import { CustomDropdown } from "./CustomDropdown";

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
}: any) {
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