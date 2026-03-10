"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LLM_MANAGER_API_BASE_URL } from "@/config/agent";
import LLMOverviewSection from "./LLMOverviewSection";
import LLMTableSection from "./LLMTableSection";
import CreateLlmModal, { type CreateLlmPayload } from "./createllm";
import {
  getErrorMessage,
  normalizeLlmRecord,
  type ActionResult,
  type LLMRecord,
} from "./llmHelpers";

const LLM_API_BASE = LLM_MANAGER_API_BASE_URL.endsWith("/")
  ? LLM_MANAGER_API_BASE_URL.slice(0, -1)
  : LLM_MANAGER_API_BASE_URL;
const LLM_LIST_URL = `${LLM_API_BASE}/llms/`;
const LLM_CREATE_URL = `${LLM_API_BASE}/llms/`;

export default function LLMManagementPage() {
  const [llms, setLlms] = useState<LLMRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const llmsRef = useRef<LLMRecord[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    llmsRef.current = llms;
  }, [llms]);

  const loadLlms = useCallback(
    async (options?: { signal?: AbortSignal; refresh?: boolean }) => {
      const requestId = ++requestIdRef.current;
      const hasData = llmsRef.current.length > 0;
      const shouldRefresh = Boolean(options?.refresh && hasData);

      if (shouldRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
        setLoadError("");
      }

      try {
        const response = await fetch(LLM_LIST_URL, {
          headers: { accept: "application/json" },
          signal: options?.signal,
        });
        const data = await response.json();

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (response.ok && Array.isArray(data)) {
          const normalized = data
            .map(normalizeLlmRecord)
            .filter((item): item is LLMRecord => item !== null);
          setLlms(normalized);
          setLoadError("");
        } else if (!shouldRefresh) {
          setLoadError(getErrorMessage(data, "Unable to load LLMs."));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!shouldRefresh) {
          setLoadError("Unable to load LLMs.");
        }
      } finally {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (shouldRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    loadLlms({ signal: controller.signal });
    return () => controller.abort();
  }, [loadLlms]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadLlms({ refresh: true });
      }
    };
    const handleFocus = () => loadLlms({ refresh: true });

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadLlms]);

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }
    const timer = setTimeout(() => {
      setIsToastVisible(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isToastVisible]);

  const handleCreateLlm = async (
    payload: CreateLlmPayload
  ): Promise<ActionResult> => {
    try {
      const response = await fetch(LLM_CREATE_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        return { ok: false, error: getErrorMessage(data, "Unable to create LLM.") };
      }

      setToastMessage("LLM created successfully.");
      setIsToastVisible(true);
      await loadLlms({ refresh: true });
      return { ok: true };
    } catch {
      return { ok: false, error: "Unable to create LLM." };
    }
  };

  const handleDeleteModel = async (modelId: string): Promise<ActionResult> => {
    try {
      const response = await fetch(
        `${LLM_API_BASE}/llms/${encodeURIComponent(modelId)}`,
        {
          method: "DELETE",
          headers: { accept: "application/json" },
        }
      );

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      const isDeleteOk =
        response.ok &&
        Boolean(
          data &&
            typeof data === "object" &&
            "ok" in data &&
            (data as { ok?: unknown }).ok === true
        );

      if (!isDeleteOk) {
        return { ok: false, error: getErrorMessage(data, "Unable to delete LLM.") };
      }

      setToastMessage("LLM deleted successfully.");
      setIsToastVisible(true);
      await loadLlms({ refresh: true });
      return { ok: true };
    } catch {
      return { ok: false, error: "Unable to delete LLM." };
    }
  };

  return (
    <div className="space-y-8">
      <LLMOverviewSection
        llms={llms}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRefresh={() => loadLlms({ refresh: true })}
        onCreateClick={() => setIsCreateOpen(true)}
      />

      <LLMTableSection
        llms={llms}
        isLoading={isLoading}
        loadError={loadError}
        onDeleteModel={handleDeleteModel}
      />

      {isCreateOpen ? (
        <CreateLlmModal
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreateLlm}
        />
      ) : null}

      {isToastVisible ? (
        <div className="fixed bottom-6 right-6 z-[80]">
          <div className="toast-fade relative rounded-2xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(79,73,226,0.8)]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4 items-center justify-center rounded-full border-2 border-white/60">
                <span className="toast-dot-fill absolute inset-0 rounded-full bg-white" />
              </span>
              <span>{toastMessage}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-2xl bg-white/25">
              <span className="toast-progress-bar block h-full w-full bg-white/70" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
