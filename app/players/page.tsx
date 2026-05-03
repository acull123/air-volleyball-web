"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { useFirestoreCollection } from "@/lib/firebase";

const highlights = [
  "Player listings update automatically as rosters change.",
  "Each profile shows current team placement and core roster details.",
  "Private athlete tools can expand from this page later without rebuilding the public roster.",
];

function formatBirthDate(value: string) {
  if (!value) {
    return "Birthday coming soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PlayersPage() {
  const searchParams = useSearchParams();
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const selectedTeamId = searchParams.get("team");
  const selectedTeam = teams.data.find((team) => team.id === selectedTeamId) ?? null;

  const visiblePlayers = useMemo(
    () =>
      [...players.data]
        .filter((player) => player.active !== false)
        .filter((player) => !selectedTeamId || player.teamId === selectedTeamId)
        .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),
    [players.data, selectedTeamId],
  );

  return (
    <>
      <PageHero
        eyebrow="Player Page"
        title={selectedTeam ? `${selectedTeam.name} Roster` : "Athlete Directory"}
        description={
          selectedTeam
            ? `View the current roster for ${selectedTeam.name} and review the athletes assigned to this team.`
            : "This page gives families a live roster view for current athletes while leaving room for future private player tools."
        }
        actions={[
          { href: "/teams", label: "Back To Teams" },
          ...(selectedTeam ? [{ href: "/players", label: "View Full Directory", variant: "secondary" as const }] : [{ href: "/login", label: "Open Player Portal", variant: "secondary" as const }]),
        ]}
      />

      <SectionCard
        title={selectedTeam ? `${selectedTeam.name} Players` : "Current Players"}
        kicker={selectedTeam ? "Team Roster" : "Roster View"}
      >
        {players.loading || teams.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading player list...
          </div>
        ) : players.error || teams.error ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Player information is unavailable right now.
          </div>
        ) : visiblePlayers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            {selectedTeam ? "No players are assigned to this team yet." : "No players have been added yet."}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visiblePlayers.map((player) => {
              const team = teams.data.find((entry) => entry.id === player.teamId);

              return (
                <div
                  key={player.id}
                  className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {player.jerseyNumber > 0 ? `#${player.jerseyNumber}` : "Player"}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                    {player.firstName} {player.lastName}
                  </h2>
                  <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Team:</span>{" "}
                      {team?.name || "Team assignment coming soon"}
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Position:</span>{" "}
                      {player.position || "Position coming soon"}
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Birthdate:</span>{" "}
                      {formatBirthDate(player.birthDate)}
                    </p>
                  </div>
                  {player.bio && (
                    <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{player.bio}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Player Profiles" kicker="Next Expansion">
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item}
              className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5 text-sm leading-7 text-[color:var(--muted)]"
            >
              {item}
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
