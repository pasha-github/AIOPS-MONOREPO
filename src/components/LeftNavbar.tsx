"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Cloud,
  LayoutGrid,
  Link2,
  Mail,
  MessageSquare,
  Truck,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";

type NavItem = {
  id: string;
  label: string;
  icon: JSX.Element;
  href?: string;
  active?: boolean;
  dot?: boolean;
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
        label: "Enterprise Systems",
        id: "core-enterprise-systems",
        icon: <Mail className="h-5 w-5" />,
        href: "#",
      },
    ],
  },
  {
    title: "Platform",
    items: [
      {
        label: "Hybrids",
        id: "platform-hybrids",
        icon: <Wrench className="h-5 w-5" />,
        dot: true,
        href: "#",
      },
      {
        label: "Clouds",
        id: "platform-clouds-primary",
        icon: <Cloud className="h-5 w-5" />,
        href: "#",
      },
      {
        label: "Agent Managements",
        id: "platform-agent-managements",
        icon: <Bot className="h-5 w-5" />,
        href: "/agent-management",
      },
      {
        label: "ChatOps",
        id: "platform-chatops",
        icon: <MessageSquare className="h-5 w-5" />,
        dot: true,
        href: "#",
      },
      {
        label: "Transport",
        id: "platform-clouds-secondary",
        icon: <Truck className="h-5 w-5" />,
        href: "#",
      },
      {
        label: "LLM management",
        id: "platform-llm-management",
        icon: <Workflow className="h-5 w-5" />,
        href: "/llm-management",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Credentials management",
        id: "operations-connectors",
        icon: <Link2 className="h-5 w-5" />,
        dot: true,
        href: "/connectors",
      },
      {
        label: "User management",
        id: "operations-user-management",
        icon: <Users className="h-5 w-5" />,
        href: "/user-management",
      },
    ],
  },
  {
    title: "Flow",
    items: [
      {
        label: "Flow builder",
        id: "flow-builder",
        icon: <Workflow className="h-5 w-5" />,
        dot: true,
        href: "#",
      },
    ],
  },
];

export default function LeftNavbar() {
  const pathname = usePathname();

  return (
    <aside className="peer group fixed left-0 top-0 z-40 flex h-screen w-[84px] shrink-0 flex-col border-r border-[#eaedf6] bg-white px-4 py-6 transition-all duration-300 hover:w-[300px]">
      <div className="flex items-center gap-3">
        <div className="flex w-11 items-center justify-center transition-all duration-300 group-hover:w-0 group-hover:opacity-0 group-hover:overflow-hidden">
          <img
            src="/img/rc-small.png"
            alt="Royal Cyber"
            className="h-10 w-10"
          />
        </div>
        <div className="flex w-0 items-center gap-3 overflow-hidden opacity-0 transition-all duration-300 group-hover:w-auto group-hover:opacity-100">
          <img
            src="/img/royal-cyber.png"
            alt="Royal Cyber"
            className="h-[5.25rem] w-auto"
          />
          <div>
            <p className="text-sm font-semibold text-[#4f49e2]">Royal Cyber</p>
            <p className="text-xs font-medium text-[#6b7280]">
              AIOps for Enterprise
            </p>
          </div>
        </div>
      </div>

      <nav className="no-scrollbar mt-8 flex-1 space-y-6 overflow-y-auto pr-2">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-3">
            <div className="flex items-center gap-3">
              <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {section.title}
              </p>
              <span className="h-px flex-1 bg-[#d6dcea] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  item.href && item.href !== "#"
                    ? pathname === item.href ||
                      pathname?.startsWith(`${item.href}/`)
                    : item.active;
                return (
                  <Link
                    key={item.id}
                    href={item.href ?? "#"}
                    title={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={`group/item relative flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-medium transition ${
                      isActive
                        ? "bg-[#e9edff] text-[#3f35d3]"
                        : "text-[#677189] hover:bg-[#f3f5ff] hover:text-[#1b1f2a]"
                    }`}
                  >
                    {isActive ? (
                      <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#4f49e2]" />
                    ) : null}
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#566079] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition group-hover/item:text-[#3f35d3]">
                      {item.icon}
                      {item.dot ? (
                        <span className="absolute -left-1.5 bottom-0 h-2 w-2 rounded-full bg-[#f26a1b]" />
                      ) : null}
                    </span>
                    <span className="w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:w-auto group-hover:opacity-100">
                      {item.label}
                    </span>
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
