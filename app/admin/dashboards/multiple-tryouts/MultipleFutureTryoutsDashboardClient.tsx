"use client";

import { useMemo } from "react";
import Link from "next/link";
import SectionCard from "@/app/components/SectionCard";
import { useFirestoreCollection } from "@/lib/firebase";
import type { EventDocument, RegistrationDocument } from "@/lib/firebase/schema";

type MultiTryoutRegistration = {
  playerId: string;
  playerName: string;
  tryouts: {
    event: EventDocument;
    registration: RegistrationDocument;
  }[];
};

function getDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return Number(`${match[1]}${match[2]}${match[3]}`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function getTodayDateKey() {
  const today = new Date();

  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function formatDate(value: string) {
  if (!value) {
    return "Date coming soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAgeGroups(event: EventDocument) {
  const ageGroups = event.ageGroups?.length ? event.ageGroups : event.ageGroup ? [event.ageGroup] : [];

  return ageGroups.length > 0 ? ageGroups.join(", ") : "All ages";
}

export default function MultipleFutureTryoutsDashboardClient() {
  const events = useFirestoreCollection("events");
  const registrations = useFirestoreCollection("registrations");
  const multiTryoutRegistrations = useMemo<MultiTryoutRegistration[]>(() => {
    const todayDateKey = getTodayDateKey();
    const futureTryoutById = new Map(
      events.data
        .filter((event) => event.active !== false)
        .filter((event) => event.type === "tryout")
        .filter((event) => getDateKey(event.endDate || event.startDate) >= todayDateKey)
        .map((event) => [event.id, event]),
    );
    const registrationsByPlayer = new Map<string, MultiTryoutRegistration>();

    registrations.data.forEach((registration) => {
      const event = futureTryoutById.get(registration.eventId);

      if (!event || registration.status === "cancelled") {
        return;
      }

      const playerName = `${registration.athleteFirstName} ${registration.athleteLastName}`.trim() || "Unnamed player";
      const existing = registrationsByPlayer.get(registration.playerId) ?? {
        playerId: registration.playerId,
        playerName,
        tryouts: [],
      };

      existing.tryouts.push({ event, registration });
      registrationsByPlayer.set(registration.playerId, existing);
    });

    return Array.from(registrationsByPlayer.values())
      .filter((playerRegistration) => playerRegistration.tryouts.length > 1)
      .map((playerRegistration) => ({
        ...playerRegistration,
        tryouts: [...playerRegistration.tryouts].sort(
          (left, right) =>
            getDateKey(left.event.startDate) - getDateKey(right.event.startDate) ||
            left.event.title.localeCompare(right.event.title),
        ),
      }))
      .sort(
        (left, right) =>
          left.playerName.localeCompare(right.playerName) ||
          left.playerId.localeCompare(right.playerId),
      );
  }, [events.data, registrations.data]);

  return (
    <SectionCard title="Multiple Future Tryouts" kicker="Registration Dashboard">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-[color:var(--muted)]">
          Players registered for more than one active future tryout.
        </p>
        <Link
          href="/admin/registrations"
          className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
        >
          Manage registrations
        </Link>
      </div>

      {events.loading || registrations.loading ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
          Loading future tryout registrations...
        </div>
      ) : events.error || registrations.error ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
          Future tryout registration data is unavailable right now.
        </div>
      ) : multiTryoutRegistrations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
          No players are registered for multiple future tryouts.
        </div>
      ) : (
        <div className="space-y-4">
          {multiTryoutRegistrations.map((playerRegistration) => (
            <div
              key={playerRegistration.playerId}
              className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5"
            >
              <div>
                <h2 className="text-xl font-bold text-[color:var(--ink)]">
                  {playerRegistration.playerName}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  {playerRegistration.tryouts.length} future tryouts
                </p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {playerRegistration.tryouts.map(({ event, registration }) => (
                  <div
                    key={registration.id}
                    className="rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]"
                  >
                    <p className="font-bold text-[color:var(--ink)]">{event.title}</p>
                    <p>{formatDate(event.startDate)}</p>
                    <p>Age group: {formatAgeGroups(event)}</p>
                    {event.location && <p>{event.location}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
