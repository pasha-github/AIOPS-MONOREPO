"use client";

import { ChevronDown, Eye, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

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
      const viewportPadding = 16;
      const nextLeft = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding
      );

      setMenuPosition({
        top: rect.bottom + 8,
        left: nextLeft,
      });
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
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
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

      {isOpen
          ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[120] w-44 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)]"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
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
