"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Loader2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { getSkillErrorMessage } from "./skillHelpers";

type DeleteSkillProps = {
  skillId: string | null;
  skillName: string | null;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
};

export default function DeleteSkill({
  skillId,
  skillName,
  onClose,
  onDeleted,
}: DeleteSkillProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const apiBase = trimTrailingSlash(llmManagerApiBaseUrl);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!skillId) {
    return null;
  }

  const handleClose = () => {
    if (isDeleting) {
      return;
    }

    setDeleteError("");
    onClose();
  };

  const handleDeleteSkill = async () => {
    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`${apiBase}/skill/${encodeURIComponent(skillId)}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(getSkillErrorMessage(payload, "Unable to delete skill."));
      }

      await onDeleted();
      setDeleteError("");
      onClose();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete skill.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/30 px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
        <div className="flex items-center justify-between border-b border-[#fee2e2] bg-[#fff5f5] px-6 py-4">
          <div className="flex items-center gap-2 text-[#b91c1c]">
            <Trash2 className="h-5 w-5" />
            <h4 className="text-lg font-semibold">Delete Skill</h4>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b91c1c]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-[#374151]">
            Are you sure you want to delete this skill?
          </p>
          <p className="mt-2 max-w-full break-all rounded-md bg-[#fee2e2] px-2 py-1 font-semibold text-[#b91c1c]">
            {skillName || skillId}
          </p>
          <p className="mt-3 text-xs text-[#9b1c1c]">
            This action cannot be undone.
          </p>
          {deleteError ? (
            <p className="mt-3 text-sm text-[#dc2626]">{deleteError}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteSkill()}
            disabled={isDeleting}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] ${
              isDeleting
                ? "cursor-not-allowed bg-[#fca5a5]"
                : "bg-[#ef4444] hover:bg-[#dc2626]"
            }`}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
