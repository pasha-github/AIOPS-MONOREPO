"use client";

import { CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import DeleteConfigButton from "./DeleteConfigButton";
import type { ProviderKey, VertexConfigView } from "./types";
import { formatDateTime, getErrorDetail } from "./utils";

type ViewConfigProps = {
  isOpen: boolean;
  provider: ProviderKey;
  baseUrl: string;
};

export default function ViewConfig({ isOpen, provider, baseUrl }: ViewConfigProps) {
  const isVertex = provider === "vertex";
  const [isPreparingView, setIsPreparingView] = useState(true);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewData, setViewData] = useState<VertexConfigView | null>(null);
  const [viewNotFound, setViewNotFound] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!isOpen || !isVertex) {
      setIsPreparingView(false);
      return;
    }

    setIsPreparingView(true);
    const timer = window.setTimeout(() => {
      setIsPreparingView(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isOpen, isVertex]);

  useEffect(() => {
    if (!isOpen || !isVertex || !baseUrl) {
      return;
    }

    const controller = new AbortController();

    const loadView = async () => {
      setIsLoadingView(true);
      setViewError("");
      setViewNotFound(false);
      setDeleteError("");

      try {
        const response = await fetch(`${baseUrl}/vertex/config/`, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as
          | VertexConfigView
          | { detail?: string }
          | null;

        if (!response.ok) {
          const detail = payload && typeof payload === "object" ? (payload as { detail?: string }).detail : "";
          if (detail === "Vertex config not found") {
            setViewData(null);
            setViewNotFound(true);
            return;
          }
          throw new Error(getErrorDetail(payload, "Unable to load Vertex config."));
        }

        if (payload && typeof payload === "object" && "id" in payload) {
          setViewData(payload as VertexConfigView);
          setViewNotFound(false);
          return;
        }

        setViewData(null);
        setViewNotFound(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setViewData(null);
        setViewError(error instanceof Error ? error.message : "Unable to load Vertex config.");
      } finally {
        setIsLoadingView(false);
      }
    };

    void loadView();

    return () => controller.abort();
  }, [baseUrl, isOpen, isVertex]);

  if (!isVertex) {
    return (
      <div className="rounded-xl border border-[#e5eaf4] bg-[#f8fafc] px-4 py-5 text-sm text-[#475569]">
        View configuration is not connected for this provider yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isPreparingView ? (
        <div className="rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] p-5">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#475569]">
            <Loader2 className="h-4 w-4 animate-spin text-[#4f49e2]" />
            Loading View Config...
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`view-config-prepare-skeleton-${index}`}
                className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3"
              >
                <div className="h-3 w-24 rounded bg-[#ecf1fb]" />
                <div className="mt-2 h-4 w-3/4 rounded bg-[#ecf1fb]" />
              </div>
            ))}
          </div>
        </div>
      ) : isLoadingView ? (
        <div className="rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] p-5">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#475569]">
            <Loader2 className="h-4 w-4 animate-spin text-[#4f49e2]" />
            Loading Vertex config...
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`view-config-skeleton-${index}`}
                className="animate-pulse rounded-xl border border-[#e9eef8] bg-white p-3"
              >
                <div className="h-3 w-24 rounded bg-[#ecf1fb]" />
                <div className="mt-2 h-4 w-3/4 rounded bg-[#ecf1fb]" />
              </div>
            ))}
          </div>
        </div>
      ) : viewError ? (
        <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
          {viewError}
        </div>
      ) : viewNotFound || !viewData ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-[#dfe6f5] bg-gradient-to-b from-white to-[#f8faff] px-6 py-8 text-center">
          <div className="max-w-sm">
            <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6def4] bg-[#eef2ff] text-[#4f49e2]">
              <CircleAlert className="h-5 w-5" />
            </span>
            <p className="mt-3 text-base font-semibold text-[#111827]">No Vertex config found</p>
            <p className="mt-1 text-sm text-[#64748b]">
              Set Config to create your first Vertex configuration for this environment.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#dfe6f5] bg-white shadow-[0_14px_35px_-30px_rgba(79,73,226,0.45)]">
          <div className="flex items-center justify-between border-b border-[#eef1f7] bg-[#f8faff] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#111827]">Vertex Configuration</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold ">
                {viewData.has_google_application_credentials ? "Credentials configured" : "Credentials missing"}
              </span>
            <div className="inline-flex items-center gap-2">
              <DeleteConfigButton
                iconOnly
                baseUrl={baseUrl}
                disabled={!viewData}
                onDeleted={() => {
                  setViewData(null);
                  setViewNotFound(true);
                  setDeleteError("");
                }}
                onErrorChange={setDeleteError}
              />
              
            </div>
          </div>
          <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
            <div className="rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Project ID</p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-[#111827]">
                {viewData.project_id}
              </p>
            </div>
            <div className="rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Location</p>
              <p className="mt-1 text-sm text-[#111827]">{viewData.location}</p>
            </div>
            <div className="rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Staging Bucket</p>
              <p className="mt-1 text-sm text-[#111827]">{viewData.staging_bucket}</p>
            </div>
            <div className="rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Credentials</p>
              <p className="mt-1 text-sm text-[#111827]">
                {viewData.has_google_application_credentials ? "Configured" : "Not configured"}
              </p>
            </div>
            <div className="rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Created At</p>
              <p className="mt-1 text-sm text-[#111827]">{formatDateTime(viewData.created_at)}</p>
            </div>
            <div className="rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Updated At</p>
              <p className="mt-1 text-sm text-[#111827]">{formatDateTime(viewData.updated_at)}</p>
            </div>
          </div>
        </div>
      )}

      {deleteError ? (
        <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
          {deleteError}
        </div>
      ) : null}

    </div>
  );
}
