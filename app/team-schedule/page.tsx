"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ClubCalendar from "../components/ClubCalendar";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { getEventTeamIds } from "@/lib/event-teams";
import { useFirestoreCollection } from "@/lib/firebase";

function TeamScheduleContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("team") ?? "";
  const teams = useFirestoreCollection("teams");
  const events = useFirestoreCollection("events");

  const team = teams.data.find((entry) => entry.id === teamId) ?? null;
  const teamEvents = useMemo(() => {
    if (!team) {
      return [];
    }

    return events.data
      .filter((event) => event.type !== "practice" || event.practicePublished !== false)
      .filter((event) => getEventTeamIds(event).includes(team.id));
  }, [events.data, team]);

  const loading = teams.loading || events.loading;
  const error = teams.error || events.error;

  return (
    <>
      <PageHero
        eyebrow="Team Schedule"
        title={team?.name ? `${team.name} Schedule` : "Team Schedule"}
        description="Review the calendar for a specific Air Volleyball team."
        actions={[
          { href: "/teams", label: "Back To Teams" },
          ...(team ? [{ href: `/players?team=${team.id}`, label: "View Roster", variant: "secondary" as const }] : []),
        ]}
      />

      <SectionCard title={team?.name ? `${team.name} Calendar` : "Team Calendar"} kicker="Schedule">
        {error ? (
          <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
            Team schedule is unavailable right now.
          </div>
        ) : !teamId && !loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Choose a team from the team directory to view its schedule.
          </div>
        ) : teamId && !team && !loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            That team schedule could not be found.
          </div>
        ) : team ? (
          <ClubCalendar
            events={teamEvents}
            teams={[team]}
            conflicts={[]}
            loading={loading}
            readOnly
            showFilters={false}
          />
        ) : (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading team schedule...
          </div>
        )}
      </SectionCard>
    </>
  );
}

export default function TeamSchedulePage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHero
            eyebrow="Team Schedule"
            title="Team Schedule"
            description="Review the calendar for a specific Air Volleyball team."
            actions={[{ href: "/teams", label: "Back To Teams" }]}
          />
          <SectionCard title="Team Calendar" kicker="Schedule">
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Loading team schedule...
            </div>
          </SectionCard>
        </>
      }
    >
      <TeamScheduleContent />
    </Suspense>
  );
}
