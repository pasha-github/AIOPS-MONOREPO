"use client";

import { VISUALIZER_EDGE_COLORS } from "./shared";

const LEGEND_ITEMS = [
  {
    label: "Agent to Agent",
    color: VISUALIZER_EDGE_COLORS.agentToAgent,
  },
  {
    label: "Agent to Skill",
    color: VISUALIZER_EDGE_COLORS.agentToSkill,
  },
  {
    label: "Skill/Agent to Connector",
    color: VISUALIZER_EDGE_COLORS.connector,
  },
  {
    label: "Skill/Agent to MCP",
    color: VISUALIZER_EDGE_COLORS.mcp,
  },
] as const;

export default function VisualizerKey() {
  return (
    <div className="absolute left-5 top-5 z-30 backdrop-blur-sm">
      <div className="space-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className="relative block h-0.5 w-11 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            >
              <span
                className="absolute -right-0.5 -top-[5px] h-0 w-0 border-y-[6px] border-l-[8px] border-y-transparent"
                style={{ borderLeftColor: item.color }}
              />
            </span>
            <span className="text-[12px] font-medium leading-4 text-slate-700">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
