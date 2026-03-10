"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Eye, EyeOff, Loader2, X } from "lucide-react";
import type { ActionResult } from "./llmHelpers";
import {
  getProviderIconPath,
  LLM_PROVIDER_MODELS,
  type LlmProviderKey,
} from "@/config/agent";

type SelectOption = { value: string; label: string; iconSrc?: string };
type ProviderKey = LlmProviderKey;

type RoundedSelectProps = {
  value: string;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
  leadingIconSrc?: string;
  leadingIconAlt?: string;
  onChange: (value: string) => void;
};

export type CreateLlmPayload = {
  model_id: string;
  provider: string;
  name: string;
  description: string;
  api_key: string;
};

type CreateLlmModalProps = {
  onClose: () => void;
  onCreate: (payload: CreateLlmPayload) => Promise<ActionResult>;
};

const DESCRIPTION_MIN_LENGTH = 10;

const toLabel = (value: string) =>
  value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;

const toIdentifierPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const buildModelId = (provider: string, name: string) =>
  `${toIdentifierPart(provider)}_${toIdentifierPart(name)}`;

function RoundedSelect({
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
    if (!isOpen) {
      return;
    }
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

  const selectedLabel =
    options.find((option) => option.value === value) ?? null;
  const displayLabel = selectedLabel?.label || placeholder;
  const displayClass = !value ? "text-[#9ca3af]" : "text-[#111827]";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm outline-none transition focus-within:border-[#4f49e2] focus-within:ring-2 focus-within:ring-[#4f49e2]/20 ${
          disabled
            ? "cursor-not-allowed border-[#e0e5f0] bg-white/90"
            : "border-[#e0e5f0] bg-white"
        }`}
      >
        <span className={`flex items-center gap-2 ${displayClass}`}>
          {selectedLabel?.iconSrc || leadingIconSrc ? (
            <Image
              src={selectedLabel?.iconSrc || leadingIconSrc || ""}
              alt={
                selectedLabel
                  ? `${selectedLabel.label} logo`
                  : leadingIconAlt || "icon"
              }
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
          ) : null}
          <span>{displayLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>

      {isOpen && !disabled ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-[#6b7280] hover:bg-[#eef2ff]"
          >
            {placeholder}
          </button>
          <div className="max-h-56 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm ${
                  option.value === value
                    ? "bg-[#eef2ff] text-[#4f49e2]"
                    : "text-[#111827] hover:bg-[#f3f4f6]"
                }`}
              >
                <span className="flex items-center gap-2">
                  {option.iconSrc ? (
                    <Image
                      src={option.iconSrc}
                      alt={`${option.label} logo`}
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                    />
                  ) : null}
                  <span>{option.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CreateLlmModal({
  onClose,
  onCreate,
}: CreateLlmModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | "">(
    ""
  );
  const [selectedModelName, setSelectedModelName] = useState("");
  const [description, setDescription] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isDescriptionTouched, setIsDescriptionTouched] = useState(false);
  const [isApiKeyTouched, setIsApiKeyTouched] = useState(false);
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const createModalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const modalElement = createModalRef.current;
    if (!modalElement) {
      return;
    }

    const selector =
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
    const getFocusable = () =>
      Array.from(modalElement.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1
      );

    const focusableElements = getFocusable();
    focusableElements[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isCreating) {
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstElement || !modalElement.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCreating, onClose]);

  const providerOptions: SelectOption[] = useMemo(
    () =>
      (Object.keys(LLM_PROVIDER_MODELS) as ProviderKey[]).map((provider) => ({
        value: provider,
        label: toLabel(provider),
        iconSrc: getProviderIconPath(provider),
      })),
    []
  );

  const modelOptions: SelectOption[] = selectedProvider
    ? LLM_PROVIDER_MODELS[selectedProvider].map((modelName) => ({
        value: modelName,
        label: modelName,
        iconSrc: getProviderIconPath(selectedProvider),
      }))
    : [];

  const selectedProviderIconSrc = selectedProvider
    ? getProviderIconPath(selectedProvider)
    : null;

  const normalizedDescription = description.trim();
  const normalizedApiKey = apiKey.trim();
  const isDescriptionValid = normalizedDescription.length >= DESCRIPTION_MIN_LENGTH;
  const isApiKeyValid = normalizedApiKey.length > 0;
  const shouldShowDescriptionError =
    (isDescriptionTouched || isSubmitAttempted) && !isDescriptionValid;
  const shouldShowApiKeyError =
    (isApiKeyTouched || isSubmitAttempted) && !isApiKeyValid;

  const isCreateDisabled =
    !selectedProvider ||
    !selectedModelName ||
    !isDescriptionValid ||
    !isApiKeyValid ||
    isCreating;

  const handleCreateLlm = async () => {
    if (isCreateDisabled) {
      setIsSubmitAttempted(true);
      setIsDescriptionTouched(true);
      setIsApiKeyTouched(true);
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setIsSubmitAttempted(true);

    const payload: CreateLlmPayload = {
      model_id: buildModelId(selectedProvider, selectedModelName),
      provider: selectedProvider,
      name: selectedModelName,
      description: normalizedDescription,
      api_key: normalizedApiKey,
    };

    const result = await onCreate(payload);
    if (!result.ok) {
      setCreateError(result.error || "Unable to create LLM.");
      setIsCreating(false);
      return;
    }

    setIsCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/30 px-4 py-8">
      <div
        ref={createModalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-llm-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-[#eef1f7] px-6 py-4">
          <h4 id="create-llm-title" className="text-lg font-semibold text-[#111827]">
            Create LLM
          </h4>
          <button
            type="button"
            onClick={() => {
              if (!isCreating) {
                onClose();
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f4f6] text-[#111827]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div className="flex h-full flex-col">
              <label className="min-h-[24px] text-sm font-semibold text-[#111827]">
                Provider
              </label>
              <RoundedSelect
                value={selectedProvider}
                options={providerOptions}
                placeholder="Select provider"
                onChange={(value) => {
                  const provider = value as ProviderKey | "";
                  setSelectedProvider(provider);
                  setSelectedModelName("");
                }}
              />
              <p className="mt-2 min-h-[36px] text-xs text-[#8b95ad]">
                Choose source first.
              </p>
            </div>

            <div className="flex h-full flex-col">
              <span className="inline-flex min-h-[24px] items-center gap-2 text-sm font-semibold text-[#111827]">
                Model name
                {selectedProviderIconSrc ? (
                  <Image
                    src={selectedProviderIconSrc}
                    alt={`${toLabel(selectedProvider)} logo`}
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 object-contain"
                  />
                ) : null}
              </span>
              <RoundedSelect
                value={selectedModelName}
                options={modelOptions}
                placeholder={selectedProvider ? "Select model" : "Select provider first"}
                disabled={!selectedProvider}
                leadingIconSrc={selectedProviderIconSrc ?? undefined}
                leadingIconAlt={
                  selectedProvider ? `${toLabel(selectedProvider)} logo` : "provider logo"
                }
                onChange={setSelectedModelName}
              />
              <p className="mt-2 min-h-[36px] text-xs text-[#8b95ad]">
                {selectedProvider
                  ? "Choose one model from this provider."
                  : "Options appear after provider selection."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111827]">
              Description <span className="text-[#ef4444]">*</span>
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => setIsDescriptionTouched(true)}
              placeholder="Describe this LLM usage..."
              rows={2}
              className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:ring-2 ${
                shouldShowDescriptionError
                  ? "border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/20"
                  : "border-[#e0e5f0] focus:border-[#4f49e2] focus:ring-[#4f49e2]/20"
              }`}
            />
            <p
              className={`text-xs ${
                shouldShowDescriptionError
                  ? "text-[#dc2626]"
                  : isDescriptionValid
                    ? "text-[#16a34a]"
                    : "text-[#8b95ad]"
              }`}
            >
              {shouldShowDescriptionError
                ? `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters.`
                : isDescriptionValid
                  ? "Looks good."
                  : `Minimum ${DESCRIPTION_MIN_LENGTH} characters (${Math.min(
                      normalizedDescription.length,
                      DESCRIPTION_MIN_LENGTH
                    )}/${DESCRIPTION_MIN_LENGTH}).`}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111827]">
              API key <span className="text-[#ef4444]">*</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                onBlur={() => setIsApiKeyTouched(true)}
                placeholder="Enter provider API key"
                autoComplete="new-password"
                className={`w-full rounded-xl border bg-white px-4 py-2.5 pr-12 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:ring-2 ${
                  shouldShowApiKeyError
                    ? "border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/20"
                    : "border-[#e0e5f0] focus:border-[#4f49e2] focus:ring-[#4f49e2]/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((previous) => !previous)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#6b7391] transition hover:bg-[#f3f4f6]"
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p
              className={`text-xs ${
                shouldShowApiKeyError ? "text-[#dc2626]" : "text-[#8b95ad]"
              }`}
            >
              {shouldShowApiKeyError
                ? "API key is required."
                : "Stored securely and never displayed in plain text."}
            </p>
          </div>

          {createError ? (
            <p className="text-sm font-medium text-[#dc2626]">{createError}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
          <button
            type="button"
            onClick={() => {
              if (!isCreating) {
                onClose();
              }
            }}
            className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateLlm}
            disabled={isCreateDisabled}
            className={`inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white ${
              isCreateDisabled
                ? "cursor-not-allowed bg-[#c7c4f7]"
                : "bg-[#4f49e2] shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] hover:bg-[#3f39d6]"
            }`}
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isCreating ? "Creating..." : "Create LLM"}
          </button>
        </div>
      </div>
    </div>
  );
}
