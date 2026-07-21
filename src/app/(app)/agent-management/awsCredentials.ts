"use client";

import { trimTrailingSlash } from "@/config/agent";

export type AwsCredentialRecord = {
  credential_id: string;
  name: string;
  access_key_id: string;
  region: string;
  is_default: boolean;
  has_session_token: boolean;
  created_at: string;
  updated_at: string;
};

export type AwsCredentialOption = {
  value: string;
  label: string;
  isDefault: boolean;
};

const normalizeAwsCredential = (value: unknown): AwsCredentialRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const credentialId =
    typeof record.credential_id === "string" ? record.credential_id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";

  if (!credentialId || !name) {
    return null;
  }

  return {
    credential_id: credentialId,
    name,
    access_key_id:
      typeof record.access_key_id === "string" ? record.access_key_id.trim() : "",
    region: typeof record.region === "string" ? record.region.trim() : "",
    is_default: Boolean(record.is_default),
    has_session_token: Boolean(record.has_session_token),
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
};

const getAwsCredentialError = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof (payload as { detail?: unknown }).detail === "string"
  ) {
    return String((payload as { detail: string }).detail);
  }

  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return String((payload as { message: string }).message);
  }

  return fallback;
};

export async function fetchAwsCredentialOptions(
  baseUrl: string,
  signal?: AbortSignal
): Promise<AwsCredentialOption[]> {
  const base = trimTrailingSlash(baseUrl);
  const [defaultResponse, listResponse] = await Promise.all([
    fetch(`${base}/aws/credentials/default`, {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
    }),
    fetch(`${base}/aws/credentials/`, {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
    }),
  ]);

  const defaultPayload = await defaultResponse.json().catch(() => null);
  const listPayload = await listResponse.json().catch(() => null);

  if (!listResponse.ok) {
    throw new Error(
      getAwsCredentialError(listPayload, "Unable to load AWS credentials.")
    );
  }

  const merged = new Map<string, AwsCredentialRecord>();
  const normalizedDefault = normalizeAwsCredential(defaultPayload);
  if (normalizedDefault) {
    merged.set(normalizedDefault.credential_id, {
      ...normalizedDefault,
      is_default: true,
    });
  }

  if (Array.isArray(listPayload)) {
    listPayload.forEach((item) => {
      const normalized = normalizeAwsCredential(item);
      if (!normalized) {
        return;
      }
      const existing = merged.get(normalized.credential_id);
      merged.set(normalized.credential_id, {
        ...normalized,
        is_default: existing?.is_default ?? normalized.is_default,
      });
    });
  }

  return Array.from(merged.values()).map((credential) => ({
    value: credential.credential_id,
    label: credential.is_default
      ? `${credential.name} (Default)`
      : credential.name,
    isDefault: credential.is_default,
  }));
}
