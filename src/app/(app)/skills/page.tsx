"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { useEffect, useState } from "react";
import Skilltable from "./Skilltable";
import type { SkillInventoryRow } from "./schema";
import {
  getSkillErrorMessage,
  normalizeSkillInventoryRows,
} from "./skillHelpers";
import CreateNewSkill from "./skillsoverview/createnewskill";
import SkillsTopbar from "./skillsoverview/skillstopbar";
import UpdateSkill from "./UpdateSkill";
import ViewSkill from "./ViewSkill";

export default function SkillsPage() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const apiBase = trimTrailingSlash(llmManagerApiBaseUrl);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [rows, setRows] = useState<SkillInventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewTargetId, setViewTargetId] = useState<string | null>(null);
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadSkills = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${apiBase}/skill/`, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getSkillErrorMessage(payload, "Unable to load skills."));
        }

        setRows(normalizeSkillInventoryRows(payload));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSkills();
    return () => controller.abort();
  }, [apiBase]);

  return (
    <div className="space-y-8">
      <SkillsTopbar
        totalSkills={rows.length}
        totalTools={0}
        totalConnectors={0}
        totalMcpInUse={0}
        isLoading={isLoading}
        onCreate={() => setIsCreateOpen(true)}
      />
      <CreateNewSkill isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <ViewSkill skillId={viewTargetId} onClose={() => setViewTargetId(null)} />
      <UpdateSkill
        skillId={updateTargetId}
        onClose={() => setUpdateTargetId(null)}
        onUpdated={async () => {
          const response = await fetch(`${apiBase}/skill/`, {
            method: "GET",
            headers: { accept: "application/json" },
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            return;
          }
          setRows(normalizeSkillInventoryRows(payload));
        }}
      />

      <Skilltable
        rows={rows}
        onView={setViewTargetId}
        onUpdate={setUpdateTargetId}
        onDelete={() => undefined}
      />
    </div>
  );
}
