"use client";

import Link from "next/link";
import { useMemo } from "react";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { useFirestoreCollection } from "@/lib/firebase";
import type { CoachDocument } from "@/lib/firebase";

function getCoachTeamIds(coach: CoachDocument): string[] {
  if (Array.isArray((coach as CoachDocument & { teamIds?: string[] }).teamIds)) {
    return (coach as CoachDocument & { teamIds?: string[] }).teamIds.filter(Boolean);
  }

  const legacyTeamId = (coach as CoachDocument & { teamId?: string }).teamId;

  return legacyTeamId ? [legacyTeamId] : [];
}

export default function TeamsPage() {
  const teams = useFirestoreCollection("teams");
  const players = useFirestoreCollection("players");
  const coaches = useFirestoreCollection("coaches");

  const visibleTeams = useMemo(
    () =>
      [...teams.data]
        .filter((team) => team.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teams.data],
  );

  const summary = useMemo(
    () => ({
      teams: visibleTeams.length,
      players: players.data.filter((player) => player.active !== false).length,
      coaches: coaches.data.filter((coach) => coach.active !== false).length,
    }),
    [coaches.data, players.data, visibleTeams.length],
  );

  return (
    <>
      <PageHero
        eyebrow="Team Page"
        title="Club Teams"
        description="Families can review current age groups, roster sizes, and staff assignments for each team."
        actions={[
          { href: "/register", label: "Register" },
          { href: "/training", label: "View Training", variant: "secondary" },
        ]}
      />

      <SectionCard title="Current Team Directory" kicker="Current Season">
        {teams.loading || players.loading || coaches.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading team directory...
          </div>
        ) : teams.error || players.error || coaches.error ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Team information is unavailable right now.
          </div>
        ) : visibleTeams.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No teams have been added yet.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {visibleTeams.map((team) => {
              const roster = players.data.filter(
                (player) =>
                  player.active !== false && (player.teamId === team.id || team.playerIds.includes(player.id)),
              );
              const staff = coaches.data.filter(
                (coach) =>
                  coach.active !== false &&
                  ((team.coachIds ?? []).includes(coach.id) || getCoachTeamIds(coach).includes(team.id)),
              );

              return (
                <Link
                  key={team.id}
                  href={`/players?team=${team.id}`}
                  className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {team.ageGroup || "Team"}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">{team.name}</h2>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                    {[team.season, team.level].filter(Boolean).join(" · ") || "Season details coming soon"}
                  </p>
                  <div className="mt-5 space-y-2 text-sm text-[color:var(--muted)]">
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Coaches:</span>{" "}
                      {staff.length
                        ? staff.map((coach) => `${coach.firstName} ${coach.lastName}`).join(", ")
                        : "Coach assignments coming soon"}
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Roster Count:</span>{" "}
                      {roster.length} athletes
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Schedule:</span>{" "}
                      {team.scheduleId ? "Schedule available" : "Schedule details coming soon"}
                    </p>
                  </div>
                  {team.description && (
                    <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{team.description}</p>
                  )}
                  <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]">
                    View roster
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Club Snapshot" kicker="Live Overview">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Active Teams
            </p>
            <p className="mt-2 font-[family:var(--font-display)] text-5xl uppercase leading-none text-[color:var(--ink)]">
              {summary.teams}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Active Players
            </p>
            <p className="mt-2 font-[family:var(--font-display)] text-5xl uppercase leading-none text-[color:var(--ink)]">
              {summary.players}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Active Coaches
            </p>
            <p className="mt-2 font-[family:var(--font-display)] text-5xl uppercase leading-none text-[color:var(--ink)]">
              {summary.coaches}
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
