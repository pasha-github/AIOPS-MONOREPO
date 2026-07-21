/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMModelInfo, InfraOffering, AgentDeploymentOffering, SQLDatabaseOffering, EnterprisePreset } from "./types";

export const LLM_MODELS: LLMModelInfo[] = [
  {
    key: "claude-sonnet-4-6",
    name: "Claude 3.5 Sonnet (4.6)",
    provider: "Anthropic",
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0
  },
  {
    key: "anthropic/claude-sonnet-4-6",
    name: "Anthropic / Claude 3.5 Sonnet (4.6)",
    provider: "Anthropic",
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0
  },
  {
    key: "global.anthropic.claude-sonnet-4-6",
    name: "Global Anthropic Claude 3.5 Sonnet (4.6)",
    provider: "Anthropic (Global)",
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0
  },
  {
    key: "gemini-3-flash-preview",
    name: "Gemini 3 Flash (Preview)",
    provider: "Google Gemini",
    inputCostPerMillion: 0.5,
    outputCostPerMillion: 3.0
  },
  {
    key: "gemini/gemini-3-flash-preview",
    name: "Gemini3 Flash Preview (Native Alias)",
    provider: "Google Gemini",
    inputCostPerMillion: 0.5,
    outputCostPerMillion: 3.0
  },
  {
    key: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google Gemini",
    inputCostPerMillion: 0.3,
    outputCostPerMillion: 2.5
  },
  {
    key: "gemini/gemini-2.5-flash",
    name: "Gemini 2.5 Flash (Native Alias)",
    provider: "Google Gemini",
    inputCostPerMillion: 0.3,
    outputCostPerMillion: 2.5
  },
  {
    key: "claude-haiku-4-5",
    name: "Claude 4.5 Haiku",
    provider: "Anthropic",
    inputCostPerMillion: 1.0,
    outputCostPerMillion: 5.0
  },
  {
    key: "anthropic/claude-haiku-4-5",
    name: "Anthropic / Claude 4.5 Haiku (Alias)",
    provider: "Anthropic",
    inputCostPerMillion: 1.0,
    outputCostPerMillion: 5.0
  }
];

export const INFRA_OFFERINGS: InfraOffering[] = [
  // GCP
  {
    id: "gcp-cloudrun",
    name: "Cloud Run (Serverless Container)",
    baseCostPerMonth: 120,
    description: "Highly reactive serverless containers, scales down to zero when idle.",
    provider: "GCP"
  },
  {
    id: "gcp-k8s",
    name: "Google Kubernetes Engine (GKE)",
    baseCostPerMonth: 450,
    description: "Multi-node resilient Kubernetes orchestration for enterprise reliability.",
    provider: "GCP"
  },

  // Azure
  {
    id: "azure-container",
    name: "Azure Container Apps (ACA)",
    baseCostPerMonth: 150,
    description: "Serverless microservices platform built for active scalable agents.",
    provider: "Azure"
  },
  {
    id: "azure-k8s",
    name: "Azure Kubernetes Service (AKS)",
    baseCostPerMonth: 480,
    description: "Enterprise containerization with built-in Azure Active Directory support.",
    provider: "Azure"
  },

  // AWS
  {
    id: "aws-ecr",
    name: "AWS ECR & App Runner",
    baseCostPerMonth: 140,
    description: "Secure, simplified container runners mapped directly to AWS repositories.",
    provider: "AWS"
  },
  {
    id: "aws-k8s",
    name: "AWS Elastic Kubernetes Service (EKS)",
    baseCostPerMonth: 490,
    description: "High-throughput industrial cluster management with robust VPC networking.",
    provider: "AWS"
  },

  // Onprem
  {
    id: "onprem-docker",
    name: "Kubernetes / Docker On-Premise",
    baseCostPerMonth: 200,
    description: "Self-managed bare-metal Docker or standard internal K8s workloads.",
    provider: "Onprem"
  },
  {
    id: "onprem-vm",
    name: "Virtual Machines (VM Web Host)",
    baseCostPerMonth: 100,
    description: "Legacy hypervisor or internal server VM allocation.",
    provider: "Onprem"
  }
];

export const AGENT_DEPLOYMENTS: AgentDeploymentOffering[] = [
  {
    id: "agent-internal",
    name: "Internal Runtime",
    baseCostPerMonth: 110,
    description: "Lightweight native Python/Node worker threads running adjacent to system metrics telemetry feeds."
  },
  {
    id: "agent-aws",
    name: "AWS AgentCore",
    baseCostPerMonth: 320,
    description: "Managed agent runtime utilizing pre-authenticated Amazon Bedrock agent integrations."
  },
  {
    id: "agent-azure",
    name: "Azure Foundry Agent Service",
    baseCostPerMonth: 340,
    description: "Low-latency stateful orchestrator with tight Azure Active Directory authentication layers."
  },
  {
    id: "agent-vertex",
    name: "Vertex AI Agent Engine",
    baseCostPerMonth: 330,
    description: "Google Cloud managed Agent runtime providing built-in evaluation trackers and custom grounding tools."
  }
];

export const SQL_DATABASES: SQLDatabaseOffering[] = [
  {
    id: "db-standard",
    name: "Standard SQL DB Instance",
    baseCostPerMonth: 80,
    description: "Single instance SQL database with daily automatic snapshots and standard IOPS.",
    type: "Single node relational SQL"
  },
  {
    id: "db-ha",
    name: "High-Availability DB Replica",
    baseCostPerMonth: 220,
    description: "Dual-zone hot stand-by database instance with automatic connection failover protection.",
    type: "Multi-AZ Replication Relational"
  },
  {
    id: "db-enterprise",
    name: "Enterprise Clustered SQL SQL-Scale",
    baseCostPerMonth: 450,
    description: "Fully sharded database with microsecond performance queues, built for parallel enterprise queries.",
    type: "Sharded High-Availability SQL"
  }
];

export const ENTERPRISE_PRESETS: Record<"small" | "medium" | "large", EnterprisePreset> = {
  small: {
    id: "small",
    name: "Small Enterprise / SMB Unit",
    description: "Perfect for single microservices or internal infrastructure monitors needing standard chat triggers.",
    servicesCount: 8,
    monthlyIncidents: 150,
    pctAutomated: 60,
    inputTokensMillion: 30,
    outputTokensMillion: 8,
    supportStaffSaved: 1, // 1 FTE equivalent saved
    avgL1CostPerIncident: 20, // $20 avg manual cost
    infraProvider: "GCP",
    infraOptionId: "gcp-cloudrun",
    dbOptionId: "db-standard",
    agentDeploymentId: "agent-internal",
    llmModelKey: "gemini-2.5-flash",
    licensingBaseFee: 125,
    licensingPerServiceFee: 12.5
  },
  medium: {
    id: "medium",
    name: "Medium Enterprise / Multi-App Division",
    description: "Ideal for handling a portfolio of applications with active auto-healing RAG knowledge bases.",
    servicesCount: 45,
    monthlyIncidents: 850,
    pctAutomated: 75,
    inputTokensMillion: 220,
    outputTokensMillion: 55,
    supportStaffSaved: 4, // 4 FTEs saved
    avgL1CostPerIncident: 25, // $25 avg manual cost
    infraProvider: "AWS",
    infraOptionId: "aws-ecr",
    dbOptionId: "db-ha",
    agentDeploymentId: "agent-aws",
    llmModelKey: "gemini-3-flash-preview",
    licensingBaseFee: 125,
    licensingPerServiceFee: 12.5
  },
  large: {
    id: "large",
    name: "Large Global Enterprise Scale",
    description: "Designed for full global coverage with thousands of services, deep multi-agent collaboration, and robust failovers.",
    servicesCount: 220,
    monthlyIncidents: 4200,
    pctAutomated: 83,
    inputTokensMillion: 1100, // 1.1 Billion
    outputTokensMillion: 250, // 250 Million
    supportStaffSaved: 15, // 15 FTEs saved
    avgL1CostPerIncident: 30,
    infraProvider: "Azure",
    infraOptionId: "azure-k8s",
    dbOptionId: "db-enterprise",
    agentDeploymentId: "agent-azure",
    llmModelKey: "claude-sonnet-4-6",
    licensingBaseFee: 125,
    licensingPerServiceFee: 12.5
  }
};
