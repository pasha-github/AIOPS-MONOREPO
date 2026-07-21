/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Check, X, ShieldAlert, Zap, Clock, ThumbsUp, HelpCircle } from "lucide-react";

interface ComparisonItem {
  metric: string;
  legacyStatus: "bad" | "good";
  legacyText: string;
  modernStatus: "bad" | "good";
  modernText: string;
}

export function TodayVsTomorrow() {
  const [activeTab, setActiveTab] = useState<"comparison" | "ticketLifecycle">("comparison");

  const comparisonItems: ComparisonItem[] = [
    {
      metric: "Ticket Response / Resolution Time",
      legacyStatus: "bad",
      legacyText: "Hours or days. Stalls in queues waiting for L1 manual filters.",
      modernStatus: "good",
      modernText: "Under 2 minutes. Instant automated investigation and lookup."
    },
    {
      metric: "Root Cause Analysis (RCA)",
      legacyStatus: "bad",
      legacyText: "Completely manual. Requires sifting through massive logs under stress.",
      modernStatus: "good",
      modernText: "Automated core diagnostic. Identifies exact code lines and commits."
    },
    {
      metric: "Knowledge Base / SOP Updates",
      legacyStatus: "bad",
      legacyText: "Rarely done or stale. Engineers resolve issues but don't document.",
      modernStatus: "good",
      modernText: "Auto-generated draft. Updates Wiki / Confluence pages directly."
    },
    {
      metric: "Incident Prevention",
      legacyStatus: "bad",
      legacyText: "Reactive. Alert triggers only after system is down.",
      modernStatus: "good",
      modernText: "Predictive. AI agent notices trend lines and flags prior to failure."
    },
    {
      metric: "Repetitive Issue Overheads",
      legacyStatus: "bad",
      legacyText: "High fatigue. Engineers solve the exact same memory exhaustion issues weekly.",
      modernStatus: "good",
      modernText: "Zero fatigue. Auto heal scripts recognize and remediate instantly."
    },
    {
      metric: "Cost Optimizations",
      legacyStatus: "bad",
      legacyText: "High costs. Huge L1/L2 engineering staff rotating on 24/7 schedules.",
      modernStatus: "good",
      modernText: "Highly optimized. AI handles 80%+ of L1/L2 load, freeing up seniors."
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-slate-100 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-rc-blue">
            Operational Transformation
          </span>
          <h3 className="text-xl font-bold mt-1 text-slate-900">
            AIOps: Today vs. Tomorrow
          </h3>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("comparison")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === "comparison"
                ? "bg-white text-rc-blue shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Capabilities Matrix
          </button>
          <button
            onClick={() => setActiveTab("ticketLifecycle")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === "ticketLifecycle"
                ? "bg-white text-rc-blue shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Incident Lifecycle Flow
          </button>
        </div>
      </div>

      {activeTab === "comparison" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider w-1/4">Capability / Pain Area</th>
                <th className="py-3 px-4 font-semibold text-red-700 text-xs uppercase tracking-wider bg-red-50/40 w-3/8 rounded-t-xl">Today (Without RC AIOps)</th>
                <th className="py-3 px-4 font-semibold text-emerald-800 text-xs uppercase tracking-wider bg-emerald-50/40 w-3/8 rounded-t-xl">Tomorrow (With RC AIOps)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonItems.map((item, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    {item.metric}
                  </td>
                  <td className="py-3.5 px-4 bg-red-50/20 text-slate-600 text-xs leading-relaxed">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                        <X className="w-3 h-3 text-red-600" />
                      </div>
                      <span>{item.legacyText}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 bg-emerald-50/10 text-slate-700 text-xs leading-relaxed">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="font-medium text-slate-800">{item.modernText}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Legacy Block */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 relative">
              <span className="absolute top-4 right-4 text-xs font-mono font-bold text-red-600 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
                Legacy Manual Run
              </span>
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Unresolved Incident Cycle (Avg: 4-6 Hours)
              </h4>

              <div className="space-y-4 font-sans text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-mono font-bold shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-slate-800">Critical Outage Appears</p>
                    <p className="text-slate-500 mt-0.5">Alert fires on Datadog. Stack traces swamp channels.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-mono font-bold shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-slate-800">Manual Ticket triage</p>
                    <p className="text-slate-500 mt-0.5">ServiceNow ticket is created. Sits on queue waiting for support login.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-mono font-bold shrink-0">3</span>
                  <div>
                    <p className="font-semibold text-slate-800">L1 Support troubleshooting</p>
                    <p className="text-slate-500 mt-0.5">Restarts servers blindly. No knowledge-base link found. Escalatess to L2.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-mono font-bold shrink-0">4</span>
                  <div>
                    <p className="font-semibold text-slate-800">L2 / L3 Senior Engineer context switch</p>
                    <p className="text-slate-500 mt-0.5">Woken up at midnight. Runs manual diagnostic queries. Fixes manually.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Block */}
            <div className="border border-emerald-200 rounded-2xl p-5 bg-emerald-50/15 relative">
              <span className="absolute top-4 right-4 text-xs font-mono font-bold text-emerald-700 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                RC AIOps Flow
              </span>
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
                Automated Remediation Cycle (Avg: &lt; 2 Minutes)
              </h4>

              <div className="space-y-4 font-sans text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-bold shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-slate-800">Instant API Telemetry Interception</p>
                    <p className="text-slate-500 mt-0.5">RC AI agents immediately read the telemetry stack trace payload.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-bold shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-slate-800">Concurrent Knowledge Base Match</p>
                    <p className="text-slate-500 mt-0.5">Searches ServiceNow tickets, Confluence SOP, and Git logs within 1.5 seconds.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-bold shrink-0">3</span>
                  <div>
                    <p className="font-semibold text-slate-800">LLM Reasoning & RCA Verdict</p>
                    <p className="text-slate-500 mt-0.5">Secure AI gateway executes the LLM models to recommend exact hotfix commands.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-bold shrink-0">4</span>
                  <div>
                    <p className="font-semibold text-slate-800">Autonomous AutoHeal Remediation</p>
                    <p className="text-slate-500 mt-0.5">Executes safe corrective script, updates tickets, logs completion, notifies slack.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-emerald-900/5 border border-emerald-100 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
            <ThumbsUp className="w-5 h-5 text-emerald-600 shrink-0" />
            <p>
              <strong>Impact:</strong> Integrating Royal Cyber's AI Ops framework lowers Mean-Time-To-Repair (MTTR) by up to <strong>91%</strong> while retaining senior engineering focus exclusively on innovation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
