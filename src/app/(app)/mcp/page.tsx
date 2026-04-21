"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Boxes, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import McpDetailsDrawer from "./McpDetailsDrawer";
import McpInventoryTable from "./McpInventoryTable";
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const serversRef = useRef<McpServer[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  const loadServers = useCallback(
    async (options?: { signal?: AbortSignal; refresh?: boolean }) => {
      const requestId = ++requestIdRef.current;
      const hasData = serversRef.current.length > 0;
      const shouldRefresh = Boolean(options?.refresh && hasData);

      if (shouldRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
        setLoadError("");
      }

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
          if (!shouldRefresh) {
            setLoadError(getMcpErrorMessage(data, "Unable to load MCP servers."));
          }
          return;
        }

        if (!Array.isArray(data)) {
          if (!shouldRefresh) {
            setLoadError("Unable to load MCP servers.");
          }
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
        if (!shouldRefresh) {
          setLoadError("Unable to load MCP servers.");
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
        loadServers({ refresh: true });
      }
    };

    const handleFocus = () => loadServers({ refresh: true });
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadServers]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h2 className="flex items-center gap-3 text-2xl font-semibold text-[#111827]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
                <Boxes className="h-5 w-5" />
              </span>
              Model Context Protocol
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5b6476]">
              Maintain a professional inventory of MCP servers, authentication setup,
              transport metadata, tools, resources, and full input schemas through a
              single master-detail view.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadServers({ refresh: true })}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_10px_20px_-16px_rgba(79,73,226,0.5)] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing || isLoading ? "animate-spin" : ""}`}
            />
            Refresh MCP
          </button>
        </div>
      </section>

      <McpInventoryTable
        servers={servers}
        isLoading={isLoading}
        loadError={loadError}
        selectedServerId={selectedServer?.mcp_server_id ?? null}
        onSelectServer={setSelectedServer}
      />

      <McpDetailsDrawer
        server={selectedServer}
        onClose={() => setSelectedServer(null)}
      />
    </div>
  );
}
