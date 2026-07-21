"use client";

import AwsCredentialDropdown from "../AwsCredentialDropdown";
import { ThemedSingleDropdown } from "../DynamicConnector";
import type { AwsCredentialOption } from "../awsCredentials";
import {
  AGENT_TYPE_OPTIONS,
  DEPLOYMENT_TARGET_OPTIONS,
  MEMORY_BANK_OPTIONS,
  MEMORY_RETRIEVAL_OPTIONS,
} from "../types";

type DeploymentProps = {
  deploymentTarget: string;
  agentType: string;
  memoryEnabledValue: string;
  memoryToolType: string;
  awsCredentialId: string;
  awsCredentialOptions: AwsCredentialOption[];
  isAwsCredentialsLoading: boolean;
  awsCredentialsLoadError: string;
  isAwsAgentCoreSelected: boolean;
  isVertexAgentEngineSelected: boolean;
  onDeploymentTargetChange: (value: string) => void;
  onAgentTypeChange: (value: string) => void;
  onMemoryEnabledValueChange: (value: string) => void;
  onMemoryToolTypeChange: (value: string) => void;
  onAwsCredentialIdChange: (value: string) => void;
};

export default function Deployment({
  deploymentTarget,
  agentType,
  memoryEnabledValue,
  memoryToolType,
  awsCredentialId,
  awsCredentialOptions,
  isAwsCredentialsLoading,
  awsCredentialsLoadError,
  isAwsAgentCoreSelected,
  isVertexAgentEngineSelected,
  onDeploymentTargetChange,
  onAgentTypeChange,
  onMemoryEnabledValueChange,
  onMemoryToolTypeChange,
  onAwsCredentialIdChange,
}: DeploymentProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
            Deployment Target
          </label>
          <p className="text-xs leading-snug text-gray-400">Select where this agent will run</p>
          <ThemedSingleDropdown
            value={deploymentTarget}
            options={DEPLOYMENT_TARGET_OPTIONS.map((option) => ({
              value: option.value,
              label: option.key,
            }))}
            placeholder="Select deployment target"
            onChange={onDeploymentTargetChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
            Type
          </label>
          <p className="text-xs leading-snug text-gray-400">Select the agent classification</p>
          <ThemedSingleDropdown
            value={agentType}
            options={AGENT_TYPE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.key,
            }))}
            placeholder="Select type"
            onChange={onAgentTypeChange}
          />
        </div>
      </div>

      {isAwsAgentCoreSelected ? (
        <AwsCredentialDropdown
          value={awsCredentialId}
          options={awsCredentialOptions}
          loading={isAwsCredentialsLoading}
          error={awsCredentialsLoadError}
          onChange={onAwsCredentialIdChange}
        />
      ) : null}

      {isVertexAgentEngineSelected ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
              Memory Bank
            </label>
            <p className="text-xs leading-snug text-gray-400">
              Enable or disable memory for this Vertex agent
            </p>
            <ThemedSingleDropdown
              value={memoryEnabledValue}
              options={MEMORY_BANK_OPTIONS.map((option) => ({
                value: String(option.value),
                label: option.key,
              }))}
              placeholder="Select memory bank"
              onChange={onMemoryEnabledValueChange}
            />
          </div>

          {memoryEnabledValue === "true" ? (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                Memory Retrieval
              </label>
              <p className="text-xs leading-snug text-gray-400">
                Choose how memory is retrieved for this Vertex agent
              </p>
              <ThemedSingleDropdown
                value={memoryToolType}
                options={MEMORY_RETRIEVAL_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.key,
                }))}
                placeholder="Select memory retrieval"
                onChange={onMemoryToolTypeChange}
              />
            </div>
          ) : (
            <div />
          )}
        </div>
      ) : null}
    </div>
  );
}
