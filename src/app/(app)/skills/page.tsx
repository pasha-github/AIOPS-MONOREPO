"use client";

import { useEffect, useMemo, useState } from "react";
import Skilltable from "./Skilltable";
import { connectorOptions, mcpOptions, toolOptions, type SkillInventoryRow } from "./schema";
import CreateNewSkill from "./skillsoverview/createnewskill";
import SkillsTopbar from "./skillsoverview/skillstopbar";

type SkillListApiItem = {
  skill_id: string;
  name: string;
  description: string;
  instructions: string;
  created_at: string;
  updated_at: string;
};

const SKILL_LIST_URL = "https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/skill/";

function formatSkillDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SkillsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [rows, setRows] = useState<SkillInventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(SKILL_LIST_URL, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Failed to load skills (${response.status})`);

        const payload = (await response.json()) as SkillListApiItem[];
        const nextRows: SkillInventoryRow[] = payload.map((item) => ({
          id: item.skill_id,
          name: item.name,
          description: item.description,
          instructions: item.instructions,
          createdAt: formatSkillDate(item.created_at),
          updatedAt: formatSkillDate(item.updated_at),
        }));
        setRows(nextRows);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Keep current rows on error.
      } finally {
        setIsLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  const counts = useMemo(
    () => ({
      totalSkills: rows.length,
      totalTools: toolOptions.length,
      totalConnectors: connectorOptions.length,
      totalMcpInUse: mcpOptions.length,
    }),
    [rows.length]
  );

  return (
    <div className="space-y-8">
      <SkillsTopbar
        totalSkills={counts.totalSkills}
        totalTools={counts.totalTools}
        totalConnectors={counts.totalConnectors}
        totalMcpInUse={counts.totalMcpInUse}
        isLoading={isLoading}
        onCreate={() => setIsCreateOpen(true)}
      />
      <CreateNewSkill isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />

      <Skilltable rows={rows} />
    </div>
  );
}
