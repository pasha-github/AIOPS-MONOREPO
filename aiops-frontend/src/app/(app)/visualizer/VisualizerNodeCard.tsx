"use client";

import {
  Handle,
  NodeToolbar,
  Position,
  type NodeProps,
} from "@xyflow/react";
import { Bot, Sparkles } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { GraphFlowNode, GraphKind } from "./shared";

export function VisualizerNodeCard({
  id,
  data,
}: NodeProps<GraphFlowNode>) {
  const [isHovered, setIsHovered] = useState(false);

  if (!data) {
    return null;
  }

  const kind = data.kind;
  if (kind === "hub") {
    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !border !border-slate-300 !bg-white"
        />
        <div className="h-[18px] w-[18px] rounded-full border border-slate-300 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]" />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2 !w-2 !border !border-slate-300 !bg-white"
        />
      </>
    );
  }
  const isAgent = kind === "agent";

  return (
    <>
      <NodeToolbar
        nodeId={id}
        isVisible={isHovered}
        position={Position.Bottom}
        offset={12}
      >
        <div className="pointer-events-none w-72 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs text-slate-200 shadow-2xl">
          <div className="mt-2 text-sm font-medium text-white">
            {data.hoverTitle}
          </div>
          <div className="mt-2 leading-5 text-slate-300">{data.hoverText}</div>
        </div>
      </NodeToolbar>
      <Handle
        type="target"
        position={Position.Top}
        className={`!h-3 !w-3 !border-2 !bg-white ${getHandleClassName(kind)}`}
      />
      <div
        className="relative z-10 w-[300px] rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition-shadow hover:z-50 hover:shadow-[0_22px_52px_rgba(15,23,42,0.14)]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-start gap-3">
          <NodeLogo kind={kind} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {kind === "agent" ? (
                  <div
                    className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${getRoleTextClassName(kind)}`}
                  >
                    {data.role}
                  </div>
                ) : null}
                <div
                  className={`${kind === "agent" ? "mt-1" : ""} truncate text-base font-semibold text-slate-950`}
                  title={data.name}
                >
                  {data.name}
                </div>
              </div>
            </div>
            <div className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-600">
              {data.description}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              kind === "mcp"
                ? "bg-violet-100 text-violet-700"
                : kind === "skill"
                  ? "bg-teal-100 text-teal-700"
                : kind === "connector"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {kind}
          </span>
          {isAgent ? (
            <span className="max-w-[180px] truncate rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              {data.llm}
            </span>
          ) : null}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!h-3 !w-3 !border-2 !bg-white ${getHandleClassName(kind)}`}
      />
    </>
  );
}

export const visualizerNodeTypes = {
  visualizer: VisualizerNodeCard,
  visualizerHub: VisualizerNodeCard,
};

export function getMiniMapColor(kind?: GraphKind) {
  if (kind === "hub") return "rgba(255,255,255,0)";
  if (kind === "agent") return "#10b981";
  if (kind === "skill") return "#14b8a6";
  if (kind === "connector") return "#f97316";
  if (kind === "mcp") return "#a381f2ff";
  return "#38bdf8";
}

function NodeLogo({ kind }: { kind: GraphKind }) {
  const palette = {
    agent: "from-sky-600 to-cyan-500",
    skill: "from-teal-600 to-emerald-500",
    connector: "from-orange-500 to-amber-500",
    mcp: "from-violet-50 to-fuchsia-50",
    hub: "from-slate-300 to-slate-200",
  }[kind];

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${palette} text-white shadow-lg`}
    >
      {kind === "agent" ? (
        <Bot className="h-5 w-5 text-white" strokeWidth={1.9} />
      ) : null}
      {kind === "connector" ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M10 7H7a4 4 0 0 0 0 8h3" />
          <path d="M14 7h3a4 4 0 0 1 0 8h-3" />
          <path d="M8 12h8" />
        </svg>
      ) : null}
      {kind === "skill" ? (
        <Sparkles className="h-5 w-5 text-white" strokeWidth={1.9} />
      ) : null}
      {kind === "mcp" ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#a381f2ff]">
          <Image
            src="/img/mcp.png"
            alt="MCP"
            width={22}
            height={22}
            className="h-[22px] w-[22px] "
          />
        </div>
      ) : null}
    </div>
  );
}

function getHandleClassName(kind: GraphKind) {
  if (kind === "skill") return "!border-teal-500";
  if (kind === "connector") return "!border-orange-500";
  if (kind === "mcp") return "!border-violet-500";
  return "!border-sky-500";
}

function getRoleTextClassName(kind: GraphKind) {
  if (kind === "skill") return "text-teal-700";
  if (kind === "connector") return "text-orange-700";
  if (kind === "mcp") return "text-violet-700";
  return "text-sky-700";
}
