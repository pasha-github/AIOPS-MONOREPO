"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ActionMenuItem = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone: string;
  hoverTone: string;
  disabled?: boolean;
  disabledTitle?: string;
};

type ActionMenuProps = {
  actions: ActionMenuItem[];
  align?: "left" | "right";
  menuWidth?: number;
  estimatedMenuHeight?: number;
  renderButton: (props: {
    isOpen: boolean;
    buttonRef: (node: HTMLButtonElement | null) => void;
    toggle: () => void;
  }) => ReactNode;
};

export default function ActionMenu({
  actions,
  align = "right",
  menuWidth = 176,
  estimatedMenuHeight,
  renderButton,
}: ActionMenuProps) {
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

    const nextEstimatedHeight =
      typeof estimatedMenuHeight === "number"
        ? estimatedMenuHeight
        : Math.max(120, actions.length * 40);

    const updatePosition = () => {
      if (!buttonRef.current) {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const viewportPadding = 16;
      const nextLeft =
        align === "left"
          ? Math.min(
              Math.max(viewportPadding, rect.left),
              window.innerWidth - menuWidth - viewportPadding
            )
          : Math.min(
              Math.max(viewportPadding, rect.right - menuWidth),
              window.innerWidth - menuWidth - viewportPadding
            );

      const shouldOpenUpward =
        rect.bottom + 8 + nextEstimatedHeight >
        window.innerHeight - viewportPadding;
      const nextTop = shouldOpenUpward
        ? Math.max(viewportPadding, rect.top - nextEstimatedHeight - 8)
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
  }, [actions.length, align, estimatedMenuHeight, isOpen, menuWidth]);

  return (
    <div ref={containerRef} className="relative">
      {renderButton({
        isOpen,
        buttonRef: (node) => {
          buttonRef.current = node;
        },
        toggle: () => setIsOpen((current) => !current),
      })}

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
                const disabled = Boolean(action.disabled);

                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      if (disabled) {
                        return;
                      }
                      setIsOpen(false);
                      action.onClick();
                    }}
                    disabled={disabled}
                    title={disabled ? action.disabledTitle : undefined}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                      disabled
                        ? "cursor-not-allowed bg-[#f8fafc] text-[#94a3b8]"
                        : `${action.tone} ${action.hoverTone}`
                    }`}
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

