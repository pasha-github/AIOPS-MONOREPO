/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { CostBreakdown, CalculatorState, LLMModelInfo } from "../types";
import { Printer, Mail, DollarSign, ArrowRight, ShieldCheck, Milestone, CheckCircle2, TrendingUp, Info } from "lucide-react";
import { LLM_MODELS, INFRA_OFFERINGS, AGENT_DEPLOYMENTS, SQL_DATABASES } from "../data";
import { RoyalCyberLogo } from "./RoyalCyberLogo";

interface ProposalProps {
  state: CalculatorState;
  breakdown: CostBreakdown;
  companyName: string;
  clientEmail: string;
}

export function ProposalViewer({ state, breakdown, companyName, clientEmail }: ProposalProps) {
  const [selectedDuration, setSelectedDuration] = useState<12 | 24 | 36>(12);

  const selectedModel = LLM_MODELS.find(m => m.key === state.llmModelKey) || LLM_MODELS[0];
  const selectedInfra = INFRA_OFFERINGS.find(i => i.id === state.infraOptionId) || INFRA_OFFERINGS[0];
  const selectedDb = SQL_DATABASES.find(d => d.id === state.dbOptionId) || SQL_DATABASES[0];
  const selectedAgentDeployment = AGENT_DEPLOYMENTS.find(a => a.id === state.agentDeploymentId) || AGENT_DEPLOYMENTS[0];

  // Calculate year projections
  const months = Array.from({ length: selectedDuration }, (_, i) => i + 1);
  const legacyCumulative = months.map(m => m * breakdown.legacySupportCost);
  // modern cumulative = (modern cost * months) + setup fee
  const setupFee = state.enterprisePreset === "small" ? 1500 : state.enterprisePreset === "medium" ? 5000 : 15000;
  const modernCumulative = months.map(m => (breakdown.totalActualCost * m) + setupFee);
  
  // Max value for SVG scaling
  const maxVal = Math.max(
    legacyCumulative[legacyCumulative.length - 1],
    modernCumulative[modernCumulative.length - 1]
  ) || 1000;

  // SVG Coordinates calculation for beautiful charts
  const width = 600;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const getX = (m: number) => {
    return paddingLeft + ((m - 1) / (selectedDuration - 1)) * (width - paddingLeft - paddingRight);
  };

  const getY = (val: number) => {
    return height - paddingBottom - (val / maxVal) * (height - paddingTop - paddingBottom);
  };

  const legacyPoints = months.map(m => `${getX(m)},${getY(legacyCumulative[m-1])}`).join(" ");
  const modernPoints = months.map(m => `${getX(m)},${getY(modernCumulative[m-1])}`).join(" ");

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(val);
  };

  const breakEvenMonth = months.find(m => {
    // legacy support is purely incremental. When cumulative legacy cost > modern cost + setup fee, we broke even
    return legacyCumulative[m-1] > modernCumulative[m-1];
  }) || null;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-md" id="proposal-document">
      {/* Header section with print tools */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-200 no-print">
        <div>
          <span className="text-emerald-700 bg-emerald-50 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200 flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Executive Review
          </span>
          <h3 className="text-xl font-bold mt-2 text-slate-900">
            Interactive Business Case & Proposal
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4" /> Print PDF / Save
          </button>
          <a
            href={`mailto:${clientEmail || "info@royalcyber.com"}?subject=Royal Cyber AIOps Proposal Draft&body=Hello,\n\nPlease review the attached AIOps cost estimate and business model preset for ${companyName || "our organization"}.\n\nSelected LLM: ${selectedModel.name}\nTotal Net Monthly Savings: ${formatCurrency(breakdown.netSavings)}\nROI: ${breakdown.roiPercentage.toFixed(1)}%\n\nBest Regards.`}
            className="px-4 py-2 bg-rc-blue hover:bg-rc-blue-light text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Mail className="w-4 h-4" /> Export Draft Email
          </a>
        </div>
      </div>

      {/* The Printable Page Container */}
      <div className="relative font-sans text-slate-800 printable-card">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 mb-8 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RoyalCyberLogo className="h-8" />
              <span className="text-xs font-mono font-semibold text-slate-500 uppercase">
                AIOps Enterprise Division
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              55 Shuman Blvd, Suite 275, Naperville, IL 60563 USA | info@royalcyber.com
            </p>
          </div>
          <div className="text-left md:text-right">
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
              AIOps Integration ROI Proposal
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Issued for: <span className="font-bold text-slate-800 font-sans">{companyName || "Valued Enterprise Partner"}</span>
            </p>
            {clientEmail && (
              <p className="text-xs text-slate-500 font-mono">
                Email: <span className="font-sans text-slate-800">{clientEmail}</span>
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Date Generated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mb-6">
          <h2 className="text-sm uppercase tracking-wider font-bold text-slate-900 mb-3 border-l-4 border-rc-blue pl-2.5">
            1. Executive Strategy
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Today's enterprise IT environments are overwhelmed by system alerts, long incident queues, and repetitive manual tier-1 triages. This proposal details a migration of standard support loops into an automated 
            <strong> Royal Cyber AI Ops Solution</strong>. By leveraging context-rich Model Context Protocols (MCP), custom knowledge bases, and 
            <em> {selectedModel.name}</em>, we aim to resolve over <strong>{state.pctAutomated}%</strong> of incoming telemetry incidents proactively within 2 minutes.
          </p>

          <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-[10px] text-amber-800 leading-tight">
              <strong>Important Disclaimer:</strong> All financial values, savings projections, and ROI metrics presented in this document are <strong>estimates</strong> based on the data provided. Actual costs are subject to change following a detailed discovery phase and final technical architecture validation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <p className="text-xxs uppercase tracking-wider text-slate-500 font-bold">Monthly Modern Operational Fee</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {formatCurrency(breakdown.totalActualCost)}
                <span className="text-xs font-normal text-slate-500"> /mo</span>
              </p>
              <p className="text-xxs text-slate-400 mt-1">Including compute, SQL replicates, and token usage</p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <p className="text-xxs uppercase tracking-wider text-emerald-800 font-bold">Net Project Monthly Savings</p>
              <p className="text-lg font-bold text-emerald-700 mt-1">
                {formatCurrency(breakdown.netSavings)}
                <span className="text-xs font-normal text-slate-500"> /mo</span>
              </p>
              <p className="text-xxs text-emerald-600 mt-1">After accounting for platform amortization</p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              <p className="text-xxs uppercase tracking-wider text-blue-900 font-bold">Annualized Return (ROI)</p>
              <p className="text-lg font-bold text-blue-700 mt-1">
                {breakdown.roiPercentage.toFixed(0)}%
              </p>
              <p className="text-xxs text-blue-600 mt-1">
                {breakEvenMonth ? `Payback period: ~${breakEvenMonth} months` : "Instant profitability"}
              </p>
            </div>
          </div>
        </div>

        {/* Strategic Cost Composition */}
        <div className="mb-8">
          <h2 className="text-sm uppercase tracking-wider font-bold text-slate-900 mb-4 border-l-4 border-rc-blue pl-2.5">
            2. Detailed Monthly Cost Breakdown
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Breakdown Table */}
            <div className="space-y-3">
              <div className="bg-slate-900 text-white rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase font-mono text-rc-accent tracking-widest mb-1">
                  Provider Offering Details
                </p>
                <div className="space-y-2 mt-3 text-xs">
                  <div className="flex justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Infra Host ({state.infraProvider}):</span>
                    <span className="font-semibold">{selectedInfra.name}</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Agent Deployment:</span>
                    <span className="font-semibold text-rc-accent">{selectedAgentDeployment.name}</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Database Engine:</span>
                    <span className="font-semibold">{selectedDb.name}</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-slate-400">LLM Engine:</span>
                    <span className="font-semibold text-lime-400">{selectedModel.name}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-mono text-emerald-400">
                    <span>Monitored Microservices:</span>
                    <span>{state.servicesCount} active units</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Estimated Monthly LLM Input Tokens:</span>
                  <span className="font-semibold text-slate-900">{state.inputTokensMillion} Million tokens</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Estimated Monthly LLM Output Tokens:</span>
                  <span className="font-semibold text-slate-900">{state.outputTokensMillion} Million tokens</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Monthly LLM Token License Fee:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(breakdown.llmTotalCost)}</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Monthly Infrastructure Storage Base:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(breakdown.infraCost)}</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Agent Deployment Service Fee:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(breakdown.agentDeploymentCost)}</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">SQL Cluster & Replication Base:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(breakdown.dbCost)}</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">RC Intelligent Agent Platform Licensing:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(breakdown.agentLicensingCost)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t-2 border-slate-900 font-bold text-slate-900 text-sm">
                  <span>Total Calculated Solution Cost/mo:</span>
                  <span>{formatCurrency(breakdown.totalActualCost)}</span>
                </div>
              </div>
            </div>

            {/* Right Comparison Block */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40">
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3">
                Current Operational Cost vs. Savings Summary
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-600">Monthly Manual Incident Overhead:</span>
                  <span className="font-mono text-slate-900">{formatCurrency(state.monthlyIncidents * state.avgL1CostPerIncident)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-200 text-slate-500">
                  <span className="text-slate-600">Est. L1 Support FTE Labors:</span>
                  <span>{state.supportStaffSaved} Member ({formatCurrency(breakdown.legacySupportCost - (state.monthlyIncidents * state.avgL1CostPerIncident))} budget value)</span>
                </div>
                <div className="bg-red-50 text-red-900 border border-red-200 p-2.5 rounded-xl flex justify-between">
                  <span className="font-semibold">Current Total Manual Operating Costs:</span>
                  <span className="font-mono font-bold">{formatCurrency(breakdown.legacySupportCost)}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-950 border border-emerald-100 p-3 rounded-xl space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-medium text-emerald-800">Incident Resolution Automated ({state.pctAutomated}%):</span>
                    <span className="font-mono font-semibold text-emerald-700">{formatCurrency(breakdown.savedIncidentCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-emerald-800">L1 Support Labor Reallocated:</span>
                    <span className="font-mono font-semibold text-emerald-700">{formatCurrency(state.supportStaffSaved * 6500)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-200 font-semibold text-emerald-900">
                    <span>Total Monthly Savings Diverted:</span>
                    <span className="font-mono">{formatCurrency(breakdown.savedIncidentCost + (state.supportStaffSaved * 6500))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Projection Chart Block */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <h2 className="text-sm uppercase tracking-wider font-bold text-slate-900 border-l-4 border-rc-blue pl-2.5">
              3. Cumulative Cost Amortization Over Time
            </h2>
            <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50 no-print">
              {[12, 24, 36].map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDuration(d as 12 | 24 | 36)}
                  className={`px-2 py-0.5 rounded-md text-xxs font-semibold transition-all duration-150 ${
                    selectedDuration === d
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {d} Months
                </button>
              ))}
            </div>
          </div>

          <p className="text-xxs text-slate-500 mb-4">
            Amortization projection compares the relentless cost climb of human manual support vs. modern automated operations with a standard one-time setup fee ({formatCurrency(setupFee)} configuration buffer).
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-center">
            <div className="w-full max-w-2xl relative">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                {/* Horizontal reference lines */}
                {[0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const val = maxVal * ratio;
                  const y = getY(val);
                  return (
                    <g key={index}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={width - paddingRight}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="text-slate-400 font-sans font-medium"
                        fontSize="9px"
                      >
                        {formatCurrency(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Vertical grid lines (selected milestones) */}
                <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#cbd5e1" />
                <line x1={width - paddingRight} y1={paddingTop} x2={width - paddingRight} y2={height - paddingBottom} stroke="#e2e8f0" />

                {/* Labels for Months */}
                {months.filter((_, idx) => idx % Math.max(1, Math.round(selectedDuration / 6)) === 0 || idx === selectedDuration - 1).map((m) => {
                  const x = getX(m);
                  return (
                    <g key={m}>
                      <line x1={x} y1={height - paddingBottom} x2={x} y2={height - paddingBottom + 4} stroke="#cbd5e1" />
                      <text
                        x={x}
                        y={height - paddingBottom + 16}
                        textAnchor="middle"
                        className="text-slate-500 font-mono"
                        fontSize="9px"
                      >
                        Mo. {m}
                      </text>
                    </g>
                  );
                })}

                {/* Legacy Cost line */}
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={legacyPoints}
                />

                {/* Modern Cost line */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={modernPoints}
                />

                {/* Break even marker */}
                {breakEvenMonth && (
                  <g transform={`translate(${getX(breakEvenMonth)}, ${getY(modernCumulative[breakEvenMonth-1])})`}>
                    <circle r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" className="animate-ping" />
                    <circle r="4" fill="#1c2c80" stroke="#ffffff" strokeWidth="1.5" />
                    <text
                      x="8"
                      y="-8"
                      className="text-emerald-800 font-bold bg-white px-1 rounded border border-emerald-100 shadow-sm"
                      fontSize="9px"
                    >
                      Break-Even (Mo. {breakEvenMonth})
                    </text>
                  </g>
                )}

                {/* Data dot values on terminal months */}
                <circle cx={getX(selectedDuration)} cy={getY(legacyCumulative[selectedDuration - 1])} r="3" fill="#ef4444" />
                <circle cx={getX(selectedDuration)} cy={getY(modernCumulative[selectedDuration - 1])} r="3" fill="#10b981" />
              </svg>

              {/* Custom Legend */}
              <div className="flex justify-center gap-6 mt-3 text-xxs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-1 bg-red-500 rounded-full"></span>
                  <span className="text-slate-600">Legacy Manual Flow: {formatCurrency(legacyCumulative[legacyCumulative.length - 1])} at month {selectedDuration}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-1 bg-emerald-500 rounded-full"></span>
                  <span className="text-emerald-700">RC AI Ops Flow (Inc. setup): {formatCurrency(modernCumulative[modernCumulative.length - 1])} at month {selectedDuration}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Commitment Statement / Footnote */}
        <div className="mt-8 pt-8 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="text-xs text-slate-500 leading-relaxed max-w-sm">
            <h4 className="font-bold text-slate-700 mb-1">Notice:</h4>
            This modeling tool is proprietary software authored by Royal Cyber. 
            <strong> All costing provided is for estimation purposes only.</strong> 
            Platform fees are contingent on actual monitored service volumes, technical architecture, and final service level agreements (SLAs).
          </div>
          <div className="text-left sm:text-right text-xs">
            <p className="font-semibold text-slate-900">Approved by:</p>
            <p className="text-slate-500 mt-0.5">Royal Cyber Enterprise Core Presales team</p>
            <div className="mt-4 inline-block border-t border-slate-400 w-44 pt-1 font-mono text-slate-400 text-xxs text-left md:text-right">
              Authorized Signature / Stamp
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
