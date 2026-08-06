"use client";

import DualListPicker from "@/components/DualListPicker";
import { Bot } from "lucide-react";
import { ThemedSingleDropdown } from "../DynamicConnector";
import {
  SUB_AGENT_DELEGATION_OPTIONS,
  type AgentLookupOption,
  type SubAgentDelegationType,
} from "../types";

type SubAgentsProps = {
  agentId: string;
  subAgentIds: string[];
  subAgentDelegationType: SubAgentDelegationType;
  agentOptions: AgentLookupOption[];
  isAgentOptionsLoading: boolean;
  onChange: (ids: string[]) => void;
  onDelegationTypeChange: (delegationType: SubAgentDelegationType) => void;
};

export default function SubAgents({
  agentId,
  subAgentIds,
  subAgentDelegationType,
  agentOptions,
  isAgentOptionsLoading,
  onChange,
  onDelegationTypeChange,
}: SubAgentsProps) {
  const delegationOptions = SUB_AGENT_DELEGATION_OPTIONS.map((option) => ({
    value: option.value,
    label: option.key,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
            <Bot size={18} />
            Sub-Agents
          </label>
          <p className="mt-1 text-xs leading-snug text-gray-400">
            Choose sub-agents to include with this agent
          </p>
        </div>
        <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
          <label className="shrink-0 text-xs font-semibold text-[#7a8498]">
            Delegation Type
          </label>
          <div className="w-[150px]">
            <ThemedSingleDropdown
              value={subAgentDelegationType}
              options={delegationOptions}
              includePlaceholderOption={false}
              onChange={(value) => {
                if (value === "task" || value === "full") {
                  onDelegationTypeChange(value);
                }
              }}
            />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <DualListPicker
          availableTitle="Available Agents"
          selectedTitle="Selected Sub-Agents"
          items={agentOptions
            .filter((option) => option.id !== agentId)
            .map((option) => ({
              id: option.id,
              name: option.name,
            }))}
          selectedIds={subAgentIds}
          disabled={isAgentOptionsLoading}
          emptyAvailableMessage={
            isAgentOptionsLoading ? "Loading agents..." : "No agents available"
          }
          emptySelectedMessage="No sub-agents selected"
          onChange={onChange}
          renderAvailableItem={(item) => (
            <div className="min-w-0">
              <div className="break-words font-medium">{item.name}</div>
            </div>
          )}
          renderSelectedItem={(item) => (
            <div className="w-full min-w-0">
              <div className="min-w-0">
                <div className="break-words font-medium">{item.name}</div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
