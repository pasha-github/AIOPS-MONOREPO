"use client";

import {
  Bell,
  BookOpen,
  ChevronDown,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function formatTitle(pathname: string) {
  const clean = pathname.split("?")[0].split("#")[0];
  const segment = clean.split("/").filter(Boolean).at(-1) ?? "dashboard";
  const overrides: Record<string, string> = {
    connectors: "Connectors",
    visualizer: "Agent Visualizer",
  };
  const wordMap: Record<string, string> = {
    llm: "LLM",
    api: "API",
    ui: "UI",
    id: "ID",
  };

  if (overrides[segment]) {
    return overrides[segment];
  }
  return segment
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();

      if (wordMap[lower]) {
        return wordMap[lower];
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export default function TopBar() {
  const pathname = usePathname();
  const title = useMemo(() => formatTitle(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-[#e6e9f2] bg-white px-8 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-[#10131a]">{title}</h1>
      </div>

      <div className="relative flex items-center gap-4" ref={menuRef}>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e6e9f2] text-[#6e7688] hover:text-[#3f35d3]"
          aria-label="Help and docs"
          title="Help and docs"
        >
          <BookOpen className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#e6e9f2] text-[#6e7688] hover:text-[#3f35d3]"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff4d4f]" />
        </button>

        <span className="h-8 w-px bg-[#e6e9f2]" />

        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-[#e6e9f2] px-2 py-1 text-[#6e7688] hover:text-[#3f35d3]"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef1ff] text-[#5b4cf0]">
            <UserRound className="h-4 w-4" />
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {open ? (
          <div className="absolute right-0 top-full z-50 mt-3 w-52 rounded-2xl border border-[#eef1f7] bg-white p-2 shadow-[0_20px_50px_-30px_rgba(15,17,21,0.6)]" role="menu">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#1b1f2a] hover:bg-[#f6f7fb]"
              role="menuitem"
            >
              <UserRound className="h-4 w-4 text-[#6b72ff]" />
              Profile
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#1b1f2a] hover:bg-[#f6f7fb]"
              role="menuitem"
            >
              <Settings className="h-4 w-4 text-[#b18bff]" />
              Setting
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#1b1f2a] hover:bg-[#f6f7fb]"
              role="menuitem"
            >
              <LogOut className="h-4 w-4 text-[#ff7b7b]" />
              Sign Out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
