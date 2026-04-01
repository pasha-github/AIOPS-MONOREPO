import VisualizerPage from "../visualizer/page";
import AgentActivityLog from "./AgentActivityLog";
import AgentManagementSection from "./AgentManagementSection";
import DashboardOverview from "./DashboardOverview";
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <DashboardOverview />

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <AgentManagementSection />
        <AgentActivityLog />
      </section>
    <div className="space-y-8 border border-[#d9deea] px-6 pt-8 pb-6">
      <VisualizerPage />
    </div>
    </div>
  );
}
