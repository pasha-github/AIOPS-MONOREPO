"use client";

import {
  ChevronDown,
  ChevronRight,
  Database,
  FileJson,
  Server,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  formatDateTime,
  getSchemaPropertyEntries,
  getSchemaRequiredFields,
  type McpServer,
  type McpTool,
} from "./mcpHelpers";

type McpDetailsDrawerProps = {
  server: McpServer | null;
  onClose: () => void;
};

type TreeSectionProps = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isOpen: boolean;
  onToggle: (id: string) => void;
  badge?: string | number;
  children: React.ReactNode;
};

function TreeSection({
  id,
  title,
  icon: Icon,
  isOpen,
  onToggle,
  badge,
  children,
}: TreeSectionProps) {
  return (
    <section className="border-b border-[#edf1f7] last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="group flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f49e2]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="relative inline-block text-sm font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              {title}
              <span className="absolute -bottom-1 left-0 h-[2px] w-full origin-right scale-x-0 bg-[#4f49e2] transition-transform duration-300 ease-out group-hover:origin-left group-hover:scale-x-100" />
            </p>
          </div>
          {badge !== undefined ? (
            <span className="rounded-md border border-[#d9defb] bg-[#f7f8ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f49e2]">
              {badge}
            </span>
          ) : null}
        </div>

        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#64748b]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[#64748b]" />
        )}
      </button>

      {isOpen ? <div className="pb-4 pl-11">{children}</div> : null}
    </section>
  );
}

function KeyValueRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 border-l border-[#dbe2f0] py-3 pl-4 ${
        multiline ? "grid-cols-1" : "grid-cols-[180px_minmax(0,1fr)]"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b95ad]">
        {label}
      </div>
      <div className="min-w-0 break-words text-sm text-[#111827]">{value}</div>
    </div>
  );
}

function ToolTree({
  tool,
  isOpen,
  onToggle,
}: {
  tool: McpTool;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const requiredFields = getSchemaRequiredFields(tool.input_schema);
  const propertyEntries = getSchemaPropertyEntries(tool.input_schema);

  return (
    <div className="border-l border-[#dbe2f0] pl-4">
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-start justify-between gap-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="relative inline-block text-sm font-semibold text-[#111827]">
            {tool.name}
            <span className="absolute -bottom-1 left-0 h-[2px] w-full origin-right scale-x-0 bg-[#4f49e2] transition-transform duration-300 ease-out group-hover:origin-left group-hover:scale-x-100" />
          </p>
          <p className="mt-1 text-sm leading-6 text-[#5b6476]">
            {tool.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-md border border-[#d9defb] bg-[#f7f8ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f49e2]">
            {propertyEntries.length} fields
          </span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-[#64748b]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#64748b]" />
          )}
        </div>
      </button>

      {isOpen ? (
        <div className="pb-3 pl-4">
          <KeyValueRow label="Schema type" value={tool.input_schema?.type ?? "-"} />
          <KeyValueRow
            label="Additional properties"
            value={tool.input_schema?.additionalProperties === false ? "No" : "Yes"}
          />
          <KeyValueRow
            label="Required fields"
            value={
              requiredFields.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {requiredFields.map((field) => (
                    <span
                      key={field}
                      className="rounded-full bg-[#f3f6fb] px-3 py-1 text-xs font-semibold text-[#334155]"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              ) : (
                "No required fields"
              )
            }
            multiline
          />
          <KeyValueRow
            label="Input schema"
            value={
              propertyEntries.length > 0 ? (
                <div className="space-y-3">
                  {propertyEntries.map(({ name, definition }) => (
                    <div key={name} className="border-l border-[#e2e8f0] pl-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#111827]">{name}</p>
                        <span className="rounded-md border border-[#d9defb] bg-[#f7f8ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f49e2]">
                          {typeof definition.type === "string"
                            ? definition.type
                            : Array.isArray(definition.anyOf)
                              ? "composite"
                              : "-"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#5b6476]">
                        {String(definition.description ?? "No description provided.")}
                      </p>
                      <pre className="mt-2 overflow-x-auto rounded-xl bg-[#0f172a] p-4 text-xs leading-6 text-[#e2e8f0]">
                        {JSON.stringify(definition, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                "No input schema available"
              )
            }
            multiline
          />
        </div>
      ) : null}
    </div>
  );
}

export default function McpDetailsDrawer({
  server,
  onClose,
}: McpDetailsDrawerProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: false,
    metadata: false,
    tools: false,
    resources: false,
  });
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});

  const resourceJson = useMemo(
    () => (server ? JSON.stringify(server.resources, null, 2) : "[]"),
    [server]
  );

  if (!server) {
    return null;
  }

  const toggleSection = (id: string) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const toggleTool = (toolName: string) => {
    setOpenTools((current) => ({ ...current, [toolName]: !current[toolName] }));
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
      <div className="flex h-[88vh] w-full max-w-[960px] flex-col overflow-hidden rounded-[32px] border border-[#e5e7eb] bg-[#fcfdff] shadow-[0_24px_70px_-34px_rgba(15,23,42,0.6)]">
        <div className="border-b border-[#eef1f7] bg-white px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
                  <Server className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-semibold text-[#111827]">
                    {server.name}
                  </h3>
                  <p className="mt-1 break-all text-sm text-[#5b6476]">
                    {server.server_url}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#4b5563]">
                {server.description}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#64748b] transition hover:bg-[#f8fafc]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="soft-scrollbar flex-1 overflow-y-auto px-7 py-4">
          <TreeSection
            id="overview"
            title="Server overview"
            icon={ShieldCheck}
            isOpen={Boolean(openSections.overview)}
            onToggle={toggleSection}
          >
            <KeyValueRow label="Server ID" value={server.mcp_server_id} />
            <KeyValueRow label="Auth type" value={server.auth_type} />
            <KeyValueRow label="Auth username" value={server.auth_username} />
            <KeyValueRow
              label="Secret configured"
              value={server.has_auth_secret ? "Yes" : "No"}
            />
            <KeyValueRow label="Created at" value={formatDateTime(server.created_at)} />
            <KeyValueRow label="Updated at" value={formatDateTime(server.updated_at)} />
          </TreeSection>

          <TreeSection
            id="metadata"
            title="Metadata"
            icon={Database}
            isOpen={Boolean(openSections.metadata)}
            onToggle={toggleSection}
          >
            <KeyValueRow label="Metadata name" value={server.metadata.name} />
            <KeyValueRow label="Transport" value={server.metadata.transport} />
            <KeyValueRow label="Tool count" value={server.metadata.tool_count} />
            <KeyValueRow
              label="Resource count"
              value={server.metadata.resource_count}
            />
          </TreeSection>

          <TreeSection
            id="tools"
            title="Tools"
            icon={Wrench}
            badge={server.tools.length}
            isOpen={Boolean(openSections.tools)}
            onToggle={toggleSection}
          >
            {server.tools.length > 0 ? (
              <div className="space-y-1">
                {server.tools.map((tool) => (
                  <ToolTree
                    key={tool.name}
                    tool={tool}
                    isOpen={Boolean(openTools[tool.name])}
                    onToggle={() => toggleTool(tool.name)}
                  />
                ))}
              </div>
            ) : (
              <KeyValueRow
                label="State"
                value="No tools are registered for this MCP server."
              />
            )}
          </TreeSection>

          <TreeSection
            id="resources"
            title="Resources"
            icon={FileJson}
            badge={server.resources.length}
            isOpen={Boolean(openSections.resources)}
            onToggle={toggleSection}
          >
            <KeyValueRow
              label="Payload"
              value={
                <pre className="overflow-x-auto rounded-xl bg-[#0f172a] p-4 text-xs leading-6 text-[#e2e8f0]">
                  {resourceJson}
                </pre>
              }
              multiline
            />
          </TreeSection>
        </div>
      </div>
    </div>
  );
}
