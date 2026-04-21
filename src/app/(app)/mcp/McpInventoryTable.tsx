"use client";

import { ChevronRight, ExternalLink, Loader2, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { formatDateTime, type McpServer } from "./mcpHelpers";

type McpInventoryTableProps = {
  servers: McpServer[];
  isLoading: boolean;
  loadError: string;
  selectedServerId: string | null;
  onSelectServer: (server: McpServer) => void;
};

const COLUMN_TEMPLATE =
  "minmax(240px,1.55fr) minmax(300px,1.95fr) minmax(220px,1.2fr) minmax(180px,0.95fr) minmax(180px,1fr) minmax(120px,0.8fr)";

export default function McpInventoryTable({
  servers,
  isLoading,
  loadError,
  selectedServerId,
  onSelectServer,
}: McpInventoryTableProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredServers = useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();
    if (!normalized) {
      return servers;
    }

    return servers.filter((server) =>
      [
        server.name,
        server.server_url,
        server.description,
        server.auth_type,
        server.auth_username,
        server.metadata.name,
        server.metadata.transport,
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [searchValue, servers]);

  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#111827]">MCP Inventory</h3>
          <p className="mt-1 text-sm text-[#5b6476]">
            Review all server, auth, metadata, tool, and schema details from one place.
          </p>
        </div>

        <div
          className={`flex items-center gap-2 rounded-xl bg-[#eef2ff] px-4 py-2 text-sm text-[#4f49e2] transition-all duration-200 ${
            isSearchFocused ? "w-80" : "w-64"
          }`}
        >
          <Search className="h-4 w-4" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search MCP servers.."
            className="w-full bg-transparent text-sm text-[#4f49e2] placeholder:text-[#4f49e2] focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-[#eef1f7]">
        {isLoading ? (
          <div className="flex min-h-[260px] items-center justify-center bg-white">
            <div className="flex items-center gap-3 text-sm font-semibold text-[#4f49e2]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading MCP servers
            </div>
          </div>
        ) : loadError ? (
          <div className="flex min-h-[260px] items-center justify-center bg-white px-6 text-center">
            <div>
              <p className="text-base font-semibold text-[#111827]">
                Unable to load MCP servers
              </p>
              <p className="mt-2 text-sm text-[#dc2626]">{loadError}</p>
            </div>
          </div>
        ) : filteredServers.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center bg-white px-6 text-center">
            <div>
              <p className="text-base font-semibold text-[#111827]">
                No MCP servers found
              </p>
              <p className="mt-2 text-sm text-[#64748b]">
                Adjust the search or register a server in the backend.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-[1240px]">
            <div
              className="grid items-center divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#111827]"
              style={{
                gridTemplateColumns: COLUMN_TEMPLATE,
              }}
            >
              <span className="px-4">Server</span>
              <span className="px-4">Description</span>
              <span className="px-4">Auth</span>
              <span className="px-4 text-center">Secret</span>
              <span className="px-4">Updated</span>
              <span className="px-3 text-right">Action</span>
            </div>

            <div className="divide-y divide-[#eef1f7] bg-white">
              {filteredServers.map((server) => {
                const isSelected = selectedServerId === server.mcp_server_id;

                return (
                  <div
                    key={server.mcp_server_id}
                    className={`grid items-center divide-x divide-[#e8eef7] px-4 py-4 text-sm text-[#2b3341] transition-colors ${
                      isSelected ? "bg-[#f8f9ff]" : "hover:bg-[#f8f9fd]"
                    }`}
                    style={{
                      gridTemplateColumns: COLUMN_TEMPLATE,
                    }}
                  >
                    <div className="px-4">
                      <p className="font-semibold text-[#111827]">{server.name}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-[#64748b]">
                        <span className="break-all">{server.mcp_server_id}</span>
                      </div>
                      <a
                        href={server.server_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex max-w-full items-center gap-1 text-xs font-medium text-[#4f49e2] hover:underline"
                      >
                        <span className="break-all">{server.server_url}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    </div>

                    <div className="px-4 text-[#4b5563]">{server.description}</div>

                    <div className="px-4">
                      <p className="font-semibold text-[#111827]">{server.auth_type}</p>
                      <p className="mt-1 break-all text-xs text-[#64748b]">
                        {server.auth_username}
                      </p>
                    </div>

                    <div className="flex justify-center px-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                          server.has_auth_secret
                            ? "bg-[#dcfce7] text-[#15803d]"
                            : "bg-[#f3f4f6] text-[#64748b]"
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {server.has_auth_secret ? "Configured" : "Not set"}
                      </span>
                    </div>

                    <div className="px-4 text-[#4b5563]">
                      {formatDateTime(server.updated_at)}
                    </div>

                    <div className="flex justify-end px-3">
                      <button
                        type="button"
                        onClick={() => onSelectServer(server)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#dbe2f0] bg-white px-3 py-2 text-sm font-semibold text-[#4f49e2] transition hover:bg-[#eef2ff]"
                      >
                        View
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
