"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { useCallback, useEffect, useRef, useState } from "react";
import LLMOverviewSection from "./LLMOverviewSection";
import LLMTableSection from "./LLMTableSection";
import CreateLlmModal, { type CreateLlmPayload } from "./createllm";
import {
  getErrorMessage,
  normalizeLlmDefaults,
  normalizeLlmRecord,
  type ActionResult,
  type LlmDefaults,
  type LlmDefaultSlot,
  type LLMRecord,
} from "./llmHelpers";

export default function LLMManagementPage() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const llmApiBase = trimTrailingSlash(llmManagerApiBaseUrl);
  const llmListUrl = `${llmApiBase}/llms/`;
  const llmCreateUrl = `${llmApiBase}/llms/`;
  const llmDefaultsUrl = `${llmApiBase}/llms/defaults`;
  const [llms, setLlms] = useState<LLMRecord[]>([]);
  const [defaults, setDefaults] = useState<LlmDefaults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDefaultsLoading, setIsDefaultsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [defaultsError, setDefaultsError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingDefaultSlot, setUpdatingDefaultSlot] =
    useState<LlmDefaultSlot | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const llmsRef = useRef<LLMRecord[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    llmsRef.current = llms;
  }, [llms]);

  const loadDefaults = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!options?.silent) {
        setIsDefaultsLoading(true);
        setDefaultsError("");
      }

      try {
        const response = await fetch(llmDefaultsUrl, {
          headers: { accept: "application/json" },
          signal: options?.signal,
        });

        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          if (!options?.silent) {
            setDefaultsError(
              getErrorMessage(data, "Unable to load default LLM selection.")
            );
          }
          return;
        }

        const normalized = normalizeLlmDefaults(data);
        if (!normalized) {
          if (!options?.silent) {
            setDefaultsError("Unable to load default LLM selection.");
          }
          return;
        }

        setDefaults(normalized);
        setDefaultsError("");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!options?.silent) {
          setDefaultsError("Unable to load default LLM selection.");
        }
      } finally {
        if (!options?.silent) {
          setIsDefaultsLoading(false);
        }
      }
    },
    [llmDefaultsUrl]
  );

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
        const response = await fetch(llmListUrl, {
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
    [llmListUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadLlms({ signal: controller.signal });
    loadDefaults({ signal: controller.signal });
    return () => controller.abort();
  }, [loadDefaults, loadLlms]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadLlms({ refresh: true });
        loadDefaults({ silent: true });
      }
    };
    const handleFocus = () => {
      loadLlms({ refresh: true });
      loadDefaults({ silent: true });
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadDefaults, loadLlms]);

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
      const response = await fetch(llmCreateUrl, {
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
        `${llmApiBase}/llms/${encodeURIComponent(modelId)}`,
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
      await Promise.all([loadLlms({ refresh: true }), loadDefaults()]);
      return { ok: true };
    } catch {
      return { ok: false, error: "Unable to delete LLM." };
    }
  };

  const handleDefaultChange = async (
    slot: LlmDefaultSlot,
    modelId: string
  ): Promise<ActionResult> => {
    const nextModelId = modelId.trim();
    if (!nextModelId) {
      return { ok: false, error: "Please select a model." };
    }

    const payloadKey = `${slot}_model_id` as const;
    setUpdatingDefaultSlot(slot);
    setDefaultsError("");

    try {
      const response = await fetch(llmDefaultsUrl, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [payloadKey]: nextModelId }),
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorMessage = getErrorMessage(
          data,
          "Unable to update default LLM."
        );
        setDefaultsError(errorMessage);
        return { ok: false, error: errorMessage };
      }

      const normalized = normalizeLlmDefaults(data);
      if (normalized) {
        setDefaults(normalized);
      } else {
        setDefaults((current) =>
          current
            ? { ...current, [payloadKey]: nextModelId }
            : {
                id: null,
                primary_model_id:
                  slot === "primary" ? nextModelId : null,
                secondary_model_id:
                  slot === "secondary" ? nextModelId : null,
                tertiary_model_id:
                  slot === "tertiary" ? nextModelId : null,
              }
        );
      }

      setToastMessage(
        `${slot[0].toUpperCase()}${slot.slice(1)} LLM updated successfully.`
      );
      setIsToastVisible(true);
      return { ok: true };
    } catch {
      const errorMessage = "Unable to update default LLM.";
      setDefaultsError(errorMessage);
      return { ok: false, error: errorMessage };
    } finally {
      setUpdatingDefaultSlot(null);
    }
  };

  return (
    <div className="space-y-8">
      <LLMOverviewSection
        llms={llms}
        defaults={defaults}
        isLoading={isLoading}
        isDefaultsLoading={isDefaultsLoading}
        isRefreshing={isRefreshing}
        defaultsError={defaultsError}
        updatingDefaultSlot={updatingDefaultSlot}
        onRefresh={async () => {
          await Promise.all([
            loadLlms({ refresh: true }),
            loadDefaults(),
          ]);
        }}
        onCreateClick={() => setIsCreateOpen(true)}
        onDefaultChange={handleDefaultChange}
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
