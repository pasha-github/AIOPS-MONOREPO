"use client";

import ActionMenu, { type ActionMenuItem } from "@/components/ActionMenu";
import { ChevronDown, Eye, Pencil, Trash2 } from "lucide-react";

import type { McpServer } from "./mcpHelpers";

type McpActionMenuProps = {
  server: McpServer;
  onView: (server: McpServer) => void;
  onUpdate: (server: McpServer) => void;
  onDelete: (server: McpServer) => void;
};

type ActionItem = {
  label: string;
  icon: typeof Eye;
  onClick: () => void;
  tone: string;
  hoverTone: string;
};

export default function McpActionMenu({
  server,
  onView,
  onUpdate,
  onDelete,
}: McpActionMenuProps) {
  const actions: ActionItem[] = [
    {
      label: "View",
      icon: Eye,
      onClick: () => onView(server),
      tone: "text-[#111827]",
      hoverTone: "hover:bg-[#f8fafc]",
    },
    {
      label: "Update",
      icon: Pencil,
      onClick: () => onUpdate(server),
      tone: "text-[#2563eb]",
      hoverTone: "hover:bg-[#eff6ff]",
    },
    {
      label: "Delete",
      icon: Trash2,
      onClick: () => onDelete(server),
      tone: "text-[#b91c1c]",
      hoverTone: "hover:bg-[#fff1f2]",
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
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            isOpen
              ? "border-[#d8e1f0] bg-[#eef2ff] text-[#4f49e2]"
              : "border-[#d8e1f0] bg-white text-[#475569] hover:bg-[#eef2ff] hover:text-[#4f49e2]"
          }`}
          aria-label={`Open actions for ${server.name}`}
          title={`Open actions for ${server.name}`}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}
    />
  );
}
