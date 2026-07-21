"use client";

import { CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import DeleteAWSconfig from "./DeleteAWSconfig";
import UpdateAWSconfig from "./UpdateAWSconfig";
import type { AwsCredential } from "./types";
import { getErrorDetail } from "./utils";

type ViewAWSconfigProps = {
  isOpen: boolean;
  baseUrl: string;
};

type AwsViewData = {
  credentials: AwsCredential[];
  defaultCredential: AwsCredential | null;
};

async function fetchAwsViewData(baseUrl: string, signal?: AbortSignal): Promise<AwsViewData> {
  const [defaultResponse, listResponse] = await Promise.all([
    fetch(`${baseUrl}/aws/credentials/default`, {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
    }),
    fetch(`${baseUrl}/aws/credentials/`, {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
    }),
  ]);

  const defaultPayload = (await defaultResponse.json().catch(() => null)) as
    | AwsCredential
    | { detail?: string }
    | null;
  const listPayload = (await listResponse.json().catch(() => null)) as AwsCredential[] | null;

  if (!listResponse.ok) {
    throw new Error(getErrorDetail(listPayload, "Unable to load AWS credentials."));
  }

  const credentials = Array.isArray(listPayload) ? listPayload : [];

  if (defaultResponse.ok && defaultPayload && typeof defaultPayload === "object" && "credential_id" in defaultPayload) {
    return {
      credentials,
      defaultCredential: defaultPayload as AwsCredential,
    };
  }

  return {
    credentials,
    defaultCredential: credentials.find((item) => item.is_default) ?? null,
  };
}

export default function ViewAWSconfig({ isOpen, baseUrl }: ViewAWSconfigProps) {
  const [isPreparingView, setIsPreparingView] = useState(true);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [viewError, setViewError] = useState("");
  const [defaultCredential, setDefaultCredential] = useState<AwsCredential | null>(null);
  const [allCredentials, setAllCredentials] = useState<AwsCredential[]>([]);
  const [viewNotFound, setViewNotFound] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadView = async (signal?: AbortSignal) => {
    setIsLoadingView(true);
    setViewError("");
    setViewNotFound(false);
    setDeleteError("");

    try {
      const { credentials, defaultCredential: nextDefaultCredential } = await fetchAwsViewData(baseUrl, signal);
      setAllCredentials(credentials);
      setDefaultCredential(nextDefaultCredential);
      setViewNotFound(credentials.length === 0 && !nextDefaultCredential);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setDefaultCredential(null);
      setAllCredentials([]);
      setViewError(error instanceof Error ? error.message : "Unable to load AWS credentials.");
    } finally {
      setIsLoadingView(false);
    }
  };

  const syncCredentialsAfterDelete = (deletedCredentialId: string, clearDefault: boolean) => {
    const nextCredentials = allCredentials.filter((item) => item.credential_id !== deletedCredentialId);
    const nextDefaultCredential = clearDefault ? null : defaultCredential;

    setAllCredentials(nextCredentials);
    if (clearDefault) {
      setDefaultCredential(null);
    }
    setViewNotFound(nextCredentials.length === 0 && !nextDefaultCredential);
    setDeleteError("");
  };

  useEffect(() => {
    if (!isOpen) {
      setIsPreparingView(false);
      return;
    }

    setIsPreparingView(true);
    const timer = window.setTimeout(() => {
      setIsPreparingView(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !baseUrl) {
      return;
    }

    const controller = new AbortController();
    const runLoad = async () => {
      setIsLoadingView(true);
      setViewError("");
      setViewNotFound(false);
      setDeleteError("");

      try {
        const { credentials, defaultCredential: nextDefaultCredential } = await fetchAwsViewData(
          baseUrl,
          controller.signal
        );
        setAllCredentials(credentials);
        setDefaultCredential(nextDefaultCredential);
        setViewNotFound(credentials.length === 0 && !nextDefaultCredential);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setDefaultCredential(null);
        setAllCredentials([]);
        setViewError(error instanceof Error ? error.message : "Unable to load AWS credentials.");
      } finally {
        setIsLoadingView(false);
      }
    };

    void runLoad();

    return () => controller.abort();
  }, [baseUrl, isOpen]);

  if (isPreparingView) {
    return (
      <div className="rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] p-5">
        <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#475569]">
          <Loader2 className="h-4 w-4 animate-spin text-[#4f49e2]" />
          Loading AWS View Config...
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`aws-view-skeleton-${index}`}
              className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3"
            >
              <div className="h-3 w-24 rounded bg-[#ecf1fb]" />
              <div className="mt-2 h-4 w-3/4 rounded bg-[#ecf1fb]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isLoadingView) {
    return (
      <div className="rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] p-5">
        <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#475569]">
          <Loader2 className="h-4 w-4 animate-spin text-[#4f49e2]" />
          Loading AWS credentials...
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`aws-view-loading-skeleton-${index}`}
              className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3"
            >
              <div className="h-3 w-24 rounded bg-[#ecf1fb]" />
              <div className="mt-2 h-4 w-3/4 rounded bg-[#ecf1fb]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (viewError) {
    return (
      <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
        {viewError}
      </div>
    );
  }

  if (viewNotFound) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] px-6 py-8 text-center">
        <div className="max-w-sm">
          <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6def4] bg-[#eef2ff] text-[#4f49e2]">
            <CircleAlert className="h-5 w-5" />
          </span>
          <p className="mt-3 text-base font-semibold text-[#111827]">No AWS credentials found</p>
          <p className="mt-1 text-sm text-[#64748b]">
            Set Config to create your first AWS credential for this environment.
          </p>
        </div>
      </div>
    );
  }

  const secondaryCredentials = allCredentials.filter(
    (credential) => !defaultCredential || credential.credential_id !== defaultCredential.credential_id
  );

  return (
    <div className="space-y-4">
      {defaultCredential ? (
        <div className="overflow-hidden rounded-2xl border border-[#dfe6f5] bg-white shadow-[0_14px_35px_-30px_rgba(79,73,226,0.45)]">
          <UpdateAWSconfig
            baseUrl={baseUrl}
            credential={defaultCredential}
            title="Default AWS Credential"
            showCredentialIdField={false}
            onUpdated={() => void loadView()}
            onErrorChange={setDeleteError}
            deleteControl={
              <DeleteAWSconfig
                iconOnly
                baseUrl={baseUrl}
                credentialId={defaultCredential.credential_id}
                onDeleted={() => {
                  syncCredentialsAfterDelete(defaultCredential.credential_id, true);
                }}
                onErrorChange={setDeleteError}
              />
            }
          />
        </div>
      ) : (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] px-6 py-8 text-center shadow-[0_14px_35px_-30px_rgba(79,73,226,0.2)]">
          <div className="max-w-sm">
            <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6def4] bg-[#eef2ff] text-[#4f49e2]">
              <CircleAlert className="h-5 w-5" />
            </span>
            <p className="mt-3 text-base font-semibold text-[#111827]">No Default AWS Credentials</p>
            <p className="mt-1 text-sm text-[#64748b]">
              A default AWS credential is not configured yet. You can still manage saved credentials below.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#dfe6f5] bg-white shadow-[0_14px_35px_-30px_rgba(79,73,226,0.3)]">
        <div className="border-b border-[#eef1f7] bg-[#f8faff] px-4 py-3">
          <p className="text-sm font-semibold text-[#111827]">Non-Default AWS Credentials</p>
        </div>
        {secondaryCredentials.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[#64748b]">No secondary AWS credentials found.</div>
        ) : (
          <div className="divide-y divide-[#eef1f7]">
            {secondaryCredentials.map((credential) => (
              <div key={credential.credential_id} className="overflow-hidden">
                <UpdateAWSconfig
                  baseUrl={baseUrl}
                  credential={credential}
                  title={credential.name}
                  subtitle={credential.credential_id}
                  onUpdated={() => void loadView()}
                  onErrorChange={setDeleteError}
                  deleteControl={
                    <DeleteAWSconfig
                      iconOnly
                      baseUrl={baseUrl}
                      credentialId={credential.credential_id}
                      onDeleted={() => {
                        syncCredentialsAfterDelete(credential.credential_id, false);
                      }}
                      onErrorChange={setDeleteError}
                    />
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteError ? (
        <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
          {deleteError}
        </div>
      ) : null}
    </div>
  );
}
