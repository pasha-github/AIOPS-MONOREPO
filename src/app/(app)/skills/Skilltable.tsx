"use client";

import { ChevronDown, Eye, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SkillInventoryRow } from "./schema";

type SkilltableProps = {
  rows: SkillInventoryRow[];
  isLoading: boolean;
  onView: (skillId: string) => void;
  onUpdate: (skillId: string) => void;
  onDelete: (skillId: string) => void;
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
  onDelete: (skillId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [openUpward, setOpenUpward] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current) {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const estimatedMenuHeight = 120;
      const viewportPadding = 16;
      const nextLeft = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding
      );
      const shouldOpenUpward =
        rect.bottom + 8 + estimatedMenuHeight >
        window.innerHeight - viewportPadding;
      const nextTop = shouldOpenUpward
        ? Math.max(viewportPadding, rect.top - estimatedMenuHeight - 8)
        : rect.bottom + 8;

      setMenuPosition({ top: nextTop, left: nextLeft });
      setOpenUpward(shouldOpenUpward);
    };

    updatePosition();

    const handleClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node;

      if (
        containerRef.current &&
        !containerRef.current.contains(targetNode) &&
        menuRef.current &&
        !menuRef.current.contains(targetNode)
      ) {
        setIsOpen(false);
      }
    };

    const handleViewportChange = () => updatePosition();

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

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
      onClick: () => onDelete(skillId),
    },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
          isOpen
            ? "border-[#d8e1f0] bg-[#eef2ff] text-[#4f49e2]"
            : "border-[#d8e1f0] bg-white text-[#475569] hover:bg-[#eef2ff] hover:text-[#4f49e2]"
        }`}
        aria-label={`Open actions for ${skillName}`}
        title={`Open actions for ${skillName}`}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[120] w-44 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)]"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                transformOrigin: openUpward ? "bottom right" : "top right",
              }}
            >
              {actions.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      action.onClick();
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${action.tone} ${action.hoverTone}`}
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
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
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-[1.2fr_1.7fr_2fr_1.2fr_1.2fr_120px] items-center divide-x divide-[#d7e0ee] bg-[#f3f6fb] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#111827]">
              <span className="px-4">Name</span>
              <span className="px-4">Description</span>
              <span className="px-4">Instructions</span>
              <span className="px-4">Created At</span>
              <span className="px-4">Updated At</span>
              <span className="px-3 text-right">Action</span>
            </div>

            <div className="divide-y divide-[#eef1f7] bg-white">
              {isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
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
                  ))
                : rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[1.2fr_1.7fr_2fr_1.2fr_1.2fr_120px] items-start divide-x divide-[#e8eef7] px-4 py-4 text-sm text-[#2b3341]"
                    >
                      <div className="px-4 font-semibold text-[#111827]">{row.name}</div>
                      <div className="px-4 text-[#4b5563]">{row.description}</div>
                      <div className="px-4 text-[#4b5563]">{row.instructions}</div>
                      <div className="px-4 text-[#4b5563]">{row.createdAt}</div>
                      <div className="px-4 text-[#4b5563]">{row.updatedAt}</div>
                      <div className="flex justify-end px-3">
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
        </div>
      </div>
    </section>
  );
}
