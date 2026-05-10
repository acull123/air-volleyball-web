import StaffAccessGate from "../scheduling/StaffAccessGate";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";

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
        description="Dashboard views will live here in a later pass."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />
      <SectionCard title="Where we are" kicker="Placeholder">
        <p className="text-sm leading-7 text-[color:var(--muted)]">
          Dashboard tools will be added here next.
        </p>
      </SectionCard>
    </StaffAccessGate>
  );
}
