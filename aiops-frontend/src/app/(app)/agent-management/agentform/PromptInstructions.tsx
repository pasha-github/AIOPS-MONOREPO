"use client";

import { PROMPT_FIELD_DEFINITIONS, type PromptFieldKey } from "../types";

type PromptInstructionsProps = {
  promptFields: Record<PromptFieldKey, string>;
  onPromptFieldChange: (key: PromptFieldKey, value: string) => void;
};

export default function PromptInstructions({
  promptFields,
  onPromptFieldChange,
}: PromptInstructionsProps) {
  return (
    <div className="grid gap-3">
      {PROMPT_FIELD_DEFINITIONS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
            {field.label}
            {field.required ? <span className="text-red-500">*</span> : null}
          </label>
          <p className="text-xs leading-snug text-gray-400">
            Define the {field.label.toLowerCase()} for this agent
          </p>
          <textarea
            value={promptFields[field.key]}
            onChange={(event) => onPromptFieldChange(field.key, event.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            rows={3}
            className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>
      ))}
    </div>
  );
}
