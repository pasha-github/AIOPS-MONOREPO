"use client";

import { Ban, Fingerprint, Regex, ShieldCheck, X } from "lucide-react";
import { KeyboardEvent, useState } from "react";
import { inputClass } from "../DynamicConnector";

export type GuardrailPiiPattern =
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "ip_address";

type GuardrailPiiOption = {
  value: GuardrailPiiPattern;
  label: string;
};

type GuardrailInputProps = {
  enabled: boolean;
  piiPatterns: GuardrailPiiPattern[];
  sensitivePatternsText: string;
  harmfulKeywords: string[];
  onEnabledChange: (enabled: boolean) => void;
  onPiiPatternsChange: (patterns: GuardrailPiiPattern[]) => void;
  onSensitivePatternsTextChange: (value: string) => void;
  onHarmfulKeywordsChange: (keywords: string[]) => void;
};

export const DEFAULT_GUARDRAIL_PII_PATTERNS: GuardrailPiiPattern[] = [
  "email",
  "phone",
  "ssn",
  "credit_card",
  "ip_address",
];

const PII_OPTIONS: GuardrailPiiOption[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone n.o" },
  { value: "ssn", label: "SSN" },
  { value: "credit_card", label: "Credit Card" },
  { value: "ip_address", label: "IP Address" },
];

const normalizeKeyword = (value: string) => value.trim();

export default function GuardrailInput({
  enabled,
  piiPatterns,
  sensitivePatternsText,
  harmfulKeywords,
  onEnabledChange,
  onPiiPatternsChange,
  onSensitivePatternsTextChange,
  onHarmfulKeywordsChange,
}: GuardrailInputProps) {
  const [keywordDraft, setKeywordDraft] = useState("");

  const togglePiiPattern = (pattern: GuardrailPiiPattern) => {
    if (piiPatterns.includes(pattern)) {
      onPiiPatternsChange(piiPatterns.filter((item) => item !== pattern));
      return;
    }

    onPiiPatternsChange([...piiPatterns, pattern]);
  };

  const addKeyword = () => {
    const keyword = normalizeKeyword(keywordDraft);
    if (!keyword) return;

    const alreadyExists = harmfulKeywords.some(
      (item) => item.toLowerCase() === keyword.toLowerCase()
    );
    if (!alreadyExists) {
      onHarmfulKeywordsChange([...harmfulKeywords, keyword]);
    }
    setKeywordDraft("");
  };

  const removeKeyword = (keyword: string) => {
    onHarmfulKeywordsChange(
      harmfulKeywords.filter((item) => item.toLowerCase() !== keyword.toLowerCase())
    );
  };

  const handleKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addKeyword();
  };

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ShieldCheck size={18} className="text-[#475569]" />
            Guardrails
          </label>
          <p className="mt-1 text-xs leading-snug text-gray-400">
            Detect sensitive data and harmful terms before agent responses are used.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onEnabledChange(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:ring-offset-2 ${
            enabled ? "bg-green-500" : "bg-orange-400"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled ? (
        <div className="mt-3 rounded-2xl p-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-700">
              <Fingerprint size={14} className="text-[#475569]" />
              PII patterns
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {PII_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={piiPatterns.includes(option.value)}
                    onChange={() => togglePiiPattern(option.value)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="whitespace-nowrap">{option.label}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Please select data category to mask.
            </p>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-700">
              <Regex size={14} className="text-[#475569]" />
              Sensitive regex patterns
            </label>
            <textarea
              value={sensitivePatternsText}
              onChange={(event) => onSensitivePatternsTextChange(event.target.value)}
              rows={4}
              placeholder={'"API-[A-Z0-9]{16}"\n"Bearer\\\\s+[a-zA-Z0-9\\\\-._~+/]+=*"\n"sk-[a-zA-Z0-9]{32}"'}
              className={`${inputClass} mt-2 min-h-[104px] resize-y font-mono text-xs`}
            />
            <p className="mt-1 text-xs text-gray-400">
              Add one regex per line.
            </p>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-700">
              <Ban size={14} className="text-[#475569]" />
              Harmful keywords
            </label>
            {harmfulKeywords.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {harmfulKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-semibold text-gray-700"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="text-gray-400 transition hover:text-red-500"
                      aria-label={`Remove ${keyword}`}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-2 flex gap-2">
              <input
                value={keywordDraft}
                onChange={(event) => setKeywordDraft(event.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="Enter harmful word and press Enter"
                className={`${inputClass} h-10 text-sm`}
              />
              <button
                type="button"
                onClick={addKeyword}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                + Add Keyword
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
