"use client";

import { ArrowLeft, ArrowRight, ChevronDown, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { mcpOptions, skillTabs, toolOptions } from "../schema";

type CreateNewSkillProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CreateNewSkill({ isOpen, onClose }: CreateNewSkillProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [displayTab, setDisplayTab] = useState(0);
  const [isTabFading, setIsTabFading] = useState(false);
  const [mcpRows, setMcpRows] = useState<string[]>([""]);
  const [connectorRows, setConnectorRows] = useState<string[]>([""]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [activeAvailableTool, setActiveAvailableTool] = useState<string>("");
  const [activeSelectedTool, setActiveSelectedTool] = useState<string>("");

  const availableTools = toolOptions.filter((tool) => !selectedTools.includes(tool));
  const useStackedMcpConnectorLayout =
    Math.max(mcpRows.length, connectorRows.length) >= 4 &&
    Math.abs(mcpRows.length - connectorRows.length) >= 2;

  useEffect(() => {
    setDisplayTab(activeTab);
  }, [activeTab]);

  const handleTabChange = (nextTab: number) => {
    if (nextTab === activeTab) return;
    setIsTabFading(true);
    setTimeout(() => {
      setActiveTab(nextTab);
      requestAnimationFrame(() => setIsTabFading(false));
    }, 140);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
        
        <div  className="flex items-center justify-between px-6 py-4">
                  <Sparkles className="h-5 w-5" />

          <h3  className="text-lg font-semibold text-[#111827]" >Create Skill</h3>
          
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#dce3f0] text-[#6b7280]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-3">
          <div className="w-full overflow-x-auto rounded-xl  p-1">
            <div className="grid min-w-[560px]  grid-cols-5 gap-1">
            {skillTabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(index)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-1000 ${
                  activeTab === index
                    ? "bg-[#f1faff] text-[#4f49e2] shadow-sm"
                    : "text-[#6b7280] hover:bg-white/70"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          </div>
        </div>

        <div
          className={`soft-scrollbar flex-1 overflow-y-auto px-6 py-5 transition-opacity duration-200 ${
            isTabFading ? "opacity-0" : "opacity-100"
          }`}
        >
          {displayTab === 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#111827]">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Incident Resolution Skill"
                  className="w-full rounded-xl border border-[#dce3f0] px-4 py-2.5 text-sm outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#111827]">Description</label>
                <textarea
                  rows={6}
                  placeholder="Short description of this skill"
                  className="w-full resize-y rounded-xl border border-[#dce3f0] px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>
          ) : null}

          {displayTab === 1 ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#111827]">Instruction</label>
              <textarea
                rows={10}
                placeholder="Write detailed behavior and guidance for this skill..."
                className="w-full rounded-xl border border-[#dce3f0] px-4 py-3 text-sm outline-none"
              />
            </div>
          ) : null}

          {displayTab === 2 ? (
            <div className={useStackedMcpConnectorLayout ? "space-y-6" : "grid gap-6 md:grid-cols-2"}>
              <div className="space-y-3 p-4">
                <label className="text-sm font-semibold text-[#111827]">MCP</label>
                {mcpRows.map((row, index) => (
                  <div key={`mcp-row-${index}`} className="flex items-center gap-2">
                    <div className="relative w-full">
                      <select
                        value={row}
                        onChange={(event) =>
                          setMcpRows((current) =>
                            current.map((item, idx) =>
                              idx === index ? event.target.value : item
                            )
                          )
                        }
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option value="">Select MCP</option>
                        {mcpOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
                    </div>

                    {mcpRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setMcpRows((current) => current.filter((_, idx) => idx !== index))
                        }
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-white text-[#64748b] transition hover:bg-[#fff1f2] hover:text-[#e11d48]"
                        title="Remove MCP"
                        aria-label="Remove MCP"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}

                    {index === mcpRows.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setMcpRows((current) => [...current, ""])}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2]"
                        title="Add MCP"
                        aria-label="Add MCP"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="space-y-3 p-4">
                <label className="text-sm font-semibold text-[#111827]">Connectors</label>
                {connectorRows.map((row, index) => (
                  <div key={`connector-row-${index}`} className="flex items-center gap-2">
                    <div className="relative w-full">
                      <select
                        value={row}
                        onChange={(event) =>
                          setConnectorRows((current) =>
                            current.map((item, idx) =>
                              idx === index ? event.target.value : item
                            )
                          )
                        }
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option value="">Select connector</option>
                        {connectorOptions.map((connector) => (
                          <option key={connector} value={connector}>
                            {connector}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
                    </div>

                    {connectorRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setConnectorRows((current) =>
                            current.filter((_, idx) => idx !== index)
                          )
                        }
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-white text-[#64748b] transition hover:bg-[#fff1f2] hover:text-[#e11d48]"
                        title="Remove connector"
                        aria-label="Remove connector"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}

                    {index === connectorRows.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setConnectorRows((current) => [...current, ""])}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2]"
                        title="Add connector"
                        aria-label="Add connector"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {displayTab === 3 ? (
            <div className="space-y-4">
              <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
                <div className="h-[260px] rounded-2xl border border-[#dce3f0] bg-[#fcfdff] p-3">
                  <p className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
                    Available tools
                  </p>
                  <div className="mt-2 h-[200px] overflow-y-auto pr-1">
                    {availableTools.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-[#8a94a6]">No tools available</p>
                    ) : (
                      availableTools.map((tool) => (
                        <button
                          key={tool}
                          type="button"
                          onClick={() => setActiveAvailableTool(tool)}
                          className={`mb-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${
                            activeAvailableTool === tool
                              ? "bg-[#eef2ff] text-[#4f49e2]"
                              : "text-[#44506a] hover:bg-[#f4f7ff]"
                          }`}
                        >
                          {tool}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeAvailableTool) return;
                      setSelectedTools((current) => [...current, activeAvailableTool]);
                      setActiveAvailableTool("");
                    }}
                    disabled={!activeAvailableTool}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-40"
                    title="Select tool"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeSelectedTool) return;
                      setSelectedTools((current) => current.filter((tool) => tool !== activeSelectedTool));
                      setActiveSelectedTool("");
                    }}
                    disabled={!activeSelectedTool}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d5dbeb] bg-white text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-40"
                    title="Unselect tool"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>

                <div className="h-[260px] rounded-2xl border border-[#dce3f0] bg-[#fcfdff] p-3">
                  <p className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
                    Selected tools
                  </p>
                  <div className="mt-2 h-[200px] overflow-y-auto pr-1">
                    {selectedTools.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-[#8a94a6]">No tools selected</p>
                    ) : (
                      selectedTools.map((tool) => (
                        <button
                          key={tool}
                          type="button"
                          onClick={() => setActiveSelectedTool(tool)}
                          className={`mb-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${
                            activeSelectedTool === tool
                              ? "bg-[#eef2ff] text-[#4f49e2]"
                              : "text-[#44506a] hover:bg-[#f4f7ff]"
                          }`}
                        >
                          {tool}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {displayTab === 4 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#111827]">Reference file</label>
                <input
                  type="text"
                  placeholder="e.g. /docs/incident-policy.md"
                  className="w-full rounded-xl border border-[#dce3f0] px-4 py-2.5 text-sm outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#111827]">Text</label>
                <input
                  type="text"
                  placeholder="Any note or reference text"
                  className="w-full rounded-xl border border-[#dce3f0] px-4 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-[#ebeff8] px-6 py-4">
          <button
            type="button"
            className="inline-flex items-center rounded-xl bg-[#4f49e2] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-16px_rgba(79,73,226,0.8)] transition hover:bg-[#3f39d6]"
          >
            Create Skill
          </button>
        </div>
      </div>
    </div>
  );
}
