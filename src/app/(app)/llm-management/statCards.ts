import { Bot, CheckCircle2, Zap } from "lucide-react";

export function getStatCards({
  totalCount,
  providerCount,
  describedCount,
}: {
  totalCount: number;
  providerCount: number;
  describedCount: number;
}) {
  return [
    {
      title: "Providers",
      value: providerCount,
      note: "Model sources",
      icon: CheckCircle2,
      tone: "from-[#18c964] to-[#00b56c]",
      noteColor: "text-[#16a34a]",
    },
    {
      title: "With description",
      value: describedCount,
      note: "Documented models",
      icon: Zap,
      tone: "from-[#2f80ff] to-[#1aa7ff]",
      noteColor: "text-[#3b82f6]",
    },
    {
      title: "Total LLMs",
      value: totalCount,
      note: "Available now",
      icon: Bot,
      tone: "from-[#b45cff] to-[#ff5ac8]",
      noteColor: "text-[#e11d8d]",
    },
  ];
}