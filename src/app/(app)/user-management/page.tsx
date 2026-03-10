"use client";

import {
  Building2,
  Filter,
  LayoutGrid,
  Plus,
  Search,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { useMemo, useState, type ElementType } from "react";

type Organization = {
  name: string;
  domain: string;
  users: number;
  plan: string;
  status: "Active" | "Pending" | "Suspended";
};

type Menu = {
  name: string;
  category: string;
  items: number;
  lastUpdated: string;
  status: "Published" | "Draft";
};

type Role = {
  role: string;
  scope: string;
  users: number;
  updated: string;
  status: "Active" | "Archived";
};

type User = {
  name: string;
  email: string;
  role: string;
  lastActive: string;
  status: "Active" | "Invited" | "Suspended";
};

const tabs = [
  { id: "organization", label: "Organization", icon: Building2, count: 3 },
  { id: "menu", label: "Menu", icon: LayoutGrid, count: 8 },
  { id: "role", label: "Role", icon: ShieldCheck, count: 6 },
  { id: "user", label: "User", icon: Users2, count: 42 },
] as const;

const superAdminName = "Royal Cyber";
const hierarchyOrganizations = ["Org 1", "Org 2", "Org 3"] as const;
const hierarchyOrgCenters = [15, 50, 85] as const;
const hierarchyUserOffsets = [-10, 0, 10] as const;
const relationshipUsers = [
  { name: "User 1", role: "Platform Admin" },
  { name: "User 2", role: "Operations Lead" },
  { name: "User 3", role: "Read-only Analyst" },
] as const;

const organizations: Organization[] = [
  {
    name: "Royal Cyber",
    domain: "royalcyber.com",
    users: 82,
    plan: "Enterprise",
    status: "Active",
  },
  {
    name: "Nimbus Retail",
    domain: "nimbusretail.io",
    users: 24,
    plan: "Growth",
    status: "Pending",
  },
  {
    name: "Latitude Health",
    domain: "latitudehealth.org",
    users: 17,
    plan: "Professional",
    status: "Suspended",
  },
];

const menus: Menu[] = [
  {
    name: "Core Navigation",
    category: "Platform",
    items: 12,
    lastUpdated: "Feb 28, 2026",
    status: "Published",
  },
  {
    name: "Operations Suite",
    category: "Operations",
    items: 9,
    lastUpdated: "Feb 18, 2026",
    status: "Published",
  },
  {
    name: "Experimental Apps",
    category: "Labs",
    items: 4,
    lastUpdated: "Jan 31, 2026",
    status: "Draft",
  },
];

const roles: Role[] = [
  {
    role: "Platform Admin",
    scope: "Global",
    users: 4,
    updated: "Mar 1, 2026",
    status: "Active",
  },
  {
    role: "Operations Lead",
    scope: "Operations",
    users: 9,
    updated: "Feb 19, 2026",
    status: "Active",
  },
  {
    role: "Read-only Analyst",
    scope: "Insights",
    users: 15,
    updated: "Jan 23, 2026",
    status: "Archived",
  },
];

const users: User[] = [
  {
    name: "Alice Admin",
    email: "alice.admin@demo.ai",
    role: "Platform Admin",
    lastActive: "Today, 09:12 AM",
    status: "Active",
  },
  {
    name: "John Doe",
    email: "john.doe@demo.ai",
    role: "Operations Lead",
    lastActive: "Yesterday, 06:40 PM",
    status: "Active",
  },
  {
    name: "Kiran Patel",
    email: "kiran.patel@demo.ai",
    role: "Read-only Analyst",
    lastActive: "Feb 26, 2026",
    status: "Invited",
  },
  {
    name: "Mia Chen",
    email: "mia.chen@demo.ai",
    role: "Menu Designer",
    lastActive: "Feb 12, 2026",
    status: "Suspended",
  },
];

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Suspended: "bg-rose-50 text-rose-700 border-rose-200",
  Published: "bg-sky-50 text-sky-700 border-sky-200",
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Archived: "bg-slate-100 text-slate-700 border-slate-200",
  Invited: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

type StatCard = {
  label: string;
  value: string;
  meta: string;
  icon: ElementType;
  accent: string;
  pill: string;
};

const statsByTab: Record<(typeof tabs)[number]["id"], StatCard[]> = {
  organization: [
    {
      label: "Organizations",
      value: "3",
      meta: "1 onboarding",
      icon: Building2,
      accent: "from-[#4f49e2]/22 via-transparent to-transparent",
      pill: "bg-[#eef0ff] text-[#4f49e2]",
    },
    {
      label: "Total users",
      value: "123",
      meta: "+14 this month",
      icon: Users2,
      accent: "from-[#0ea5e9]/22 via-transparent to-transparent",
      pill: "bg-[#e6f6ff] text-[#0284c7]",
    },
    {
      label: "Active plans",
      value: "2",
      meta: "Enterprise focus",
      icon: ShieldCheck,
      accent: "from-[#22c55e]/20 via-transparent to-transparent",
      pill: "bg-[#e8f9ef] text-[#15803d]",
    },
  ],
  menu: [
    {
      label: "Menus",
      value: "8",
      meta: "2 in draft",
      icon: LayoutGrid,
      accent: "from-[#8b5cf6]/22 via-transparent to-transparent",
      pill: "bg-[#f1ecff] text-[#6d28d9]",
    },
    {
      label: "Menu items",
      value: "46",
      meta: "Last 30 days",
      icon: Building2,
      accent: "from-[#f97316]/22 via-transparent to-transparent",
      pill: "bg-[#fff1e7] text-[#c2410c]",
    },
    {
      label: "Last publish",
      value: "2 days",
      meta: "Stable release",
      icon: ShieldCheck,
      accent: "from-[#14b8a6]/22 via-transparent to-transparent",
      pill: "bg-[#e6fffb] text-[#0f766e]",
    },
  ],
  role: [
    {
      label: "Roles",
      value: "6",
      meta: "1 archived",
      icon: ShieldCheck,
      accent: "from-[#ec4899]/20 via-transparent to-transparent",
      pill: "bg-[#ffe7f3] text-[#be185d]",
    },
    {
      label: "Scoped roles",
      value: "4",
      meta: "Ops + Insights",
      icon: LayoutGrid,
      accent: "from-[#06b6d4]/20 via-transparent to-transparent",
      pill: "bg-[#e6fbff] text-[#0e7490]",
    },
    {
      label: "Avg members",
      value: "8",
      meta: "Balanced coverage",
      icon: Users2,
      accent: "from-[#f59e0b]/22 via-transparent to-transparent",
      pill: "bg-[#fff4df] text-[#b45309]",
    },
  ],
  user: [
    {
      label: "Total users",
      value: "42",
      meta: "82% active",
      icon: Users2,
      accent: "from-[#4f49e2]/22 via-transparent to-transparent",
      pill: "bg-[#eef0ff] text-[#4f49e2]",
    },
    {
      label: "Pending invites",
      value: "5",
      meta: "Expires in 7 days",
      icon: LayoutGrid,
      accent: "from-[#f97316]/22 via-transparent to-transparent",
      pill: "bg-[#fff1e7] text-[#c2410c]",
    },
    {
      label: "Suspended",
      value: "2",
      meta: "Requires review",
      icon: ShieldCheck,
      accent: "from-[#ef4444]/20 via-transparent to-transparent",
      pill: "bg-[#ffe9e9] text-[#b91c1c]",
    },
  ],
} as const;

const filterRows = <T extends Record<string, string | number>>(
  rows: T[],
  fields: (keyof T)[],
  query: string
) => {
  if (!query) {
    return rows;
  }
  return rows.filter((row) =>
    fields.some((field) =>
      String(row[field]).toLowerCase().includes(query.toLowerCase())
    )
  );
};

export default function UserManagementPage() {
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]["id"]>("organization");
  const [searchValue, setSearchValue] = useState("");

  const filteredOrganizations = useMemo(
    () =>
      filterRows(organizations, ["name", "domain", "plan", "status"], searchValue),
    [searchValue]
  );
  const filteredMenus = useMemo(
    () =>
      filterRows(menus, ["name", "category", "status", "lastUpdated"], searchValue),
    [searchValue]
  );
  const filteredRoles = useMemo(
    () =>
      filterRows(roles, ["role", "scope", "status", "updated"], searchValue),
    [searchValue]
  );
  const filteredUsers = useMemo(
    () =>
      filterRows(users, ["name", "email", "role", "status"], searchValue),
    [searchValue]
  );

  return (
    <section className="rounded-3xl bg-white p-8 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="rounded-3xl bg-transparent">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b84aa]">
              Access Hierarchy
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#10131a]">
              Tenant to Identity and Permission Role Mapping
            </h3>
            <p className="mt-2 text-sm text-[#5f6784]">
              Top-down control graph showing how people inherit role permissions
              from the organization context.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="w-full overflow-hidden">
            <div className="relative h-[500px] w-full">
              <div className="absolute left-1/2 top-[8px] w-[200px] -translate-x-1/2 rounded-2xl bg-white px-3 py-3 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.3)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4f49e2]">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#10131a]">
                      {superAdminName}
                    </p>
                    <p className="text-[11px] text-[#6b7391]">Super admin</p>
                  </div>
                </div>
              </div>

              <div className="absolute left-1/2 top-[56px] h-[24px] w-px -translate-x-1/2 border-l-2 border-dashed border-[#cbd5f5]" />
              <span className="absolute left-1/2 top-[62px] -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b84aa]">
                governs
              </span>
              <div className="absolute left-[15%] top-[80px] h-px w-[70%] border-t-2 border-dashed border-[#cbd5f5]" />

              {hierarchyOrganizations.map((orgName, orgIndex) => {
                const orgCenter = `${hierarchyOrgCenters[orgIndex]}%`;
                return (
                  <div key={orgName}>
                    <div
                      className="absolute top-[80px] h-[22px] w-px -translate-x-1/2 border-l-2 border-dashed border-[#cbd5f5]"
                      style={{ left: orgCenter }}
                    />

                    <div
                      className="absolute top-[104px] w-[170px] -translate-x-1/2 rounded-2xl bg-white px-3 py-3 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.3)]"
                      style={{ left: orgCenter }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4f49e2]">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[#10131a]">
                            {orgName}
                          </p>
                          <p className="text-[11px] text-[#6b7391]">
                            Organization
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      className="absolute top-[164px] h-px w-[20%] border-t-2 border-dashed border-[#cbd5f5]"
                      style={{ left: `calc(${orgCenter} - 10%)` }}
                    />
                    <span
                      className="absolute top-[150px] -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b84aa]"
                      style={{ left: orgCenter }}
                    >
                      has
                    </span>

                    {relationshipUsers.map((user, userIndex) => {
                      const userOffset = hierarchyUserOffsets[userIndex];
                      const userCenter = `calc(${orgCenter} ${
                        userOffset >= 0 ? "+" : "-"
                      } ${Math.abs(userOffset)}%)`;
                      return (
                        <div key={`${orgName}-${user.name}`}>
                          <div
                            className="absolute top-[164px] h-[20px] w-px -translate-x-1/2 border-l-2 border-dashed border-[#cbd5f5]"
                            style={{ left: userCenter }}
                          />

                          <div
                            className="absolute top-[188px] w-[128px] -translate-x-1/2 rounded-2xl bg-white px-3 py-3 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.28)]"
                            style={{ left: userCenter }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f9ef] text-[#15803d]">
                                <Users2 className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-[13px] font-semibold leading-4 text-[#10131a]">
                                  {user.name}
                                </p>
                                <p className="text-[11px] text-[#5f6784]">User</p>
                              </div>
                            </div>
                          </div>

                          <div
                            className="absolute top-[256px] h-[22px] w-px -translate-x-1/2 border-l-2 border-dashed border-[#f2cfa5]"
                            style={{ left: userCenter }}
                          />
                          <span
                            className="absolute top-[260px] -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c07a31]"
                            style={{ left: userCenter }}
                          >
                            assigned
                          </span>

                          <div
                            className="absolute top-[282px] w-[128px] -translate-x-1/2 rounded-2xl bg-white px-3 py-3 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.28)]"
                            style={{ left: userCenter }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1e7] text-[#c2410c]">
                                <ShieldCheck className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-[13px] font-semibold leading-4 text-[#10131a]">
                                  {user.role}
                                </p>
                                <p className="text-[11px] text-[#6b4e2d]">Role</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-[#10131a]">
            User management
          </h2>
          <p className="max-w-lg text-sm text-[#5c647a]">
            Centralize organizations, menus, roles, and people access across your
            AIOps workspace.
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[#e4e8f5] bg-[#f4f6fb] px-4 py-2 text-sm text-[#4f49e2] shadow-[0_10px_30px_-22px_rgba(79,73,226,0.45)]">
            <Search className="h-4 w-4" />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search organizations, roles, users..."
              className="w-56 bg-transparent text-sm text-[#4f49e2] placeholder:text-[#7d86c6] focus:outline-none"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#e4e8f5] bg-white px-4 py-2 text-sm font-semibold text-[#2f3443] shadow-[0_12px_26px_-20px_rgba(15,23,42,0.4)] transition hover:border-[#cfd6ee] hover:bg-[#f7f8fc]"
          >
            <Filter className="h-4 w-4 text-[#6b7391]" />
            Filters
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_-20px_rgba(79,73,226,0.65)] transition hover:bg-[#3d39c7]"
          >
            <Plus className="h-4 w-4" />
            New user
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="w-full lg:max-w-[280px] lg:self-stretch">
          <div className="flex h-full min-h-[520px] flex-col rounded-3xl bg-gradient-to-b from-white via-white to-[#f2f4ff] p-4 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.45)] lg:min-h-[calc(100vh-300px)]">
            <div className="mb-4 rounded-2xl bg-white/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b92b5]">
                Navigator
              </p>
              <p className="mt-1 text-sm font-semibold text-[#2d2f3a]">
                Workspace menu
              </p>
              <p className="text-xs text-[#6f7893]">
                Choose a management area.
              </p>
            </div>
            <div
              role="tablist"
              className="flex flex-1 flex-col gap-2 rounded-2xl bg-[#f4f6fb] p-3"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative inline-flex h-full min-h-0 flex-1 w-full items-center justify-between gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                      isActive
                        ? "bg-white text-[#2d2f3a] shadow-[0_14px_32px_-24px_rgba(15,23,42,0.55)]"
                        : "text-[#6b7391] hover:bg-white/70 hover:text-[#2d2f3a]"
                    }`}
                  >
                    {isActive ? (
                      <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#4f49e2]" />
                    ) : null}
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          isActive
                            ? "bg-[#eef0ff] text-[#4f49e2]"
                            : "bg-white text-[#6b7391]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {tab.label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive
                          ? "bg-[#eef0ff] text-[#4f49e2]"
                          : "bg-white text-[#8b94b1]"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-px self-stretch bg-[#e6e9f5]" />

        <div className="flex-1 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {statsByTab[activeTab].map((stat) => (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-2xl border border-[#e7eaf5] bg-white px-5 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-gradient-to-br ${stat.accent}`}
                />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8c96b6]">
                      {stat.label}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-[#111827]">
                      {stat.value}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-[0_10px_24px_-16px_rgba(15,23,42,0.45)]">
                    <stat.icon className="h-5 w-5 text-[#4f49e2]" />
                  </span>
                </div>
                <div className="mt-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${stat.pill}`}
                  >
                    {stat.meta}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e7eaf5] bg-white">
            <div className="flex items-center justify-between border-b border-[#eef1f8] px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-[#1c2233]">
                  {activeTab === "organization" && "Organization directory"}
                  {activeTab === "menu" && "Menu catalog"}
                  {activeTab === "role" && "Role matrix"}
                  {activeTab === "user" && "User roster"}
                </h3>
                <p className="text-xs text-[#7b859f]">
                  {activeTab === "organization" &&
                    "Manage tenant branding, plans, and onboarding status."}
                  {activeTab === "menu" &&
                    "Publish and organize navigation menus across workspaces."}
                  {activeTab === "role" &&
                    "Assign access scopes and responsibilities for each team."}
                  {activeTab === "user" &&
                    "Review invitations, activity, and access for every user."}
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-[#e4e8f5] bg-white px-3 py-2 text-xs font-semibold text-[#4f49e2] transition hover:bg-[#f2f4ff]"
              >
                View all
              </button>
            </div>

            {activeTab === "organization" && (
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f5f7fb] text-xs uppercase tracking-[0.16em] text-[#7c86a2]">
                  <tr>
                    <th className="px-6 py-3">Organization</th>
                    <th className="px-6 py-3">Primary domain</th>
                    <th className="px-6 py-3">Users</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrganizations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-[#7c86a2]"
                      >
                        No organizations match this search.
                      </td>
                    </tr>
                  ) : (
                    filteredOrganizations.map((org) => (
                      <tr
                        key={org.name}
                        className="border-b border-[#eef1f8] last:border-0"
                      >
                        <td className="px-6 py-4 font-semibold text-[#1a1f2d]">
                          {org.name}
                        </td>
                        <td className="px-6 py-4 text-[#5d657a]">
                          {org.domain}
                        </td>
                        <td className="px-6 py-4 text-[#1a1f2d]">
                          {org.users}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-[#f2f4ff] px-3 py-1 text-xs font-semibold text-[#4f49e2]">
                            {org.plan}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                              statusStyles[org.status]
                            }`}
                          >
                            {org.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "menu" && (
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f5f7fb] text-xs uppercase tracking-[0.16em] text-[#7c86a2]">
                  <tr>
                    <th className="px-6 py-3">Menu</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Items</th>
                    <th className="px-6 py-3">Last updated</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenus.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-[#7c86a2]"
                      >
                        No menus match this search.
                      </td>
                    </tr>
                  ) : (
                    filteredMenus.map((menu) => (
                      <tr
                        key={menu.name}
                        className="border-b border-[#eef1f8] last:border-0"
                      >
                        <td className="px-6 py-4 font-semibold text-[#1a1f2d]">
                          {menu.name}
                        </td>
                        <td className="px-6 py-4 text-[#5d657a]">
                          {menu.category}
                        </td>
                        <td className="px-6 py-4 text-[#1a1f2d]">
                          {menu.items}
                        </td>
                        <td className="px-6 py-4 text-[#5d657a]">
                          {menu.lastUpdated}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                              statusStyles[menu.status]
                            }`}
                          >
                            {menu.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "role" && (
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f5f7fb] text-xs uppercase tracking-[0.16em] text-[#7c86a2]">
                  <tr>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Scope</th>
                    <th className="px-6 py-3">Members</th>
                    <th className="px-6 py-3">Last updated</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-[#7c86a2]"
                      >
                        No roles match this search.
                      </td>
                    </tr>
                  ) : (
                    filteredRoles.map((role) => (
                      <tr
                        key={role.role}
                        className="border-b border-[#eef1f8] last:border-0"
                      >
                        <td className="px-6 py-4 font-semibold text-[#1a1f2d]">
                          {role.role}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-[#f4f6fb] px-3 py-1 text-xs font-semibold text-[#5d657a]">
                            {role.scope}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#1a1f2d]">
                          {role.users}
                        </td>
                        <td className="px-6 py-4 text-[#5d657a]">
                          {role.updated}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                              statusStyles[role.status]
                            }`}
                          >
                            {role.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "user" && (
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f5f7fb] text-xs uppercase tracking-[0.16em] text-[#7c86a2]">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Last active</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-[#7c86a2]"
                      >
                        No users match this search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.email}
                        className="border-b border-[#eef1f8] last:border-0"
                      >
                        <td className="px-6 py-4 font-semibold text-[#1a1f2d]">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 text-[#5d657a]">
                          {user.email}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-[#eef0ff] px-3 py-1 text-xs font-semibold text-[#4f49e2]">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#5d657a]">
                          {user.lastActive}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                              statusStyles[user.status]
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
