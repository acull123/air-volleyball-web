import PageHero from "@/app/components/PageHero";
import StaffAccessGate from "../scheduling/StaffAccessGate";
import PracticePlanningClient from "./PracticePlanningClient";

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

      <PracticePlanningClient />
    </StaffAccessGate>
  );
}
