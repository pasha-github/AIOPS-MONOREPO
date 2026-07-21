"use client";

import TabUserinterface from "@/components/Tab-Userinterface";
import type { ReactNode } from "react";

export const CREATE_AGENT_TABS = [
  "Identity",
  "Prompt Instructions",
  "Models",
  "Deployment",
  "Integrations",
  "Sub-Agents",
  "Guardrails",
  "Knowledge Sources",
] as const;

type AgentFormPagesProps = {
  activeTab: number;
  onTabChange: (index: number) => void;
  identity: ReactNode;
  deployment: ReactNode;
  promptInstructions: ReactNode;
  models: ReactNode;
  capabilities: ReactNode;
  subAgents: ReactNode;
  guardrails: ReactNode;
  knowledgeSources: ReactNode;
};

export default function AgentFormPages({
  activeTab,
  onTabChange,
  identity,
  deployment,
  promptInstructions,
  models,
  capabilities,
  subAgents,
  guardrails,
  knowledgeSources,
}: AgentFormPagesProps) {
  const pages = [
    identity,
    promptInstructions,
    models,
    deployment,
    capabilities,
    subAgents,
    guardrails,
    knowledgeSources,
  ];

  return (
    <div className="flex flex-col gap-4">
      <TabUserinterface
        tabs={CREATE_AGENT_TABS}
        activeIndex={activeTab}
        onChange={onTabChange}
        minWidthClassName="min-w-0"
        gridClassName="grid-cols-8"
      />
      <div className="rounded-2xl bg-white p-1">{pages[activeTab] ?? pages[0]}</div>
    </div>
  );
}
