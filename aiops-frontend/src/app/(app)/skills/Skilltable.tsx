"use client";

import ActionMenu, { type ActionMenuItem } from "@/components/ActionMenu";
import ExpandableMarkdownText from "@/components/ExpandableMarkdownText";
import { ChevronDown, Eye, Pencil, Trash2 } from "lucide-react";
import type { SkillInventoryRow } from "./schema";

type SkilltableProps = {
  rows: SkillInventoryRow[];
  isLoading: boolean;
  onView: (skillId: string) => void;
  onUpdate: (skillId: string) => void;
  onDelete: (skill: { id: string; name: string }) => void;
};

type ActionItem = {
  label: string;
  icon: typeof Eye;
  tone: string;
  hoverTone: string;
  onClick: () => void;
};

function SkillActionMenu({
  skillId,
  skillName,
  onView,
  onUpdate,
  onDelete,
}: {
  skillId: string;
  skillName: string;
  onView: (skillId: string) => void;
  onUpdate: (skillId: string) => void;
  onDelete: (skill: { id: string; name: string }) => void;
}) {
  const actions: ActionItem[] = [
    {
      label: "View",
      icon: Eye,
      tone: "text-[#111827]",
      hoverTone: "hover:bg-[#f8fafc]",
      onClick: () => onView(skillId),
    },
    {
      label: "Update",
      icon: Pencil,
      tone: "text-[#2563eb]",
      hoverTone: "hover:bg-[#eff6ff]",
      onClick: () => onUpdate(skillId),
    },
    {
      label: "Delete",
      icon: Trash2,
      tone: "text-[#b91c1c]",
      hoverTone: "hover:bg-[#fff1f2]",
      onClick: () => onDelete({ id: skillId, name: skillName }),
    },
  ];

  return (
    <ActionMenu
      align="right"
      actions={actions satisfies ActionMenuItem[]}
      renderButton={({ isOpen, toggle, buttonRef }) => (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
            isOpen
              ? "border-[#d8e1f0] bg-[#eef2ff] text-[#4f49e2]"
              : "border-[#d8e1f0] bg-white text-[#475569] hover:bg-[#eef2ff] hover:text-[#4f49e2]"
          }`}
          aria-label={`Open actions for ${skillName}`}
          title={`Open actions for ${skillName}`}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}
    />
  );
}

export default function Skilltable({
  rows,
  isLoading,
  onView,
  onUpdate,
  onDelete,
}: SkilltableProps) {
  return (
    <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="space-y-6">
        <div className="max-w-3xl">
          <h3 className="text-lg font-semibold text-[#111827]">Skills Inventory</h3>
          <p className="mt-1 text-sm text-[#5b6476]">
            Review all skill records and metadata from one place.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#eef1f7]">
          {isLoading ? (
            <div className="min-w-[1200px] bg-white">
              <div className="grid grid-cols-[1.2fr_1.7fr_2fr_1.2fr_1.2fr_120px] items-center divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#111827]">
                <span className="px-4">Name</span>
                <span className="px-4">Description</span>
                <span className="px-4">Instructions</span>
                <span className="px-4">Created At</span>
                <span className="px-4">Updated At</span>
                <span className="px-3 text-right">Action</span>
              </div>

              <div className="divide-y divide-[#eef1f7] bg-white">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`skill-skeleton-${index}`}
                      className="grid grid-cols-[1.2fr_1.7fr_2fr_1.2fr_1.2fr_120px] animate-pulse items-center divide-x divide-[#e8eef7] px-4 py-4"
                    >
                      <div className="space-y-2 px-4">
                        <div className="h-4 w-32 rounded bg-[#edf2f9]" />
                        <div className="h-3 w-24 rounded bg-[#edf2f9]" />
                      </div>
                      <div className="space-y-2 px-4">
                        <div className="h-4 w-full rounded bg-[#edf2f9]" />
                        <div className="h-4 w-4/5 rounded bg-[#edf2f9]" />
                      </div>
                      <div className="space-y-2 px-4">
                        <div className="h-4 w-full rounded bg-[#edf2f9]" />
                        <div className="h-4 w-5/6 rounded bg-[#edf2f9]" />
                      </div>
                      <div className="px-4">
                        <div className="h-4 w-28 rounded bg-[#edf2f9]" />
                      </div>
                      <div className="px-4">
                        <div className="h-4 w-28 rounded bg-[#edf2f9]" />
                      </div>
                      <div className="flex justify-end px-3">
                        <div className="h-10 w-10 rounded-xl bg-[#edf2f9]" />
                      </div>
                    </div>
                ))}
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center bg-white px-6 text-center">
              <div>
                <p className="text-base font-semibold text-[#111827]">
                  No skills found
                </p>
                <p className="mt-2 text-sm text-[#64748b]">
                  Create a skill to see it here.
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-[1200px]">
              <div className="grid grid-cols-[1.2fr_1.7fr_2fr_1.2fr_1.2fr_120px] items-center divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#111827]">
                <span className="flex h-full items-center capitalize px-3 text-left leading-tight whitespace-normal break-words">Name</span>
                <span className="flex h-full items-center capitalize px-3 text-left leading-tight whitespace-normal break-words">Description</span>
                <span className="flex h-full items-center capitalize px-3 text-left leading-tight whitespace-normal break-words">Instructions</span>
                <span className="flex h-full items-center capitalize px-3 text-left leading-tight whitespace-normal break-words">Created At</span>
                <span className="flex h-full items-center capitalize px-3 text-left leading-tight whitespace-normal break-words">Updated At</span>
                <span className="flex h-full items-center justify-end px-3 text-right">Action</span>
              </div>

              <div className="divide-y divide-[#eef1f7] bg-white">
                {rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[1.2fr_1.7fr_2fr_1.2fr_1.2fr_120px] items-stretch divide-x divide-[#e8eef7] px-4 py-4 text-sm text-[#2b3341]"
                    >
                      <div className="flex h-full items-start px-4 font-semibold text-[#111827]">
                        {row.name}
                      </div>
                      <div className="flex h-full items-start px-4 text-[#4b5563]">
                        <ExpandableMarkdownText
                          value={row.description}
                          title={`${row.name} description`}
                          limit={140}
                        />
                      </div>
                      <div className="flex h-full items-start px-4 text-[#4b5563]">
                        <ExpandableMarkdownText
                          value={row.instructions}
                          title={`${row.name} instructions`}
                        />
                      </div>
                      <div className="flex h-full items-start px-4 text-[#4b5563]">
                        {row.createdAt}
                      </div>
                      <div className="flex h-full items-start px-4 text-[#4b5563]">
                        {row.updatedAt}
                      </div>
                      <div className="flex h-full items-start justify-end px-3">
                        <SkillActionMenu
                          skillId={row.id}
                          skillName={row.name}
                          onView={onView}
                          onUpdate={onUpdate}
                          onDelete={onDelete}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
