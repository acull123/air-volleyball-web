"use client";

import Image from "next/image";
import Link from "next/link";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { useFirestoreCollection } from "@/lib/firebase";
import type { CoachDocument, TeamDocument } from "@/lib/firebase/schema";

function getCoachTeamIds(coach: CoachDocument): string[] {
  if (Array.isArray(coach.teamIds)) {
    return coach.teamIds.filter(Boolean);
  }

  const legacyTeamId = (coach as CoachDocument & { teamId?: string }).teamId;
  return legacyTeamId ? [legacyTeamId] : [];
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
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
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.33 1.8.62 2.65a2 2 0 0 1-.45 2.11L8.01 9.75a16 16 0 0 0 6.24 6.24l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.74.5 2.65.62A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export default function CoachesPage() {
  const coaches = useFirestoreCollection("coaches");
  const teams = useFirestoreCollection("teams");
  const visibleCoaches = [...coaches.data]
    .filter((coach) => coach.active !== false)
    .sort((left, right) => `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`));

  return (
    <>
      <PageHero
        eyebrow="Coaches"
        title="Coach Directory"
        description="Meet the Air Volleyball coaching staff and see the teams each coach works with."
        actions={[
          { href: "/teams", label: "View Teams" },
          { href: "/players", label: "View Players", variant: "secondary" },
        ]}
      />

      <SectionCard title="All Coaches" kicker="Staff Directory">
        {coaches.loading || teams.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading coaches...
          </div>
        ) : coaches.error || teams.error ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Coach information is unavailable right now.
          </div>
        ) : visibleCoaches.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No coaches have been added yet.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleCoaches.map((coach) => {
              const coachTeams = getCoachTeamIds(coach)
                .map((teamId) => teams.data.find((team) => team.id === teamId))
                .filter((team): team is TeamDocument => Boolean(team));

              return (
                <article
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
                        className="h-80 w-full object-cover"
                      />
                    </div>
                  )}
                  {(coach.description || coach.bio) && (
                    <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
                      {coach.description || coach.bio}
                    </p>
                  )}
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-[color:var(--ink)]">Teams</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {coachTeams.length > 0 ? (
                        coachTeams.map((team) => (
                          <Link
                            key={team.id}
                            href={`/teams#team-${team.id}`}
                            className="rounded-full border border-[color:var(--line)] px-3 py-1 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                          >
                            {team.name}
                          </Link>
                        ))
                      ) : (
                        <span className="text-sm text-[color:var(--muted)]">Team assignments coming soon</span>
                      )}
                    </div>
                  </div>
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
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}
