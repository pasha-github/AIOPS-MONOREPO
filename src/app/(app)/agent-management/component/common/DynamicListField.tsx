"use client";

import { Plus, Trash2 } from "lucide-react";
import { inputClass } from "./Update.helpes";

export interface DynamicListFieldProps {
    label: string;
    hint?: string;
    values: string[];
    placeholder: string;
    onAdd: () => void;
    onRemove: (index: number) => void;
    onChange: (index: number, value: string) => void;
}

export function DynamicListField({
    label,
    hint,
    values,
    placeholder,
    onAdd,
    onRemove,
    onChange,
}: DynamicListFieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">{label}</label>

            {hint && <p className="text-xs text-gray-400">{hint}</p>}

            <div className="flex flex-col gap-2">
                {values.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">

                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(index, e.target.value)}
                            placeholder={placeholder}
                            className={inputClass}
                        />

                        <button
                            type="button"
                            title="Add"
                            onClick={onAdd}
                            className="h-9 w-9 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
                        >
                            <Plus size={14} />
                        </button>

                        {values.length > 1 && (
                            <button
                                type="button"
                                title="Delete"
                                onClick={() => onRemove(index)}
                                className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}