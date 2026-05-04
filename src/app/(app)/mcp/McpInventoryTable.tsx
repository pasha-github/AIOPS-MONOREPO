"use client";

import { Check, ExternalLink, X } from "lucide-react";

import McpActionMenu from "./McpActionMenu";
import { formatDateTime, type McpServer } from "./mcpHelpers";

type McpInventoryTableProps = {
  servers: McpServer[];
  isLoading: boolean;
  loadError: string;
  selectedServerId: string | null;
  onViewServer: (server: McpServer) => void;
  onUpdateServer: (server: McpServer) => void;
  onDeleteServer: (server: McpServer) => void;
};

const COLUMN_TEMPLATE =
  "minmax(240px,1.55fr) minmax(300px,1.95fr) minmax(220px,1.2fr) minmax(180px,0.95fr) minmax(180px,1fr) minmax(120px,0.8fr)";

export default function McpInventoryTable({
  servers,
  isLoading,
  loadError,
  selectedServerId,
  onViewServer,
  onUpdateServer,
  onDeleteServer,
}: McpInventoryTableProps) {
  return (
    <section className="">
      <div className="overflow-x-auto rounded-2xl border border-[#eef1f7]">
        {isLoading ? (
          <div className="bg-white">
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

            <div className="divide-y divide-[#eef1f7]">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`mcp-skeleton-${index}`}
                  className="grid animate-pulse items-center divide-x divide-[#e8eef7] px-4 py-4"
                  style={{
                    gridTemplateColumns: COLUMN_TEMPLATE,
                  }}
                >
                  <div className="space-y-2 px-4">
                    <div className="h-4 w-40 rounded bg-[#edf2f9]" />
                    <div className="h-3 w-56 rounded bg-[#edf2f9]" />
                    <div className="h-3 w-48 rounded bg-[#edf2f9]" />
                  </div>
                  <div className="space-y-2 px-4">
                    <div className="h-4 w-full rounded bg-[#edf2f9]" />
                    <div className="h-4 w-4/5 rounded bg-[#edf2f9]" />
                  </div>
                  <div className="space-y-2 px-4">
                    <div className="h-4 w-20 rounded bg-[#edf2f9]" />
                    <div className="h-3 w-32 rounded bg-[#edf2f9]" />
                  </div>
                  <div className="flex justify-center px-4">
                    <div className="h-7 w-28 rounded-full bg-[#edf2f9]" />
                  </div>
                  <div className="px-4">
                    <div className="h-4 w-28 rounded bg-[#edf2f9]" />
                  </div>
                  <div className="flex justify-end px-3">
                    <div className="h-10 w-20 rounded-xl bg-[#edf2f9]" />
                  </div>
                </div>
              ))}
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
        ) : servers.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center bg-white px-6 text-center">
            <div>
              <p className="text-base font-semibold text-[#111827]">
                No MCP servers found
              </p>
              <p className="mt-2 text-sm text-[#64748b]">
                Register a server to see it here.
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
              {servers.map((server) => {
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
                      {server.has_auth_secret ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#16a34a]">
                          <Check className="h-4 w-4" />
                          Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748b]">
                          <X className="h-4 w-4 text-[#ef4444]" />
                          Not set
                        </span>
                      )}
                    </div>

                    <div className="px-4 text-[#4b5563]">
                      {formatDateTime(server.updated_at)}
                    </div>

                    <div className="flex justify-end px-3">
                      <McpActionMenu
                        server={server}
                        onView={onViewServer}
                        onUpdate={onUpdateServer}
                        onDelete={onDeleteServer}
                      />
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
