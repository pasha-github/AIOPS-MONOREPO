"use client";

import DualListPicker from "@/components/DualListPicker";
import { Bot } from "lucide-react";
import type { AgentLookupOption } from "../types";

type SubAgentsProps = {
  agentId: string;
  subAgentIds: string[];
  agentOptions: AgentLookupOption[];
  isAgentOptionsLoading: boolean;
  onChange: (ids: string[]) => void;
};

export default function SubAgents({
  agentId,
  subAgentIds,
  agentOptions,
  isAgentOptionsLoading,
  onChange,
}: SubAgentsProps) {
  return (
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        <Bot size={18} />
        Sub-Agents
      </label>
      <p className="mt-1 text-xs leading-snug text-gray-400">
        Choose sub-agents to include with this agent
      </p>
      <div className="mt-3">
        <DualListPicker
          availableTitle="Available Agents"
          selectedTitle="Selected Sub-Agents"
          items={agentOptions
            .filter((option) => option.id !== agentId)
            .map((option) => ({
              id: option.id,
              name: option.name,
              secondary: option.id,
            }))}
          selectedIds={subAgentIds}
          disabled={isAgentOptionsLoading}
          emptyAvailableMessage={
            isAgentOptionsLoading ? "Loading agents..." : "No agents available"
          }
          emptySelectedMessage="No sub-agents selected"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
