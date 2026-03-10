import { CheckCircle2, RefreshCw, TriangleAlert, Zap } from "lucide-react";

import { overviewStats, serviceNowApiDetails } from "./staticData";

const iconMap = {
  warning: TriangleAlert,
  success: CheckCircle2,
  info: Zap,
} as const;

const gradientMap = {
  warning: "from-[#ff7a45] to-[#ff4d4f]",
  success: "from-[#18c964] to-[#00b56c]",
  info: "from-[#2f80ff] to-[#1aa7ff]",
} as const;

export default function DashboardOverview() {
  return (
    <section className="relative rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_2fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#10131a]">
                Welcome back, Alice!
              </h2>
              <p className="mt-2 text-sm text-[#5b6476]">
                ServiceNow instance: {serviceNowApiDetails.instance}
              </p>
              <p className="mt-1 text-xs text-[#8a94a6]">
                Endpoint: {serviceNowApiDetails.endpoint}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#4f49e2] shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Incident details
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-[#1d2433]">
              <span>Profile Completion:</span>
              <span className="text-[#5b4cf0]">75%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#e8ebf4]">
              <div className="relative h-2 w-[75%] rounded-full bg-[#5b4cf0]">
                <span className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full border-[3px] border-white bg-[#5b4cf0] shadow-[0_4px_12px_rgba(91,76,240,0.35)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid justify-end gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {overviewStats.map((card) => {
            const Icon = iconMap[card.tone];
            return (
              <div
                key={card.title}
                className="flex flex-col items-center rounded-2xl bg-white p-5 text-center shadow-[0_12px_30px_-28px_rgba(16,24,40,0.45)] ring-1 ring-[#eef1f7]"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${gradientMap[card.tone]} text-white shadow-[0_10px_20px_-12px_rgba(0,0,0,0.45)]`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-6 text-sm font-semibold text-[#5a6476]">
                  {card.title}
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#0f1115]">
                  {card.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
