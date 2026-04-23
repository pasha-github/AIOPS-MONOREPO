"use client";

import {
  Activity,
  Bot,
  LayoutGrid,
  Link2,
  MessageSquare,
  Network,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

type NavItem = {
  id: string;
  label: string;
  icon: ReactElement;
  href?: string;
  active?: boolean;
  dot?: boolean;
  disabled?: boolean;
  reloadOnNavigate?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Core",
    items: [
      {
        label: "Dashboard",
        id: "core-dashboard",
        icon: <LayoutGrid className="h-5 w-5" />,
        active: true,
        href: "/dashboard",
      },
      {
        label: "ChatOps",
        id: "platform-chatops",
        icon: <MessageSquare className="h-5 w-5" />,
        href: "/chatOps",
      },  
      {
        label: "Activity",
        id: "core-activity",
        icon: <Activity className="h-5 w-5" />,
        href: "/activity",
      },
    ],
  },
  {
    title: "Integrations",
    items: [
      {
        label: "Connectors",
        id: "integrations-connectors",
        icon: <Link2 className="h-5 w-5" />,
        href: "/connectors",
        reloadOnNavigate: true,
      },
      {
        label: "Model Context Protocol",
        id: "integrations-model-context-protocol",
        icon: <Link2 className="h-5 w-5" />,
        href: "/mcp",
      },
    ],
  },
  {
    title: "Platform",
    items: [
      {
        label: "Agent Management",
        id: "platform-agent-managements",
        icon: <Bot className="h-5 w-5" />,
        href: "/agent-management",
      },
      {
        label: "LLM Management",
        id: "platform-llm-management",
        icon: <Workflow className="h-5 w-5" />,
        href: "/llm-management",
      },
      {
        label: "User Management",
        id: "platform-user-management",
        icon: <Users className="h-5 w-5" />,
        href: "/user-management",
      },
    ],
  },
  {
    title: "Flow",
    items: [
      {
        label: "Agent Visualizer",
        id: "flow-builder",
        icon: <Network className="h-5 w-5" />,
        dot: true,
        href: "/visualizer",
      },
    ],
  },
];

export default function LeftNavbar() {
  const pathname = usePathname();

  return (
    <aside className="peer group fixed left-0 top-0 z-40 flex h-screen w-[84px] shrink-0 flex-col border-r border-[#eaedf6] bg-white px-4 py-4 transition-all duration-300 hover:w-[300px]">
      <div className="flex items-center gap-3">
        <div className="flex w-10 items-center justify-center transition-all duration-300 group-hover:w-0 group-hover:overflow-hidden group-hover:opacity-0">
          <img
            src="/img/rc-small.png"
            alt="Royal Cyber"
            className="h-9 w-9"
          />
        </div>
        <div className="flex w-0 items-center gap-3 overflow-hidden opacity-0 transition-all duration-300 group-hover:w-auto group-hover:opacity-100">
          <img
            src="/img/royal-cyber.png"
            alt="Royal Cyber"
            className="h-[4.25rem] w-auto"
          />
          <div>
            <p className="text-sm font-semibold text-[#4f49e2]">Royal Cyber</p>
            <p className="text-xs font-medium text-[#6b7280]">
              AIOps for Enterprise
            </p>
          </div>
        </div>
      </div>

      <nav className="no-scrollbar mt-6 flex-1 space-y-4 overflow-y-hidden pr-1">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-2.5">
            <div className="flex items-center gap-3">
              <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {section.title}
              </p>
              <span className="h-px flex-1 bg-[#d6dcea] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isDisabled = Boolean(item.disabled);
                const isActive =
                  !isDisabled && item.href && item.href !== "#"
                    ? pathname === item.href ||
                      pathname?.startsWith(`${item.href}/`)
                    : item.active;
                const baseClasses =
                  "group/item relative flex w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-left text-sm font-medium transition";
                const stateClasses = isDisabled
                  ? "cursor-not-allowed bg-[#f4f6fb] text-[#9aa3b6]"
                  : isActive
                    ? "bg-[#e9edff] text-[#3f35d3]"
                    : "text-[#677189] hover:bg-[#f3f5ff] hover:text-[#1b1f2a]";
                const iconClasses = isDisabled
                  ? "relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf1f7] text-[#a6afc1]"
                  : "relative flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#566079] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition group-hover/item:text-[#3f35d3]";
                const itemContent = (
                  <>
                    {isActive ? (
                      <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#4f49e2]" />
                    ) : null}
                    <span className={iconClasses}>
                      {item.icon}
                      {item.dot ? (
                        <span
                          className={`absolute -left-1.5 bottom-0 h-2 w-2 rounded-full ${
                            isDisabled ? "bg-[#c7cfde]" : "bg-[#f26a1b]"
                          }`}
                        />
                      ) : null}
                    </span>
                    <span className="w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:w-auto group-hover:opacity-100">
                      {item.label}
                    </span>
                  </>
                );

                if (isDisabled || !item.href) {
                  return (
                    <div
                      key={item.id}
                      title={item.label}
                      aria-disabled={isDisabled ? "true" : undefined}
                      className={`${baseClasses} ${stateClasses}`}
                    >
                      {itemContent}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={item.href ?? "#"}
                    title={item.label}
                    aria-current={isActive ? "page" : undefined}
                    onClick={(event) => {
                      if (item.reloadOnNavigate && item.href && item.href !== "#") {
                        event.preventDefault();
                        window.location.assign(item.href);
                      }
                    }}
                    className={`${baseClasses} ${stateClasses}`}
                  >
                    {itemContent}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
