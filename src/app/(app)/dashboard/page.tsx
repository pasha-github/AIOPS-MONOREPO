import AgentActivityLog from "./AgentActivityLog";
import AgentManagementSection from "./AgentManagementSection";
import DashboardOverview from "./DashboardOverview";
import IncidentDetails from "./IncidentDetails";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <DashboardOverview />

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <AgentManagementSection />
        <AgentActivityLog />
      </section>

      <IncidentDetails />
    </div>
  );
}
