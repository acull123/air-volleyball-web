"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { getEventTeamIds } from "@/lib/event-teams";
import { useFirestoreCollection } from "@/lib/firebase";
import type { EventDocument } from "@/lib/firebase/schema";
import { formatTournamentDayCount, getTournamentDayCount, isTournamentEventType } from "@/lib/tournament-events";

function isTournamentEvent(event: EventDocument) {
  return isTournamentEventType(event.type);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0",
  )}`;
}

function isCurrentOrFutureEvent(event: EventDocument) {
  const todayKey = toDateKey(new Date());
  const eventEndDate = event.endDate || event.startDate;

  return !eventEndDate || eventEndDate >= todayKey;
}

function formatTournamentDate(event: EventDocument) {
  if (!event.startDate) {
    return "Date coming soon";
  }

  const start = new Date(event.startDate);
  const end = new Date(event.endDate || event.startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [event.startDate, event.endDate].filter(Boolean).join(" to ");
  }

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  if (!event.endDate || event.endDate === event.startDate) {
    return start.toLocaleDateString(undefined, options);
  }

  return `${start.toLocaleDateString(undefined, options)} to ${end.toLocaleDateString(undefined, options)}`;
}

function TeamTournamentsContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("team") ?? "";
  const teams = useFirestoreCollection("teams");
  const events = useFirestoreCollection("events");

  const team = teams.data.find((entry) => entry.id === teamId) ?? null;
  const teamTournaments = useMemo(() => {
    if (!team) {
      return [];
    }

    return [...events.data]
      .filter((event) => event.active !== false)
      .filter(isTournamentEvent)
      .filter(isCurrentOrFutureEvent)
      .filter((event) => getEventTeamIds(event).includes(team.id))
      .sort((left, right) =>
        `${left.startDate} ${left.startTime} ${left.title}`.localeCompare(
          `${right.startDate} ${right.startTime} ${right.title}`,
        ),
      );
  }, [events.data, team]);

  const loading = teams.loading || events.loading;
  const error = teams.error || events.error;

  return (
    <>
      <PageHero
        eyebrow="Team Tournaments"
        title={team?.name ? `${team.name} Tournaments` : "Team Tournaments"}
        description="Review tournament dates and locations for a specific Air Volleyball team."
        actions={[
          { href: "/teams", label: "Back To Teams" },
          ...(team ? [{ href: `/team-schedule?team=${team.id}`, label: "View Schedule", variant: "secondary" as const }] : []),
        ]}
      />

      <SectionCard title={team?.name ? `${team.name} Tournament List` : "Tournament List"} kicker="Current Season">
        {error ? (
          <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
            Team tournaments are unavailable right now.
          </div>
        ) : !teamId && !loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Choose a team from the team directory to view its tournaments.
          </div>
        ) : teamId && !team && !loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            That team could not be found.
          </div>
        ) : loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading team tournaments...
          </div>
        ) : teamTournaments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No tournaments are scheduled for this team yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-[color:var(--paper)] text-[color:var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Tournament</th>
                  <th className="px-4 py-3 font-bold">Days</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Location</th>
                </tr>
              </thead>
              <tbody>
                {teamTournaments.map((event) => (
                  <tr key={event.id} className="border-b border-[color:var(--line)]">
                    <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">
                      <Link href={`/events?eventId=${event.id}`} className="hover:underline">
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">
                      {formatTournamentDayCount(getTournamentDayCount(event))}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{formatTournamentDate(event)}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">
                      {event.location || "Location coming soon"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

export default function TeamTournamentsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHero
            eyebrow="Team Tournaments"
            title="Team Tournaments"
            description="Review tournament dates and locations for a specific Air Volleyball team."
            actions={[{ href: "/teams", label: "Back To Teams" }]}
          />
          <SectionCard title="Tournament List" kicker="Current Season">
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Loading team tournaments...
            </div>
          </SectionCard>
        </>
      }
    >
      <TeamTournamentsContent />
    </Suspense>
  );
}
