"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProviderKey, VertexSetPayload } from "./types";
import { getErrorDetail } from "./utils";

type SetConfigProps = {
  provider: ProviderKey;
  baseUrl: string;
  onCreated: () => void;
};

export default function SetConfig({ provider, baseUrl, onCreated }: SetConfigProps) {
  const isVertex = provider === "vertex";
  const [isPreparingForm, setIsPreparingForm] = useState(true);

  const [projectId, setProjectId] = useState("");
  const [location, setLocation] = useState("");
  const [stagingBucket, setStagingBucket] = useState("");
  const [type, setType] = useState("");
  const [privateKeyId, setPrivateKeyId] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [authUri, setAuthUri] = useState("");
  const [tokenUri, setTokenUri] = useState("");
  const [authProviderCertUrl, setAuthProviderCertUrl] = useState("");
  const [clientCertUrl, setClientCertUrl] = useState("");
  const [universeDomain, setUniverseDomain] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isVertex) {
      setIsPreparingForm(false);
      return;
    }

    setIsPreparingForm(true);
    const timer = window.setTimeout(() => {
      setIsPreparingForm(false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [isVertex]);

  const canSubmitVertex =
    Boolean(projectId.trim()) &&
    Boolean(location.trim()) &&
    Boolean(stagingBucket.trim()) &&
    Boolean(type.trim()) &&
    Boolean(privateKeyId.trim()) &&
    Boolean(privateKey.trim()) &&
    Boolean(clientEmail.trim()) &&
    Boolean(clientId.trim()) &&
    Boolean(authUri.trim()) &&
    Boolean(tokenUri.trim()) &&
    Boolean(authProviderCertUrl.trim()) &&
    Boolean(clientCertUrl.trim()) &&
    Boolean(universeDomain.trim()) &&
    !isSubmitting;

  const handleSetVertexConfig = async () => {
    if (!canSubmitVertex || !baseUrl) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const payload: VertexSetPayload = {
      project_id: projectId.trim(),
      location: location.trim(),
      staging_bucket: stagingBucket.trim(),
      google_application_credentials: {
        type: type.trim(),
        project_id: projectId.trim(),
        private_key_id: privateKeyId.trim(),
        private_key: privateKey,
        client_email: clientEmail.trim(),
        client_id: clientId.trim(),
        auth_uri: authUri.trim(),
        token_uri: tokenUri.trim(),
        auth_provider_x509_cert_url: authProviderCertUrl.trim(),
        client_x509_cert_url: clientCertUrl.trim(),
        universe_domain: universeDomain.trim(),
      },
    };

    try {
      const response = await fetch(`${baseUrl}/vertex/config/`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await response.json().catch(() => null);
      if (response.status !== 200) {
        throw new Error(getErrorDetail(responsePayload, "Unable to save Vertex config."));
      }

      onCreated();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save Vertex config.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVertex) {
    return (
      <div className="rounded-xl border border-[#e5eaf4] bg-[#f8fafc] px-4 py-5 text-sm text-[#475569]">
        Set configuration is not connected for this provider yet.
      </div>
    );
  }

  if (isPreparingForm) {
    return (
      <div className="rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] p-5">
        <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#475569]">
          <Loader2 className="h-4 w-4 animate-spin text-[#4f49e2]" />
          Loading Set Config...
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`set-config-top-skeleton-${index}`}
                className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3"
              >
                <div className="h-3 w-20 rounded bg-[#ecf1fb]" />
                <div className="mt-2 h-10 w-full rounded bg-[#ecf1fb]" />
              </div>
            ))}
          </div>
          <div className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3">
            <div className="h-3 w-24 rounded bg-[#ecf1fb]" />
            <div className="mt-2 h-10 w-full rounded bg-[#ecf1fb]" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={`set-config-cred-skeleton-${index}`}
                className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3"
              >
                <div className="h-3 w-24 rounded bg-[#ecf1fb]" />
                <div className="mt-2 h-10 w-full rounded bg-[#ecf1fb]" />
              </div>
            ))}
          </div>
          <div className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3">
            <div className="h-3 w-20 rounded bg-[#ecf1fb]" />
            <div className="mt-2 h-28 w-full rounded bg-[#ecf1fb]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-[#111827]">
          Project ID <span className="text-[#dc2626]">*</span>
          <input
            type="text"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            placeholder="rc-ai-ops-internal"
          />
        </label>
        <label className="text-sm font-semibold text-[#111827]">
          Location <span className="text-[#dc2626]">*</span>
          <input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            placeholder="us-central1"
          />
        </label>
      </div>

      <label className="text-sm font-semibold text-[#111827]">
        Staging Bucket <span className="text-[#dc2626]">*</span>
        <input
          type="text"
          value={stagingBucket}
          onChange={(event) => setStagingBucket(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
          placeholder="gs://aiops-agents"
        />
      </label>

      <div className="px-4 py-4">
        <p className="mb-3 text-sm font-semibold text-[#1e293b]">Google Application Credentials</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-[#111827]">
            Type <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
              placeholder="service_account"
            />
          </label>
          <label className="text-sm font-semibold text-[#111827]">
            Private Key ID <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={privateKeyId}
              onChange={(event) => setPrivateKeyId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          </label>
          <label className="text-sm font-semibold text-[#111827]">
            Client Email <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          </label>
          <label className="text-sm font-semibold text-[#111827]">
            Client ID <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          </label>
          <label className="text-sm font-semibold text-[#111827]">
            Auth URI <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={authUri}
              onChange={(event) => setAuthUri(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          </label>
          <label className="text-sm font-semibold text-[#111827]">
            Token URI <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={tokenUri}
              onChange={(event) => setTokenUri(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          </label>
          <label className="text-sm font-semibold text-[#111827]">
            Auth Provider Cert URL <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={authProviderCertUrl}
              onChange={(event) => setAuthProviderCertUrl(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          </label>
          <label className="text-sm font-semibold text-[#111827]">
            Client Cert URL <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={clientCertUrl}
              onChange={(event) => setClientCertUrl(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          </label>
          <label className="text-sm font-semibold text-[#111827]">
            Universe Domain <span className="text-[#dc2626]">*</span>
            <input
              type="text"
              value={universeDomain}
              onChange={(event) => setUniverseDomain(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-[#111827]">
          Private Key <span className="text-[#dc2626]">*</span>
          <textarea
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            rows={7}
            className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-xs text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            placeholder="-----BEGIN PRIVATE KEY-----"
          />
        </label>
      </div>

      {submitError ? (
        <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => void handleSetVertexConfig()}
          disabled={!canSubmitVertex}
          className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] ${
            !canSubmitVertex
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
