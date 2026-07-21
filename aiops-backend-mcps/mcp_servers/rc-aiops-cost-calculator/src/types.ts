/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LLMModelInfo {
  key: string;
  name: string;
  provider: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface InfraOffering {
  id: string;
  name: string;
  baseCostPerMonth: number;
  description: string;
  provider: "GCP" | "Azure" | "AWS" | "Onprem";
}

export interface AgentDeploymentOffering {
  id: string;
  name: string;
  baseCostPerMonth: number;
  description: string;
}

export interface SQLDatabaseOffering {
  id: string;
  name: string;
  baseCostPerMonth: number;
  description: string;
  type: string;
}

export interface EnterprisePreset {
  id: "small" | "medium" | "large";
  name: string;
  description: string;
  servicesCount: number;
  monthlyIncidents: number;
  pctAutomated: number;
  inputTokensMillion: number;
  outputTokensMillion: number;
  supportStaffSaved: number;
  avgL1CostPerIncident: number;
  infraProvider: "GCP" | "Azure" | "AWS" | "Onprem";
  infraOptionId: string;
  dbOptionId: string;
  agentDeploymentId: string;
  llmModelKey: string;
  licensingBaseFee: number;
  licensingPerServiceFee: number;
}

export interface CalculatorState {
  enterprisePreset: "small" | "medium" | "large" | "custom";
  servicesCount: number;
  monthlyIncidents: number;
  pctAutomated: number; // e.g. 60 for 60%
  inputTokensMillion: number;
  outputTokensMillion: number;
  supportStaffSaved: number;
  avgL1CostPerIncident: number;
  
  infraProvider: "GCP" | "Azure" | "AWS" | "Onprem";
  infraOptionId: string;
  dbOptionId: string;
  agentDeploymentId: string;
  llmModelKey: string;

  // Custom additions for more realism:
  kbSyncFrequency: "realtime" | "hourly" | "daily";
  retriesEnabled: boolean;
  licensingBaseFee: number;
  licensingPerServiceFee: number;
}

export interface CostBreakdown {
  llmInputCost: number;
  llmOutputCost: number;
  llmTotalCost: number;
  infraCost: number;
  dbCost: number;
  agentDeploymentCost: number;
  agentLicensingCost: number; // e.g. RC software fee, let's keep it highly relevant
  totalActualCost: number;
  
  // Savings:
  legacySupportCost: number; // incidents * cost
  savedIncidentCost: number; // (incidents * pctAutomated) * cost
  netSavings: number;
  roiPercentage: number;
}
