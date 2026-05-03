import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import StaffAccessGate from "../scheduling/StaffAccessGate";

export default function AdminConflictsPage() {
  return (
    <StaffAccessGate
      eyebrow="Conflict Manager"
      title="Conflict Manager"
      description="Review family scheduling conflicts before practice times are finalized."
      deniedMessage="You do not have access to review scheduling conflicts."
    >
      <PageHero
        eyebrow="Conflict Manager"
        title="Review Conflicts"
        description="This area will collect and review player and family conflicts so staff can avoid the worst practice windows before publishing the schedule."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard title="What This Will Manage" kicker="Scheduling">
          <div className="space-y-4 text-sm leading-7 text-[color:var(--muted)]">
            <p>Blocked times submitted by players and parents.</p>
            <p>One-time conflicts and recurring weekly conflicts.</p>
            <p>Conflict review before practice times are finalized.</p>
          </div>
        </SectionCard>

        <SectionCard title="Next Build Step" kicker="Coming Next">
          <p className="text-sm leading-7 text-[color:var(--muted)]">
            The next pass will add a live conflict review table and connect family submissions to
            each team and planning cycle.
          </p>
        </SectionCard>
      </div>
    </StaffAccessGate>
  );
}
