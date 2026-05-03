import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import StaffAccessGate from "../scheduling/StaffAccessGate";

export default function AdminPracticePlanningPage() {
  return (
    <StaffAccessGate
      eyebrow="Practice Planner"
      title="Practice Planner"
      description="Set team practice needs and review suggested time slots."
      deniedMessage="You do not have access to manage practice planning."
    >
      <PageHero
        eyebrow="Practice Planner"
        title="Practice Planning"
        description="This area will define how many sessions each team needs, how long each session should be, and which time slots look best after conflicts are reviewed."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard title="What This Will Manage" kicker="Scheduling">
          <div className="space-y-4 text-sm leading-7 text-[color:var(--muted)]">
            <p>Sessions per week for each team.</p>
            <p>Practice length, preferred days, and preferred time windows.</p>
            <p>Suggested practice slots before the final schedule is published.</p>
          </div>
        </SectionCard>

        <SectionCard title="Next Build Step" kicker="Coming Next">
          <p className="text-sm leading-7 text-[color:var(--muted)]">
            The next pass will add team scheduling rules and a ranked list of suggested practice
            slots based on gym availability and submitted conflicts.
          </p>
        </SectionCard>
      </div>
    </StaffAccessGate>
  );
}
