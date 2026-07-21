/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Server, Database, Cpu, MessageSquare, Layers, ShieldCheck, HelpCircle, Activity, LayoutDashboard, Share2 } from "lucide-react";
import { CalculatorState } from "../types";

interface DiagramProps {
  state: CalculatorState;
}

export function AIOpsFrameworkDiagram({ state }: DiagramProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const steps = [
    {
      id: "observability",
      title: "1. Observability Feeds",
      desc: "Datadog, ELK, Dynatrace, or IBM Instana push realtime telemetry logs, metrics, and alerts.",
      icon: Activity,
      color: "border-sky-500 text-sky-400 bg-sky-950/20"
    },
    {
      id: "connectors",
      title: "2. MCP & Connectors",
      desc: "Model Context Protocol (MCP) and custom RC Skills link into ServiceNow, JIRA, and Git repositories.",
      icon: Layers,
      color: "border-amber-500 text-amber-400 bg-amber-950/20"
    },
    {
      id: "aiops",
      title: `3. RC AI Ops on ${state.infraProvider}`,
      desc: `Hosted securely on ${state.infraProvider} (${state.infraOptionId}) with agents referencing Agent KB & Memory.`,
      icon: Server,
      color: "border-rc-accent text-emerald-400 bg-emerald-950/20"
    },
    {
      id: "gateway",
      title: "4. Secure AI Gateway",
      desc: "Governs, monitors, and routes LLM requests; guarantees compliance and keeps API secrets hidden.",
      icon: Cpu,
      color: "border-rc-blue text-rc-accent bg-blue-950/20"
    },
    {
      id: "llm",
      title: "5. LLM Reasoning",
      desc: `Leverages ${state.llmModelKey} for Root Cause Analysis (RCA), generating code patches & resolution suggestions.`,
      icon: ShieldCheck,
      color: "border-purple-500 text-purple-400 bg-purple-950/20"
    },
    {
      id: "channels",
      title: "6. Collaboration & AutoHeal",
      desc: "Notifies team via Web Chat / SLACK / MS Teams. AutoHeal agent executes verified steps autonomously.",
      icon: MessageSquare,
      color: "border-rose-500 text-rose-400 bg-rose-950/20"
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-rc-blue/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-rc-accent/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <span className="text-xs uppercase font-mono tracking-widest text-rc-accent font-semibold px-2.5 py-1 bg-slate-800/80 rounded-full border border-slate-700">
            System Architecture Flow
          </span>
          <h3 className="text-xl font-bold mt-2 text-slate-100 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-rc-accent" />
            RC Enterprise AI Ops Integration Pipeline
          </h3>
        </div>
        <p className="text-xs text-slate-400 max-w-sm mt-2 md:mt-0 leading-relaxed">
          Hover over each modular element to inspect how alerts trigger automated root cause repairs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isHovered = hoveredNode === step.id;
          return (
            <div
              key={step.id}
              className={`relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                isHovered
                  ? "border-emerald-400 bg-slate-800/90 shadow-lg scale-102 translate-y-[-4px]"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
              onMouseEnter={() => setHoveredNode(step.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Connector lines on desktop */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                  <span className="text-slate-700 text-lg font-mono">→</span>
                </div>
              )}

              <div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 mb-3 ${step.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-100 leading-tight">
                  {step.title}
                </h4>
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Observability Platform Tags in footer */}
      <div className="mt-6 pt-4 border-t border-slate-800/60 flex flex-wrap gap-2 items-center text-xs text-slate-400">
        <span className="font-mono text-slate-500 mr-2">Supported Connectors:</span>
        <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800">Datadog</span>
        <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800">ELK Stack</span>
        <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800">Dynatrace</span>
        <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800">IBM Instana</span>
        <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800">ServiceNow Ticketing</span>
        <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800">Confluence Wiki</span>
      </div>
    </div>
  );
}
