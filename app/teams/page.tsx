"use client";

import Link from "next/link";
import { useMemo } from "react";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { useFirestoreCollection } from "@/lib/firebase";
import type { CoachDocument } from "@/lib/firebase";
import { comparePlayersByName } from "@/lib/player-name";
import { isCurrentPlayer } from "@/lib/player-status";

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
                  isCurrentPlayer(player) && (player.teamId === team.id || team.playerIds.includes(player.id)),
              ).sort(comparePlayersByName);
              const staff = coaches.data.filter(
                (coach) =>
                  coach.active !== false &&
                  ((team.coachIds ?? []).includes(coach.id) || getCoachTeamIds(coach).includes(team.id)),
              );

              return (
                <Link
                  key={team.id}
                  href={`/players?team=${team.id}`}
                  className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)] group-hover:text-[#d0deed]">
                    {team.ageGroup || "Team"}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">{team.name}</h2>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
                    {[team.season, team.level].filter(Boolean).join(" · ") || "Season details coming soon"}
                  </p>
                  <div className="mt-5 space-y-2 text-sm text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
                    <p>
                      <span className="font-semibold text-[color:var(--ink)] group-hover:text-white">Coaches:</span>{" "}
                      {staff.length
                        ? staff.map((coach) => `${coach.firstName} ${coach.lastName}`).join(", ")
                        : "Coach assignments coming soon"}
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)] group-hover:text-white">Roster Count:</span>{" "}
                      {roster.length} athletes
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)] group-hover:text-white">Schedule:</span>{" "}
                      {team.scheduleId ? "Schedule available" : "Schedule details coming soon"}
                    </p>
                  </div>
                  {team.description && (
                    <p className="mt-4 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">{team.description}</p>
                  )}
                  <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition group-hover:border-white/30 group-hover:text-white">
                    View roster
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

    </>
  );
}
