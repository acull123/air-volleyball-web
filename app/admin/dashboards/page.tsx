import StaffAccessGate from "../scheduling/StaffAccessGate";
import PageHero from "@/app/components/PageHero";
import WhereWeAreDashboardClient from "./WhereWeAreDashboardClient";

export default function AdminDashboardsPage() {
  return (
    <StaffAccessGate
      eyebrow="Dashboards"
      title="Dashboards"
      description="A future home for staff-facing club dashboards."
      deniedMessage="You do not have access to dashboards."
    >
      <PageHero
        eyebrow="Dashboards"
        title="Where we are"
        description="Review tournament days and see which teams are playing in each tournament."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />
      <WhereWeAreDashboardClient />
    </StaffAccessGate>
  );
}
