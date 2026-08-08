"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { useFirestoreCollection } from "@/lib/firebase";
import { comparePlayersByName } from "@/lib/player-name";
import { isCurrentPlayer } from "@/lib/player-status";

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16v12H4z" />
      <path d="m4 8 8 6 8-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.33 1.8.62 2.65a2 2 0 0 1-.45 2.11L8.01 9.75a16 16 0 0 0 6.24 6.24l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.74.5 2.65.62A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function PlayersPageContent() {
  const searchParams = useSearchParams();
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const coaches = useFirestoreCollection("coaches");
  const selectedTeamId = searchParams.get("team");
  const selectedTeam = teams.data.find((team) => team.id === selectedTeamId) ?? null;
  const [showHannahEasterEgg, setShowHannahEasterEgg] = useState(false);

  const visiblePlayers = useMemo(
    () =>
      [...players.data]
        .filter(isCurrentPlayer)
        .filter((player) => !selectedTeamId || player.teamId === selectedTeamId)
        .sort(comparePlayersByName),
    [players.data, selectedTeamId],
  );
  const selectedTeamCoaches = useMemo(() => {
    if (!selectedTeam) {
      return [];
    }

    const teamCoachIds = new Set(selectedTeam.coachIds ?? []);

    return coaches.data
      .filter(
        (coach) =>
          coach.active !== false &&
          (teamCoachIds.has(coach.id) ||
            (Array.isArray(coach.teamIds) && coach.teamIds.includes(selectedTeam.id))),
      )
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`),
      );
  }, [coaches.data, selectedTeam]);

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
          ...(selectedTeam ? [{ href: "/players", label: "View Full Directory", variant: "secondary" as const }] : [{ href: "/login", label: "Open Portal", variant: "secondary" as const }]),
        ]}
      />

      <SectionCard
        title={selectedTeam ? `${selectedTeam.name} Players` : "Current Players"}
        kicker={selectedTeam ? "Team Roster" : "Roster View"}
      >
        {players.loading || teams.loading || coaches.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading player list...
          </div>
        ) : players.error || teams.error || coaches.error ? (
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
              const isHannahCull =
                selectedTeamId !== null
                && player.firstName === "Hannah"
                && player.lastName === "Cull";

              return (
                <div
                  key={player.id}
                  className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
                  onMouseEnter={isHannahCull ? () => setShowHannahEasterEgg(true) : undefined}
                  onMouseLeave={isHannahCull ? () => setShowHannahEasterEgg(false) : undefined}
                  onFocus={isHannahCull ? () => setShowHannahEasterEgg(true) : undefined}
                  onBlur={isHannahCull ? () => setShowHannahEasterEgg(false) : undefined}
                >
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {player.jerseyNumber > 0 ? `#${player.jerseyNumber}` : "Player"}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                    {player.firstName} {player.lastName}
                  </h2>
                  {player.photoUrl && (
                    <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--paper)]">
                      <Image
                        src={player.photoUrl}
                        alt={`${player.firstName} ${player.lastName}`}
                        width={800}
                        height={800}
                        className="h-96 w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Team:</span>{" "}
                      {team ? (
                        <Link
                          href={`/teams#team-${team.id}`}
                          className="font-semibold text-[color:var(--ink)] underline decoration-[color:var(--line)] underline-offset-4 transition hover:text-[color:var(--accent)]"
                        >
                          {team.name}
                        </Link>
                      ) : (
                        "Team assignment coming soon"
                      )}
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Position:</span>{" "}
                      {player.position || "Position coming soon"}
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">School:</span>{" "}
                      {player.school || "School coming soon"}
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

      {selectedTeam && (
        <SectionCard title={`${selectedTeam.name} Coaches`} kicker="Team Coaches">
          {coaches.loading || teams.loading ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Loading coaches...
            </div>
          ) : coaches.error || teams.error ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Coach information is unavailable right now.
            </div>
          ) : selectedTeamCoaches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              No coaches are assigned to this team yet.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {selectedTeamCoaches.map((coach) => (
                <div
                  key={coach.id}
                  className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {coach.title || "Coach"}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                    {coach.firstName} {coach.lastName}
                  </h2>
                  {coach.photoUrl && (
                    <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--paper)]">
                      <Image
                        src={coach.photoUrl}
                        alt={`${coach.firstName} ${coach.lastName}`}
                        width={800}
                        height={800}
                        className="h-96 w-full object-cover"
                      />
                    </div>
                  )}
                  {(coach.description || coach.bio) && (
                    <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
                      {coach.description || coach.bio}
                    </p>
                  )}
                  {(coach.email || coach.phone) && (
                    <div className="mt-4 flex flex-wrap gap-2 text-sm text-[color:var(--muted)]">
                      {coach.email && (
                        <a
                          href={`mailto:${coach.email}`}
                          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                          aria-label={`Email ${coach.firstName} ${coach.lastName}`}
                        >
                          <MailIcon />
                          Email
                        </a>
                      )}
                      {coach.phone && (
                        <a
                          href={`tel:${coach.phone}`}
                          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                          aria-label={`Call ${coach.firstName} ${coach.lastName}`}
                        >
                          <PhoneIcon />
                          Call
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {showHannahEasterEgg && selectedTeam && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,40,87,0.18)] p-6 backdrop-blur-[2px]">
          <div className="overflow-hidden rounded-[2rem] border border-white/30 bg-white shadow-[0_28px_80px_rgba(11,40,87,0.35)]">
            <Image
              src="/hannah-cull-easter-egg.png"
              alt="Hannah Cull easter egg"
              width={976}
              height={1430}
              className="h-auto max-h-[80vh] w-[min(28rem,80vw)] object-cover"
              priority
            />
          </div>
        </div>
      )}

    </>
  );
}

export default function PlayersPage() {
  return (
    <Suspense fallback={null}>
      <PlayersPageContent />
    </Suspense>
  );
}
