/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calculator,
  Settings,
  TrendingUp,
  Activity,
  BookOpen,
  HelpCircle,
  Layers,
  Building2,
  Mail,
  Percent,
  Cpu,
  Coins,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Flame,
  UserCheck,
  Sparkles,
  Info,
} from "lucide-react";

import { CalculatorState, CostBreakdown } from "./types";
import {
  LLM_MODELS,
  INFRA_OFFERINGS,
  AGENT_DEPLOYMENTS,
  SQL_DATABASES,
  ENTERPRISE_PRESETS,
} from "./data";
import { TodayVsTomorrow } from "./components/TodayVsTomorrow";
import { AIOpsFrameworkDiagram } from "./components/AIOpsFrameworkDiagram";
import { ProposalViewer } from "./components/ProposalViewer";
import { RoyalCyberLogo } from "./components/RoyalCyberLogo";

export default function App() {
  // Navigation / Tab structure
  const [activeTab, setActiveTab] = useState<
    "calculator" | "matrix" | "diagram" | "proposal"
  >("calculator");

  // Enterprise Information
  const [companyName, setCompanyName] = useState("Royal Cyber Client Partner");
  const [clientEmail, setClientEmail] = useState("it-ops@enterpriseclient.com");

  // Calculator State
  const [calcState, setCalcState] = useState<CalculatorState>({
    enterprisePreset: "medium",
    servicesCount: ENTERPRISE_PRESETS.medium.servicesCount,
    monthlyIncidents: ENTERPRISE_PRESETS.medium.monthlyIncidents,
    pctAutomated: ENTERPRISE_PRESETS.medium.pctAutomated,
    inputTokensMillion: ENTERPRISE_PRESETS.medium.inputTokensMillion,
    outputTokensMillion: ENTERPRISE_PRESETS.medium.outputTokensMillion,
    supportStaffSaved: ENTERPRISE_PRESETS.medium.supportStaffSaved,
    avgL1CostPerIncident: ENTERPRISE_PRESETS.medium.avgL1CostPerIncident,
    infraProvider: ENTERPRISE_PRESETS.medium.infraProvider,
    infraOptionId: ENTERPRISE_PRESETS.medium.infraOptionId,
    dbOptionId: ENTERPRISE_PRESETS.medium.dbOptionId,
    agentDeploymentId: ENTERPRISE_PRESETS.medium.agentDeploymentId,
    llmModelKey: ENTERPRISE_PRESETS.medium.llmModelKey,
    kbSyncFrequency: "hourly",
    retriesEnabled: true,
    licensingBaseFee: ENTERPRISE_PRESETS.medium.licensingBaseFee,
    licensingPerServiceFee: ENTERPRISE_PRESETS.medium.licensingPerServiceFee,
  });

  const [infoTooltip, setInfoTooltip] = useState<string | null>(null);

  // Apply enterprise presets
  const applyPreset = (presetKey: "small" | "medium" | "large") => {
    const preset = ENTERPRISE_PRESETS[presetKey];
    setCalcState({
      enterprisePreset: presetKey,
      servicesCount: preset.servicesCount,
      monthlyIncidents: preset.monthlyIncidents,
      pctAutomated: preset.pctAutomated,
      inputTokensMillion: preset.inputTokensMillion,
      outputTokensMillion: preset.outputTokensMillion,
      supportStaffSaved: preset.supportStaffSaved,
      avgL1CostPerIncident: preset.avgL1CostPerIncident,
      infraProvider: preset.infraProvider,
      infraOptionId: preset.infraOptionId,
      dbOptionId: preset.dbOptionId,
      agentDeploymentId: preset.agentDeploymentId,
      llmModelKey: preset.llmModelKey,
      kbSyncFrequency:
        presetKey === "small"
          ? "daily"
          : presetKey === "medium"
            ? "hourly"
            : "realtime",
      retriesEnabled: true,
      licensingBaseFee: preset.licensingBaseFee,
      licensingPerServiceFee: preset.licensingPerServiceFee,
    });
  };

  // Live Calculations based on active state variables
  const currentModel =
    LLM_MODELS.find((m) => m.key === calcState.llmModelKey) || LLM_MODELS[0];
  const currentInfra =
    INFRA_OFFERINGS.find((i) => i.id === calcState.infraOptionId) ||
    INFRA_OFFERINGS[0];
  const currentDb =
    SQL_DATABASES.find((d) => d.id === calcState.dbOptionId) ||
    SQL_DATABASES[0];
  const currentAgentDeployment =
    AGENT_DEPLOYMENTS.find((a) => a.id === calcState.agentDeploymentId) ||
    AGENT_DEPLOYMENTS[0];

  const llmInputCost =
    calcState.inputTokensMillion * currentModel.inputCostPerMillion;
  const llmOutputCost =
    calcState.outputTokensMillion * currentModel.outputCostPerMillion;
  const llmTotalCost = llmInputCost + llmOutputCost;

  const infraCost = currentInfra.baseCostPerMonth;
  const dbCost = currentDb.baseCostPerMonth;
  const agentDeploymentCost = currentAgentDeployment.baseCostPerMonth;

  // Custom Platform licensing math: Configurable base per month + Configurable per monitored microservice container limit
  const agentLicensingCost =
    calcState.licensingBaseFee +
    calcState.servicesCount * calcState.licensingPerServiceFee;
  const totalActualCost =
    llmTotalCost +
    infraCost +
    dbCost +
    agentDeploymentCost +
    agentLicensingCost;

  // Legacy manual workload model calculation
  // Monthly incident overhead: count * manual handling cost
  const legacyIncidentsCost =
    calcState.monthlyIncidents * calcState.avgL1CostPerIncident;
  // Estimated human head counts cost saved / reallocated (average $6,500 monthly including payroll & setups)
  const legacyStaffCost = calcState.supportStaffSaved * 6500;
  const legacySupportCost = legacyIncidentsCost + legacyStaffCost;

  // Modern projected cost savings
  // How many incidents we resolve * avg manual cost of resolving
  const savedIncidentCost =
    calcState.monthlyIncidents *
    (calcState.pctAutomated / 100) *
    calcState.avgL1CostPerIncident;
  const laborSavings = legacyStaffCost; // total human budget freed/reallocated
  const totalGrossSavings = savedIncidentCost + laborSavings;

  const netSavings = totalGrossSavings - totalActualCost;
  const roiPercentage =
    totalActualCost > 0 ? (netSavings / totalActualCost) * 100 : 0;

  const breakdown: CostBreakdown = {
    llmInputCost,
    llmOutputCost,
    llmTotalCost,
    infraCost,
    dbCost,
    agentDeploymentCost,
    agentLicensingCost,
    totalActualCost,
    legacySupportCost,
    savedIncidentCost,
    netSavings,
    roiPercentage,
  };

  const selectedProviderInfraOptions = INFRA_OFFERINGS.filter(
    (i) => i.provider === calcState.infraProvider,
  );

  return (
    <div className="min-h-screen flex flex-col font-sans select-none antialiased bg-[#d6d9e2]">
      {/* Royal Cyber Elegant Header */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md px-4 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RoyalCyberLogo className="h-9 md:h-10" />
            <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-100 flex items-center gap-1.5 leading-none sm:mt-0.5">
                <Cpu className="w-4 h-4 text-rc-accent" />
                RC AI OPS Cost Calculator
              </h1>
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider block mt-0.5">
                Infra & Model Cost-Benefit Modeler
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab("calculator")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                activeTab === "calculator"
                  ? "bg-rc-blue text-white shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/45"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Interactive Calculator
            </button>
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                activeTab === "matrix"
                  ? "bg-rc-blue text-white shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/45"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Today vs. Tomorrow
            </button>
            <button
              onClick={() => setActiveTab("diagram")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                activeTab === "diagram"
                  ? "bg-rc-blue text-white shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/45"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              System Pipeline Flow
            </button>
            <button
              onClick={() => setActiveTab("proposal")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                activeTab === "proposal"
                  ? "bg-rc-blue text-white shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/45"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Print Proposal / ROI
            </button>
          </div>
        </div>
      </header>

      {/* Main Dynamic Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8 flex flex-col gap-6 md:gap-8">
        {/* Pitch Intro */}
        {activeTab === "calculator" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
            {/* Soft decorative ambient circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-rc-blue/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
              <div className="max-w-xl">
                <span className="text-[10px] md:text-xs font-mono font-bold tracking-widest text-rc-accent uppercase block mb-1 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700/50 w-max">
                  Royal Cyber AIOps Assistant
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-slate-100 leading-tight">
                  IT Operations: Fewer Issues. Fixed Faster. Lower Costs.
                </h2>
                <p className="text-xs md:text-sm text-slate-300 mt-2.5 leading-relaxed">
                  Evaluate real-time infrastructure resource footprints, SQL
                  databases, and LLM text parameters to map financial ROI. Use
                  pre-calibrated Enterprise presets to estimate how automating
                  root cause diagnostics shifts labor allocations.
                </p>
              </div>

              {/* Dynamic KPI pill */}
              <div className="flex bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 gap-6 items-center w-full lg:w-auto">
                <div className="text-center shrink-0">
                  <p className="text-xxs uppercase tracking-wider text-slate-400 font-mono">
                    Current LLM Choice
                  </p>
                  <p className="font-bold text-rc-accent text-sm mt-0.5">
                    {currentModel.name}
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div className="text-center">
                  <p className="text-xxs uppercase tracking-wider text-slate-400 font-mono">
                    Projected ROI
                  </p>
                  <p
                    className={`font-extrabold text-lg mt-0.5 ${netSavings > 0 ? "text-emerald-400" : "text-amber-400"}`}
                  >
                    {roiPercentage.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Presets row */}
            <div className="mt-6 pt-4 border-t border-slate-800/60 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1 mr-2">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Apply
                Standard Enterprise Presets:
              </span>
              {(["small", "medium", "large"] as const).map((presetKey) => {
                const isActive = calcState.enterprisePreset === presetKey;
                return (
                  <button
                    key={presetKey}
                    onClick={() => applyPreset(presetKey)}
                    className={`px-3 py-1.5 text-xs rounded-xl font-medium cursor-pointer transition-all duration-150 border uppercase tracking-wider ${
                      isActive
                        ? "bg-slate-100 text-slate-900 border-white shadow-md font-bold"
                        : "bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {presetKey} size
                  </button>
                );
              })}
              <button
                onClick={() =>
                  setCalcState((prev) => ({
                    ...prev,
                    enterprisePreset: "custom",
                  }))
                }
                className={`px-3 py-1.5 text-xs rounded-xl font-medium cursor-pointer transition-all duration-150 border uppercase tracking-wider ${
                  calcState.enterprisePreset === "custom"
                    ? "bg-slate-100 text-slate-900 border-white shadow-md font-bold"
                    : "bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800 hover:border-slate-700"
                }`}
              >
                custom parameters
              </button>
            </div>
          </div>
        )}

        {/* Workspace Tab Switcher Views */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col gap-6"
          >
            {activeTab === "calculator" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* INPUT CONFIGURATIONS PANEL */}
                <section className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-rc-blue animate-spin-slow" />
                      1. Parameter Settings
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      Editable Model State
                    </span>
                  </div>

                  {/* Monitored systems */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                        Active Monitored Monitored Microservices / Apps
                        <button
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          onMouseEnter={() =>
                            setInfoTooltip(
                              "Every service monitored creates telemetry streams which require active processing of stack traces.",
                            )
                          }
                          onMouseLeave={() => setInfoTooltip(null)}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </label>
                      <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-1 rounded text-rc-blue border border-slate-200">
                        {calcState.servicesCount} services
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="500"
                      value={calcState.servicesCount}
                      onChange={(e) => {
                        setCalcState((p) => ({
                          ...p,
                          servicesCount: parseInt(e.target.value),
                          enterprisePreset: "custom",
                        }));
                      }}
                      className="w-full accent-rc-blue h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>1 microservice</span>
                      <span>250 avg</span>
                      <span>500 limits</span>
                    </div>
                  </div>

                  {/* Incident workloads */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Monthly Active L1 Tickets / Alerts
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={calcState.monthlyIncidents}
                          onChange={(e) => {
                            const val = Math.max(
                              0,
                              parseInt(e.target.value) || 0,
                            );
                            setCalcState((p) => ({
                              ...p,
                              monthlyIncidents: val,
                              enterprisePreset: "custom",
                            }));
                          }}
                          className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:border-rc-blue outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Avg Cost per Manual L1 Ticket ($/inc)
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          value={calcState.avgL1CostPerIncident}
                          onChange={(e) => {
                            const val = Math.max(
                              0,
                              parseInt(e.target.value) || 0,
                            );
                            setCalcState((p) => ({
                              ...p,
                              avgL1CostPerIncident: val,
                              enterprisePreset: "custom",
                            }));
                          }}
                          className="w-full text-xs font-semibold pl-6 p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:border-rc-blue outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Licensing Fees */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Royal Cyber Licensing Base Fee ($/mo)
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          value={calcState.licensingBaseFee}
                          onChange={(e) => {
                            const val = Math.max(
                              0,
                              parseInt(e.target.value) || 0,
                            );
                            setCalcState((p) => ({
                              ...p,
                              licensingBaseFee: val,
                              enterprisePreset: "custom",
                            }));
                          }}
                          className="w-full text-xs font-semibold pl-6 p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:border-rc-blue outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Per-Service Platform Fee ($/svc)
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          value={calcState.licensingPerServiceFee}
                          onChange={(e) => {
                            const val = Math.max(
                              0,
                              parseFloat(e.target.value) || 0,
                            );
                            setCalcState((p) => ({
                              ...p,
                              licensingPerServiceFee: val,
                              enterprisePreset: "custom",
                            }));
                          }}
                          className="w-full text-xs font-semibold pl-6 p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:border-rc-blue outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Auto-healing rate & allocated teams saved */}
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Percent of automated resolutions */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Target Automation Rate (%)</span>
                          <span className="text-slate-500 font-mono font-bold">
                            {calcState.pctAutomated}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="95"
                          value={calcState.pctAutomated}
                          onChange={(e) => {
                            setCalcState((p) => ({
                              ...p,
                              pctAutomated: parseInt(e.target.value),
                              enterprisePreset: "custom",
                            }));
                          }}
                          className="w-full accent-emerald-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Staff Reallocated */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Support FTEs Saved / Shifted</span>
                          <span className="text-slate-500 font-mono font-bold">
                            {calcState.supportStaffSaved} member
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={calcState.supportStaffSaved}
                          onChange={(e) => {
                            setCalcState((p) => ({
                              ...p,
                              supportStaffSaved: parseInt(e.target.value),
                              enterprisePreset: "custom",
                            }));
                          }}
                          className="w-full accent-rc-blue h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cloud Hosting Provider Selector */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 block">
                      Choose Cloud Host Environment
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["GCP", "Azure", "AWS", "Onprem"] as const).map(
                        (provider) => {
                          const isSelected =
                            calcState.infraProvider === provider;
                          return (
                            <button
                              key={provider}
                              type="button"
                              onClick={() => {
                                // Auto-select first matching option of new provider
                                const defaultOpt = INFRA_OFFERINGS.find(
                                  (o) => o.provider === provider,
                                );

                                let defaultAgent = "agent-internal";
                                if (provider === "GCP")
                                  defaultAgent = "agent-vertex";
                                else if (provider === "Azure")
                                  defaultAgent = "agent-azure";
                                else if (provider === "AWS")
                                  defaultAgent = "agent-aws";

                                setCalcState((p) => ({
                                  ...p,
                                  infraProvider: provider,
                                  infraOptionId: defaultOpt
                                    ? defaultOpt.id
                                    : p.infraOptionId,
                                  agentDeploymentId: defaultAgent,
                                  enterprisePreset: "custom",
                                }));
                              }}
                              className={`p-2.5 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
                                isSelected
                                  ? "bg-rc-blue text-white border-rc-blue shadow"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {provider === "Onprem"
                                ? "Private On-Prem"
                                : provider}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>

                  {/* Infra Offering Selection depending on cloud hosts */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Infrastructure Setup Option:
                      </label>
                      <select
                        value={calcState.infraOptionId}
                        onChange={(e) =>
                          setCalcState((p) => ({
                            ...p,
                            infraOptionId: e.target.value,
                            enterprisePreset: "custom",
                          }))
                        }
                        className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-rc-blue cursor-pointer"
                      >
                        {selectedProviderInfraOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name} (${opt.baseCostPerMonth}/mo)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block text-emerald-800">
                        Agent Deployment Option:
                      </label>
                      <select
                        value={calcState.agentDeploymentId}
                        onChange={(e) =>
                          setCalcState((p) => ({
                            ...p,
                            agentDeploymentId: e.target.value,
                            enterprisePreset: "custom",
                          }))
                        }
                        className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-emerald-300 rounded-xl outline-none focus:border-emerald-600 font-semibold cursor-pointer"
                      >
                        {AGENT_DEPLOYMENTS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name} (${opt.baseCostPerMonth}/mo)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        SQL Relational Database Tier:
                      </label>
                      <select
                        value={calcState.dbOptionId}
                        onChange={(e) =>
                          setCalcState((p) => ({
                            ...p,
                            dbOptionId: e.target.value,
                            enterprisePreset: "custom",
                          }))
                        }
                        className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-rc-blue cursor-pointer"
                      >
                        {SQL_DATABASES.map((db) => (
                          <option key={db.id} value={db.id}>
                            {db.name} (${db.baseCostPerMonth}/mo)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* LLM selection and monthly token limits and sliders */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Select Core Inference LLM Engine:
                      </label>
                      <select
                        value={calcState.llmModelKey}
                        onChange={(e) =>
                          setCalcState((p) => ({
                            ...p,
                            llmModelKey: e.target.value,
                            enterprisePreset: "custom",
                          }))
                        }
                        className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:border-rc-blue outline-none cursor-pointer"
                      >
                        {LLM_MODELS.map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.name} [In: ${m.inputCostPerMillion}/M, Out: $
                            {m.outputCostPerMillion}/M]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Input Tokens Slider */}
                      <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700">
                            Monthly Input Tokens
                          </span>
                          <span className="font-mono text-rc-blue font-semibold">
                            {calcState.inputTokensMillion}M tokens
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="2000"
                          value={calcState.inputTokensMillion}
                          onChange={(e) => {
                            setCalcState((p) => ({
                              ...p,
                              inputTokensMillion: parseInt(e.target.value),
                              enterprisePreset: "custom",
                            }));
                          }}
                          className="w-full accent-rc-blue h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Calculated cost:{" "}
                          <span className="font-semibold text-slate-700">
                            $
                            {(
                              calcState.inputTokensMillion *
                              currentModel.inputCostPerMillion
                            ).toFixed(2)}
                          </span>
                        </p>
                      </div>

                      {/* Output Tokens Slider */}
                      <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700">
                            Monthly Output Tokens
                          </span>
                          <span className="font-mono text-rc-blue font-semibold">
                            {calcState.outputTokensMillion}M tokens
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="500"
                          value={calcState.outputTokensMillion}
                          onChange={(e) => {
                            setCalcState((p) => ({
                              ...p,
                              outputTokensMillion: parseInt(e.target.value),
                              enterprisePreset: "custom",
                            }));
                          }}
                          className="w-full accent-rc-blue h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Calculated cost:{" "}
                          <span className="font-semibold text-slate-700">
                            $
                            {(
                              calcState.outputTokensMillion *
                              currentModel.outputCostPerMillion
                            ).toFixed(2)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* VISUAL DASHBOARD OUTPUTS PANEL */}
                <section className="lg:col-span-5 space-y-6">
                  {/* Net Benefits ROI Gauge */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                        AIOps Strategic Value Projection
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500 font-bold uppercase">
                        Realtime Output
                      </span>
                    </div>

                    <div className="flex flex-col items-center py-4">
                      {/* Simple custom Radial SVG representation of ROI */}
                      <div className="relative w-36 h-20 overflow-hidden flex flex-col items-center">
                        <svg
                          className="w-full h-full transform translate-y-[10px]"
                          viewBox="0 0 100 50"
                        >
                          {/* Background semi-circle */}
                          <path
                            d="M 10 50 A 40 40 0 0 1 90 50"
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth="10"
                            strokeLinecap="round"
                          />
                          {/* Colored foreground semi-circle based on ROI percentage */}
                          <path
                            d="M 10 50 A 40 40 0 0 1 90 50"
                            fill="none"
                            stroke={netSavings > 0 ? "#10b981" : "#f59e0b"}
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray="125.6"
                            strokeDashoffset={Math.max(
                              0,
                              125.6 -
                                (Math.min(100, (roiPercentage / 600) * 100) /
                                  100) *
                                  125.6,
                            )}
                          />
                        </svg>
                        <div className="absolute bottom-1 text-center">
                          <h4 className="text-xl font-black text-slate-900 leading-none mt-0.5 font-mono">
                            {roiPercentage > 0 ? "+" : ""}
                            {roiPercentage.toFixed(0)}%
                          </h4>
                        </div>
                      </div>

                      <div className="text-center mt-3 max-w-xs">
                        <p className="text-xs font-semibold text-slate-800">
                          {netSavings > 0
                            ? "Highly Profitable Integration Model!"
                            : "Cost Optimization Required"}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {netSavings > 0
                            ? `Automating ${calcState.pctAutomated}% of alerts yields ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(netSavings)} net monthly savings value.`
                            : "Inference token overhead costs are exceeding manual triage. Try selecting Gemini 2.5 Flash as your engine."}
                        </p>
                      </div>
                    </div>

                    {/* Progress indicators split costs */}
                    <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-center">
                      <div>
                        <span className="text-xxs uppercase tracking-wider text-slate-400 font-mono">
                          Legacy Support Cost
                        </span>
                        <p className="text-base font-bold text-red-600 font-mono mt-0.5">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(legacySupportCost)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xxs uppercase tracking-wider text-slate-400 font-mono">
                          AIOps Modern Cost
                        </span>
                        <p className="text-base font-bold text-emerald-600 font-mono mt-0.5">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(totalActualCost)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing breakdown list items */}
                  <div className="bg-slate-900 text-slate-200 border border-slate-800 rounded-3xl p-6 shadow-lg space-y-4">
                    <h3 className="text-sm font-bold border-b border-slate-800 pb-3 flex items-center justify-between text-white">
                      <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-xs text-rc-accent font-semibold">
                        <Coins className="w-4 h-4 text-rc-accent" />
                        Monthly Billing Estimation
                      </span>
                      <span className="text-xxs text-slate-400">Estimate</span>
                    </h3>

                    <div className="space-y-3 divide-y divide-slate-800/60 text-xs">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="py-1">
                          LLM Input Cost ({calcState.inputTokensMillion}M
                          tokens):
                        </span>
                        <span className="font-mono font-bold text-slate-100">
                          ${llmInputCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 pt-2.5">
                        <span className="py-1">
                          LLM Output Cost ({calcState.outputTokensMillion}M
                          tokens):
                        </span>
                        <span className="font-mono font-bold text-slate-100">
                          ${llmOutputCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 pt-2.5">
                        <span className="py-1">
                          Cloud Base Hosting ({currentInfra.provider}):
                        </span>
                        <span className="font-mono font-semibold text-slate-100">
                          ${infraCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 pt-2.5">
                        <span className="py-1">
                          Agent Deployment ({currentAgentDeployment.name}):
                        </span>
                        <span className="font-mono font-semibold text-slate-100">
                          ${agentDeploymentCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 pt-2.5">
                        <span className="py-1">
                          Replicated SQL Database Instance:
                        </span>
                        <span className="font-mono font-semibold text-slate-100">
                          ${dbCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 pt-2.5">
                        <div>
                          <span className="py-1 block">
                            RC Platform Licensing Base:
                          </span>
                          <span className="text-[10px] text-slate-500 block leading-tight">
                            Config: ${calcState.licensingBaseFee} + {calcState.servicesCount} monitored
                            apps @ ${calcState.licensingPerServiceFee}/svc
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-slate-100">
                          ${agentLicensingCost.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <p className="text-[10px] text-slate-500 italic leading-relaxed text-center">
                        * All figures provided are projections based on the
                        parameters selected. Actual costs may vary based on
                        specific implementation requirements and service level
                        agreements.
                      </p>
                    </div>

                    <div className="flex justify-between items-center pt-4 font-bold text-sm text-lime-400">
                      <span>Total projected Monthly Cost:</span>
                      <span className="font-mono">
                        ${totalActualCost.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* CTA button to print formal proposal */}
                  <button
                    onClick={() => setActiveTab("proposal")}
                    className="w-full mt-2 p-3 bg-rc-blue hover:bg-rc-blue-light border border-slate-700/60 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>Prepare & Print Board Proposal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Interactive context information box */}
                  <div className="p-4 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-2.5 transition-colors">
                    <h4 className="font-bold text-amber-900 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Token Sizing & Cost Projections Advisory
                    </h4>
                    <p className="text-slate-600 leading-relaxed text-xxs">
                      Token estimates assume a single standard alert incident
                      feeds <strong>~2,500 tokens</strong> of observability
                      trace context (Input) and returns a average structured fix
                      recommendation of <strong>~450 tokens</strong> (Output).
                      Adjusting the active sliders lets you simulate larger
                      payloads or heavier log parsing runs safely.
                    </p>
                  </div>
                </section>
              </div>
            )}

            {/* Today vs Tomorrow operational matrix layout */}
            {activeTab === "matrix" && <TodayVsTomorrow />}

            {/* System pipeline flow interactive node flowchart */}
            {activeTab === "diagram" && (
              <AIOpsFrameworkDiagram state={calcState} />
            )}

            {/* Professional executive ROI proposal print setup */}
            {activeTab === "proposal" && (
              <div className="space-y-6">
                {/* Print parameters drawer */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow">
                  <h4 className="text-xs font-mono font-bold uppercase text-rc-accent tracking-wider mb-3">
                    Configure Proposal Exporter Metadata
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xxs font-bold text-slate-400 block uppercase">
                        Partner Organization / Company Name
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Acme Corporation"
                        className="w-full text-xs font-semibold p-2.5 rounded-xl bg-slate-950 border border-slate-850 text-white focus:border-rc-accent outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xxs font-bold text-slate-400 block uppercase">
                        Executive Owner Email
                      </label>
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="e.g. cio@company.com"
                        className="w-full text-xs font-semibold p-2.5 rounded-xl bg-slate-950 border border-slate-850 text-white focus:border-rc-accent outline-none"
                      />
                    </div>
                  </div>
                </div>

                <ProposalViewer
                  state={calcState}
                  breakdown={breakdown}
                  companyName={companyName}
                  clientEmail={clientEmail}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer information bar */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-500 mt-auto no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>
            © 2026 Royal Cyber Inc. All Rights Reserved. US Headquarters:
            Naperville, IL 60563.
          </p>
          <div className="flex gap-4">
            <a
              href="mailto:info@royalcyber.com"
              className="hover:text-slate-300 transition-colors"
            >
              info@royalcyber.com
            </a>
            <span>|</span>
            <span>+1.630.355.6292</span>
          </div>
        </div>
      </footer>

      {/* Inline dynamic info tooltip card */}
      {infoTooltip && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-slate-950 text-slate-100 border border-slate-800 rounded-xl shadow-lg text-xxs max-w-xs animate-fade-in">
          <p className="leading-relaxed">{infoTooltip}</p>
        </div>
      )}
    </div>
  );
}
