"use client";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import type { Dispatch, SetStateAction } from "react";
import ModelSelect, { type ModelOption } from "../ModelSelect";

export type LlmSlotKey = "primary" | "secondary" | "tertiary";

export type LlmFieldConfig = {
  Logo?: LucideIcon;
  key: LlmSlotKey;
  label: string;
  useCustom: boolean;
  setUseCustom: Dispatch<SetStateAction<boolean>>;
  setModelId: Dispatch<SetStateAction<string>>;
  effectiveModelId: string;
  defaultOption: ModelOption | null;
};

type ModelsProps = {
  llmFields: LlmFieldConfig[];
  modelOptions: ModelOption[];
  isModelsLoading: boolean;
  isDefaultsLoading: boolean;
  modelsLoadError: string;
  defaultsLoadError: string;
};

export default function Models({
  llmFields,
  modelOptions,
  isModelsLoading,
  isDefaultsLoading,
  modelsLoadError,
  defaultsLoadError,
}: ModelsProps) {
  return (
    <div className="grid gap-3">
      {llmFields.map((field) => {
        const Icon = field.Logo;
        const selectedOption =
          modelOptions.find((option) => option.value === field.effectiveModelId) ??
          field.defaultOption;
        const dropdownOptions =
          !field.useCustom && field.defaultOption
            ? [
                field.defaultOption,
                ...modelOptions.filter(
                  (option) => option.value !== field.defaultOption?.value
                ),
              ]
            : modelOptions;

        return (
          <div key={field.key}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {field.label}
                  {field.key === "primary" ? <span className="text-red-500">*</span> : null}
                </label>
                <p className="text-xs leading-snug text-gray-400">
                  {field.useCustom
                    ? `Choose a specific ${field.label.toLowerCase()} for this agent`
                    : `Uses the global ${field.label.toLowerCase()} from LLM management`}
                </p>
              </div>
              <label className="inline-flex shrink-0 items-center gap-2 py-1.5 text-xs font-medium text-indigo-700">
                <input
                  type="checkbox"
                  checked={field.useCustom}
                  onChange={(event) => {
                    field.setUseCustom(event.target.checked);
                    if (!event.target.checked) {
                      field.setModelId("");
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Custom LLM
              </label>
            </div>

            <div className="mt-3">
              <ModelSelect
                value={field.effectiveModelId}
                options={dropdownOptions}
                placeholder={
                  field.useCustom
                    ? `Choose ${field.label.toLowerCase()}`
                    : selectedOption
                      ? "Using global default"
                      : "No global default configured"
                }
                loading={isModelsLoading || isDefaultsLoading}
                disabled={
                  !field.useCustom ||
                  isModelsLoading ||
                  isDefaultsLoading ||
                  modelOptions.length === 0
                }
                onChange={field.setModelId}
              />
            </div>

            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-xs text-gray-400">
                {field.useCustom
                  ? "Checkbox enabled: this agent uses the selected LLM."
                  : selectedOption
                    ? `Global default: ${selectedOption.label}`
                    : "Global default is not configured for this slot."}
              </p>
              {selectedOption?.iconSrc ? (
                <Image
                  src={selectedOption.iconSrc}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 object-contain"
                />
              ) : null}
            </div>
          </div>
        );
      })}

      {modelsLoadError || defaultsLoadError ? (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
          {modelsLoadError || defaultsLoadError}
        </p>
      ) : null}
    </div>
  );
}
