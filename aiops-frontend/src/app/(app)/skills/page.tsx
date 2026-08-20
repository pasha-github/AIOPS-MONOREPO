"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { useCallback, useEffect, useState } from "react";
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
import DeleteSkill from "./DeleteSkill";

export default function SkillsPage() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const apiBase = trimTrailingSlash(llmManagerApiBaseUrl);
  const [hasMounted, setHasMounted] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [rows, setRows] = useState<SkillInventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewTargetId, setViewTargetId] = useState<string | null>(null);
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const loadSkills = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiBase}/skill/`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal,
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
  }, [apiBase]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSkills(controller.signal);
    return () => controller.abort();
  }, [loadSkills]);

  return (
    <div className="space-y-8">
      <SkillsTopbar
        apiBase={apiBase}
        totalSkills={hasMounted ? rows.length : 0}
        totalTools={0}
        totalConnectors={0}
        totalMcpInUse={0}
        isLoading={!hasMounted || isLoading}
        onCreate={() => setIsCreateOpen(true)}
        onSkillUploaded={async () => {
          await loadSkills();
        }}
      />
      <CreateNewSkill
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={async () => {
          await loadSkills();
          setIsCreateOpen(false);
        }}
      />
      <ViewSkill skillId={viewTargetId} onClose={() => setViewTargetId(null)} />
      <UpdateSkill
        skillId={updateTargetId}
        onClose={() => setUpdateTargetId(null)}
        onUpdated={async () => {
          await loadSkills();
        }}
      />
      <DeleteSkill
        skillId={deleteTarget?.id ?? null}
        skillName={deleteTarget?.name ?? null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={async () => {
          await loadSkills();
          setDeleteTarget(null);
        }}
      />

      <Skilltable
        rows={hasMounted ? rows : []}
        isLoading={!hasMounted || isLoading}
        onView={setViewTargetId}
        onUpdate={setUpdateTargetId}
        onDelete={setDeleteTarget}
      />
    </div>
  );
}
