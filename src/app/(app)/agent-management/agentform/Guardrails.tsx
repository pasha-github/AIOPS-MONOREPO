"use client";

import GuardrailInput, { type GuardrailPiiPattern } from "./guardrail-input";

type GuardrailsProps = {
  enabled: boolean;
  piiPatterns: GuardrailPiiPattern[];
  sensitivePatternsText: string;
  harmfulKeywords: string[];
  onEnabledChange: (enabled: boolean) => void;
  onPiiPatternsChange: (patterns: GuardrailPiiPattern[]) => void;
  onSensitivePatternsTextChange: (value: string) => void;
  onHarmfulKeywordsChange: (keywords: string[]) => void;
};

export default function Guardrails({
  enabled,
  piiPatterns,
  sensitivePatternsText,
  harmfulKeywords,
  onEnabledChange,
  onPiiPatternsChange,
  onSensitivePatternsTextChange,
  onHarmfulKeywordsChange,
}: GuardrailsProps) {
  return (
    <GuardrailInput
      enabled={enabled}
      piiPatterns={piiPatterns}
      sensitivePatternsText={sensitivePatternsText}
      harmfulKeywords={harmfulKeywords}
      onEnabledChange={onEnabledChange}
      onPiiPatternsChange={onPiiPatternsChange}
      onSensitivePatternsTextChange={onSensitivePatternsTextChange}
      onHarmfulKeywordsChange={onHarmfulKeywordsChange}
    />
  );
}
