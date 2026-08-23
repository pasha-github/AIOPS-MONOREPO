"use client";

import { DraftHighlightedField } from "../DraftGenerationAnimation";

type IdentityProps = {
  agentName: string;
  description: string;
  onAgentNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  highlight?: boolean;
};

export default function Identity({
  agentName,
  description,
  onAgentNameChange,
  onDescriptionChange,
  highlight = false,
}: IdentityProps) {
  return (
    <div className="space-y-4">
      <DraftHighlightedField active={highlight}>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <p className="text-xs leading-snug text-gray-400">
            Human-readable display name for this agent
          </p>
          <input
            type="text"
            value={agentName}
            onChange={(event) => onAgentNameChange(event.target.value)}
            placeholder="e.g., Customer Support Assistant"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>
      </DraftHighlightedField>

      <DraftHighlightedField active={highlight}>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <p className="text-xs leading-snug text-gray-400">
            Brief summary of what this agent does
          </p>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="What does this agent do?"
            rows={4}
            className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>
      </DraftHighlightedField>
    </div>
  );
}
