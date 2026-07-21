"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import AwsBooleanSelect, { type AwsBooleanValue } from "./AwsBooleanSelect";
import type { AwsSetPayload } from "./types";
import { getErrorDetail } from "./utils";

type SetAWSconfigProps = {
  baseUrl: string;
  onCreated: () => void;
};

export default function SetAWSconfig({ baseUrl, onCreated }: SetAWSconfigProps) {
  const [isPreparingForm, setIsPreparingForm] = useState(true);
  const [name, setName] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [region, setRegion] = useState("");
  const [isDefault, setIsDefault] = useState<AwsBooleanValue>("false");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setIsPreparingForm(true);
    const timer = window.setTimeout(() => {
      setIsPreparingForm(false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, []);

  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(accessKeyId.trim()) &&
    Boolean(secretAccessKey.trim()) &&
    Boolean(region.trim()) &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !baseUrl) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const payload: AwsSetPayload = {
      name: name.trim(),
      access_key_id: accessKeyId.trim(),
      secret_access_key: secretAccessKey.trim(),
      session_token: sessionToken.trim(),
      region: region.trim(),
      is_default: isDefault === "true",
    };

    try {
      const response = await fetch(`${baseUrl}/aws/credentials/`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorDetail(responsePayload, "Unable to save AWS credentials."));
      }

      onCreated();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save AWS credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPreparingForm) {
    return (
      <div className="rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] p-5">
        <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#475569]">
          <Loader2 className="h-4 w-4 animate-spin text-[#4f49e2]" />
          Loading AWS Set Config...
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`aws-set-skeleton-${index}`}
              className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3"
            >
              <div className="h-3 w-24 rounded bg-[#ecf1fb]" />
              <div className="mt-2 h-10 w-full rounded bg-[#ecf1fb]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-[#111827]">
          Name <span className="text-[#dc2626]">*</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            placeholder="rcaiops_aws"
          />
        </label>
        <label className="text-sm font-semibold text-[#111827]">
          Region <span className="text-[#dc2626]">*</span>
          <input
            type="text"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            placeholder="us-east-1"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-[#111827]">
          Access Key ID <span className="text-[#dc2626]">*</span>
          <input
            type="text"
            value={accessKeyId}
            onChange={(event) => setAccessKeyId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
          />
        </label>
        <label className="text-sm font-semibold text-[#111827]">
          Default <span className="text-[#dc2626]">*</span>
          <AwsBooleanSelect
            value={isDefault}
            onChange={setIsDefault}
          />
        </label>
      </div>

      <label className="block text-sm font-semibold text-[#111827]">
        Secret Access Key <span className="text-[#dc2626]">*</span>
        <input
          type="password"
          value={secretAccessKey}
          onChange={(event) => setSecretAccessKey(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
        />
      </label>

      <label className="block text-sm font-semibold text-[#111827]">
        Session Token
        <textarea
          value={sessionToken}
          onChange={(event) => setSessionToken(event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
          placeholder="Optional session token"
        />
      </label>

      {submitError ? (
        <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] ${
            !canSubmit
              ? "cursor-not-allowed bg-[#c7c4f7]"
              : "bg-[#4f49e2] hover:bg-[#4338ca]"
          }`}
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Set Config"
          )}
        </button>
      </div>
    </div>
  );
}
