"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CreateMcpModal, {
  type CreateMcpPayload,
  type McpActionResult,
} from "./CreateMcpModal";
import McpDetailsDrawer from "./McpDetailsDrawer";
import McpInventoryTable from "./McpInventoryTable";
import UpdateMcpModal from "./UpdateMcpModal";
import {
  getMcpErrorMessage,
  normalizeMcpServer,
  type McpServer,
} from "./mcpHelpers";

const resolveMcpApiBaseUrl = (value: string) => {
  const trimmed = trimTrailingSlash(value.trim());
  if (!trimmed) {
    throw new Error("NEXT_PUBLIC_LLM_MANAGER_API_BASE_URL is not configured.");
  }

  return trimmed;
};

export default function McpPage() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const mcpApiBase = resolveMcpApiBaseUrl(llmManagerApiBaseUrl);
  const mcpListUrl = `${mcpApiBase}/mcp/`;

  const [servers, setServers] = useState<McpServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<McpServer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const serversRef = useRef<McpServer[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  const loadServers = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await fetch(mcpListUrl, {
          headers: { accept: "application/json" },
          signal: options?.signal,
        });

        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok) {
          setLoadError(getMcpErrorMessage(data, "Unable to load MCP servers."));
          return;
        }

        if (!Array.isArray(data)) {
          setLoadError("Unable to load MCP servers.");
          return;
        }

        const normalized = data
          .map(normalizeMcpServer)
          .filter((server): server is McpServer => server !== null);

        setServers(normalized);
        setLoadError("");
        setSelectedServer((current) =>
          current
            ? normalized.find(
                (server) => server.mcp_server_id === current.mcp_server_id
              ) ?? null
            : null
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setLoadError("Unable to load MCP servers.");
      } finally {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setIsLoading(false);
      }
    },
    [mcpListUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadServers({ signal: controller.signal });
    return () => controller.abort();
  }, [loadServers]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadServers();
      }
    };

    const handleFocus = () => loadServers();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadServers]);

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }

    const timer = setTimeout(() => setIsToastVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [isToastVisible]);

  const summaryItems = useMemo(
    () => [
      { label: "Registered servers", value: servers.length },
      {
        label: "Available tools",
        value: servers.reduce((sum, server) => sum + server.metadata.tool_count, 0),
      },
      {
        label: "Secret coverage",
        value:
          servers.length > 0
            ? `${servers.filter((server) => server.has_auth_secret).length}/${servers.length}`
            : "0/0",
      },
      {
        label: "Transport types",
        value: new Set(
          servers.map((server) => server.metadata.transport).filter(Boolean)
        ).size,
      },
    ],
    [servers]
  );

  const handleCreateServer = async (
    payload: CreateMcpPayload
  ): Promise<McpActionResult> => {
    try {
      const response = await fetch(`${mcpApiBase}/mcp/`, {
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
        return {
          ok: false,
          error: getMcpErrorMessage(data, "Unable to create MCP server."),
        };
      }

      await loadServers();
      return { ok: true };
    } catch {
      return { ok: false, error: "Unable to create MCP server." };
    }
  };

  const handleDeleteServer = async (): Promise<void> => {
    if (!deleteTarget || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(
        `${mcpApiBase}/mcp/${encodeURIComponent(deleteTarget.mcp_server_id)}`,
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

      if (!response.ok) {
        setDeleteError(getMcpErrorMessage(data, "Unable to delete MCP server."));
        setIsDeleting(false);
        return;
      }

      setDeleteTarget(null);
      setToastMessage("MCP server deleted successfully.");
      setIsToastVisible(true);
      await loadServers();
    } catch {
      setDeleteError("Unable to delete MCP server.");
    } finally {
      setIsDeleting(false);
    }
  };

  const mcpLogoSrc = "/img/mcp.png";
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            <h2 className="flex items-center gap-3 text-2xl font-semibold text-[#111827]">
              <span className="flex h-11 w-11">
                <img
                  src={mcpLogoSrc}
                />
              </span>
              Model Context Protocol
            </h2>
            <p className="text-sm leading-6 text-[#5b6476]">
              Maintain a professional inventory of MCP servers, authentication setup,
              transport metadata, tools, resources, and full input schemas through a
              single master-detail view.
            </p>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex flex-wrap">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="min-w-[120px] border-r border-[#e8edf7] px-5 last:border-r-0"
                >
                  <p className="text-xs font-medium text-[#8b95ad]">{item.label}</p>
                  <div className="mt-1 min-h-[40px]">
                    {isLoading ? (
                      <Loader2 className="h-7 w-7 animate-spin text-[#4f49e2]" />
                    ) : (
                      <p className="text-3xl font-semibold tracking-tight text-[#111827]">
                        {item.value}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)] transition hover:bg-[#3f39d6] active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Register MCP Server
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
        <div className="space-y-6">
        <div className="max-w-3xl">
          <h3 className="flex items-center gap-3 text-lg font-semibold text-[#111827]">
            <img
              src={mcpLogoSrc}
              className="h-9 w-9 rounded-xl object-contain"
              loading="lazy"
              alt="MCP logo"
            />
            MCP Inventory
          </h3>
          <p className="mt-1 text-sm text-[#5b6476]">
            Review all server, auth, metadata, tool, and schema details from one place.
          </p>
        </div>

        <McpInventoryTable
          servers={servers}
          isLoading={isLoading}
          loadError={loadError}
          selectedServerId={selectedServer?.mcp_server_id ?? null}
          onViewServer={setSelectedServer}
          onUpdateServer={(server) => setUpdateTargetId(server.mcp_server_id)}
          onDeleteServer={setDeleteTarget}
        />
        </div>
      </section>

      <McpDetailsDrawer
        server={selectedServer}
        onClose={() => setSelectedServer(null)}
      />

      {isCreateOpen ? (
        <CreateMcpModal
          mcpApiBase={mcpApiBase}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreateServer}
          onCreateSuccess={() => {
            setToastMessage("MCP server created successfully.");
            setIsToastVisible(true);
          }}
        />
      ) : null}

      {updateTargetId ? (
        <UpdateMcpModal
          mcpServerId={updateTargetId}
          mcpApiBase={mcpApiBase}
          onClose={() => setUpdateTargetId(null)}
          onUpdated={async () => {
            await loadServers();
          }}
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

      {deleteTarget ? (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#fee2e2] bg-[#fff5f5] px-6 py-4">
              <div className="flex items-center gap-2 text-[#b91c1c]">
                <Trash2 className="h-5 w-5" />
                <h4 className="text-lg font-semibold">Delete MCP Server</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                    setDeleteError("");
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b91c1c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#374151]">
                Are you sure you want to delete this MCP server?
              </p>
              <p className="mt-2 max-w-full break-all rounded-md bg-[#fee2e2] px-2 py-1 font-semibold text-[#b91c1c]">
                {deleteTarget.name}
              </p>
              <p className="mt-3 text-xs text-[#9b1c1c]">
                This action cannot be undone.
              </p>
              {deleteError ? (
                <p className="mt-3 text-sm text-[#dc2626]">{deleteError}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                    setDeleteError("");
                  }
                }}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteServer()}
                disabled={isDeleting}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] ${
                  isDeleting
                    ? "cursor-not-allowed bg-[#fca5a5]"
                    : "bg-[#ef4444] hover:bg-[#dc2626]"
                }`}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
