"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AwsBooleanSelect, { type AwsBooleanValue } from "./AwsBooleanSelect";
import type { AwsCredential, AwsSetPayload } from "./types";
import { formatDateTime, getErrorDetail } from "./utils";

type EditableAwsDraft = {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  isDefault: AwsBooleanValue;
};

type UpdateAWSconfigProps = {
  baseUrl: string;
  credential: AwsCredential;
  title: string;
  subtitle?: string;
  deleteControl?: React.ReactNode;
  headerBadge?: React.ReactNode;
  showCredentialIdField?: boolean;
  onUpdated: () => void;
  onErrorChange: (value: string) => void;
};

const createDraftFromCredential = (credential: AwsCredential): EditableAwsDraft => ({
  name: credential.name,
  accessKeyId: credential.access_key_id,
  secretAccessKey: "",
  sessionToken: "",
  region: credential.region,
  isDefault: credential.is_default ? "true" : "false",
});

export default function UpdateAWSconfig({
  baseUrl,
  credential,
  title,
  subtitle,
  deleteControl,
  headerBadge,
  showCredentialIdField = true,
  onUpdated,
  onErrorChange,
}: UpdateAWSconfigProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<EditableAwsDraft>(() => createDraftFromCredential(credential));

  useEffect(() => {
    setDraft(createDraftFromCredential(credential));
    setIsEditing(false);
    setIsSaving(false);
  }, [credential]);

  const canSave = useMemo(
    () =>
      Boolean(draft.name.trim()) &&
      Boolean(draft.accessKeyId.trim()) &&
      Boolean(draft.region.trim()) &&
      !isSaving,
    [draft.accessKeyId, draft.name, draft.region, isSaving]
  );

  const handleCancel = () => {
    setDraft(createDraftFromCredential(credential));
    setIsEditing(false);
    onErrorChange("");
  };

  const handleSave = async () => {
    if (!baseUrl || !canSave) {
      return;
    }

    setIsSaving(true);
    onErrorChange("");

    const payload: AwsSetPayload = {
      name: draft.name.trim(),
      access_key_id: draft.accessKeyId.trim(),
      secret_access_key: draft.secretAccessKey.trim(),
      session_token: draft.sessionToken.trim(),
      region: draft.region.trim(),
      is_default: draft.isDefault === "true",
    };

    try {
      const response = await fetch(
        `${baseUrl}/aws/credentials/${encodeURIComponent(credential.credential_id)}`,
        {
          method: "PATCH",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorDetail(responsePayload, "Unable to update AWS credential."));
      }

      setIsEditing(false);
      onUpdated();
    } catch (error) {
      onErrorChange(error instanceof Error ? error.message : "Unable to update AWS credential.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-[#eef1f7] bg-[#f8faff] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#111827]">{title}</p>
          {subtitle ? <p className="mt-1 text-xs text-[#64748b]">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {headerBadge}
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canSave}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
                  canSave
                    ? "bg-[#16a34a] text-white hover:bg-[#15803d]"
                    : "cursor-not-allowed bg-[#bbf7d0] text-white"
                }`}
                title="Save changes"
                aria-label="Save changes"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#e5e7eb] text-[#475569] hover:bg-[#d1d5db]"
                title="Cancel changes"
                aria-label="Cancel changes"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(createDraftFromCredential(credential));
                setIsEditing(true);
                onErrorChange("");
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#cfd8ee] bg-white text-[#4f49e2] hover:bg-[#eef2ff]"
              title="Edit credential"
              aria-label="Edit credential"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {deleteControl}
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Name</p>
          {isEditing ? (
            <input
              type="text"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          ) : (
            <p className="mt-1 text-sm font-medium text-[#111827]">{credential.name}</p>
          )}
        </div>

        <div className="rounded-xl p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Access Key ID</p>
          {isEditing ? (
            <input
              type="text"
              value={draft.accessKeyId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, accessKeyId: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          ) : (
            <p className="mt-1 text-sm text-[#111827]">{credential.access_key_id}</p>
          )}
        </div>

        <div className="rounded-xl p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Region</p>
          {isEditing ? (
            <input
              type="text"
              value={draft.region}
              onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          ) : (
            <p className="mt-1 text-sm text-[#111827]">{credential.region}</p>
          )}
        </div>

        <div className="rounded-xl p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Default</p>
          {isEditing ? (
            <AwsBooleanSelect
              value={draft.isDefault}
              onChange={(value) => setDraft((current) => ({ ...current, isDefault: value }))}
            />
          ) : (
            <p className="mt-1 text-sm text-[#111827]">{credential.is_default ? "True" : "False"}</p>
          )}
        </div>

        <div className="rounded-xl p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Secret Access Key</p>
          {isEditing ? (
            <input
              type="password"
              value={draft.secretAccessKey}
              onChange={(event) =>
                setDraft((current) => ({ ...current, secretAccessKey: event.target.value }))
              }
              placeholder="Enter new secret access key"
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          ) : (
            <p className="mt-1 text-sm text-[#111827]">Configured</p>
          )}
        </div>

        <div className="rounded-xl p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Session Token</p>
          {isEditing ? (
            <input
              type="text"
              value={draft.sessionToken}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sessionToken: event.target.value }))
              }
              placeholder="Optional session token"
              className="mt-2 w-full rounded-xl border border-[#e0e5f0] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
            />
          ) : (
            <p className="mt-1 text-sm text-[#111827]">
              {credential.has_session_token ? "Configured" : "Not configured"}
            </p>
          )}
        </div>

        <div className="rounded-xl p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Created At</p>
          <p className="mt-1 text-sm text-[#111827]">{formatDateTime(credential.created_at)}</p>
        </div>

        <div className="rounded-xl p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Updated At</p>
          <p className="mt-1 text-sm text-[#111827]">{formatDateTime(credential.updated_at)}</p>
        </div>

        {showCredentialIdField ? (
          <div className="rounded-xl p-3 md:col-span-2 xl:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Credential ID</p>
            <p className="mt-1 break-all text-sm text-[#111827]">{credential.credential_id}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
