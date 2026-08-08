import StaffAccessGate from "../../scheduling/StaffAccessGate";
import PageHero from "@/app/components/PageHero";
import MultipleFutureTryoutsDashboardClient from "./MultipleFutureTryoutsDashboardClient";

export default function MultipleTryoutsDashboardPage() {
  return (
    <StaffAccessGate
      eyebrow="Dashboards"
      title="Multiple Future Tryouts"
      description="Review players registered for more than one future tryout."
      deniedMessage="You do not have access to dashboards."
    >
      <PageHero
        eyebrow="Dashboards"
        title="Multiple Future Tryouts"
        description="Review players registered for more than one active future tryout."
        actions={[
          { href: "/admin/dashboard", label: "Admin Dashboard" },
          { href: "/admin/dashboards", label: "Where We Are", variant: "secondary" },
        ]}
      />
      <MultipleFutureTryoutsDashboardClient />
    </StaffAccessGate>
  );
}
