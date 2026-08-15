"use client";

import {
  ModalCardBody,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardPanel,
} from "@/components/modalcards";
import { Bot, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  DraftGeneratingButtonIcon,
  DraftGenerationProgress,
} from "../DraftGenerationAnimation";

type PromptAgentProps = {
  onClose: () => void;
  onGenerate: (prompt: string) => Promise<void>;
  title?: string;
  subtitle?: string;
  description?: string;
  buttonLabel?: string;
  loadingLabel?: string;
  helperText?: string;
  promptLabel?: string;
  placeholder?: string;
  generationSteps?: string[];
};

export default function PromptAgent({
  onClose,
  onGenerate,
  title = "Draft Agent with AI",
  subtitle,
  description = "Describe the agent you want to create. We'll use this to draft the form fields for review.",
  buttonLabel = "Generate Agent Draft",
  loadingLabel = "Generating...",
  helperText = "You can review and edit all generated fields before creating the agent.",
  promptLabel = "Agent description prompt",
  placeholder = "Create an automation agent that monitors IBM MQ queues, opens ServiceNow incidents, alerts Teams, and uses approved SOPs for remediation.",
  generationSteps,
}: PromptAgentProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const trimmedPrompt = prompt.trim();
  const canGenerate = trimmedPrompt.length > 0 && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) {
      return;
    }

    setIsGenerating(true);
    setError("");
    try {
      await onGenerate(trimmedPrompt);
    } catch (generationError: unknown) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate agent draft."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ModalCardPanel
      maxWidthClassName="max-w-3xl"
      className={isGenerating ? "max-h-[calc(100vh-2rem)]" : "max-h-[90vh]"}
    >
      <ModalCardHeader
        title={title}
        subtitle={subtitle}
        icon={<Sparkles className="h-4 w-4" />}
        onClose={onClose}
      />

      <ModalCardBody
        className={`bg-[#fbfcff] ${
          isGenerating ? "flex-1 overflow-y-auto py-3 sm:py-5" : ""
        }`}
      >
        {isGenerating ? (
          <DraftGenerationProgress steps={generationSteps} />
        ) : (
          <>
            <div className="mb-5 flex items-start gap-2 text-base font-semibold leading-6 text-[#344054]">
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#4f49e2]" />
              <p>{description}</p>
            </div>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#344054]">
                <Bot className="h-4 w-4 text-[#4f49e2]" />
                <span>{promptLabel}</span>
              </span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                placeholder={placeholder}
                className="min-h-[150px] w-full resize-none rounded-xl border border-[#d9e2f1] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#111827] outline-none transition placeholder:text-[#98a2b3] focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10"
              />
            </label>
            <p className="mt-3 text-xs font-medium text-[#8a94a6]">
              {helperText}
            </p>
            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}
          </>
        )}
      </ModalCardBody>

      <ModalCardFooter className="shrink-0 bg-slate-50">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#4f49e2] px-5 text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(79,73,226,0.7)] transition hover:bg-[#4338ca] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DraftGeneratingButtonIcon active={isGenerating} />
          {isGenerating ? loadingLabel : buttonLabel}
        </button>
      </ModalCardFooter>
    </ModalCardPanel>
  );
}
