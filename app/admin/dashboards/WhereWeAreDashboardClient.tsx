"use client";

import { useMemo, useState } from "react";
import ClubCalendar from "@/app/components/ClubCalendar";
import SectionCard from "@/app/components/SectionCard";
import { getEventTeamSchedules } from "@/lib/event-teams";
import { useFirestoreCollection } from "@/lib/firebase";
import { formatTournamentEventLabel, isTournamentEventType } from "@/lib/tournament-events";
import type { EventDocument } from "@/lib/firebase/schema";

function getDateKeysForEvent(event: EventDocument) {
  const start = parseDateKey(event.startDate);
  const end = parseDateKey(event.endDate || event.startDate) ?? start;

  if (!start || !end) {
    return [];
  }

  const dateKeys: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dateKeys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dateKeys;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0",
  )}`;
}

function formatDateTitle(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string) {
  if (!time) {
    return "Time TBD";
  }

  const [rawHour, rawMinute = "00"] = time.split(":");
  const hour = Number(rawHour);

  if (Number.isNaN(hour)) {
    return time;
  }

  const meridiem = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${rawMinute} ${meridiem}`;
}

export default function WhereWeAreDashboardClient() {
  const events = useFirestoreCollection("events");
  const teams = useFirestoreCollection("teams");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const tournamentEvents = useMemo(
    () =>
      events.data
        .filter((event) => event.active !== false)
        .filter((event) => isTournamentEventType(event.type)),
    [events.data],
  );
  const selectedTournaments = useMemo(
    () =>
      selectedDateKey
        ? tournamentEvents
            .filter((event) => getDateKeysForEvent(event).includes(selectedDateKey))
            .sort((left, right) =>
              `${left.startTime || "99:99"} ${left.title}`.localeCompare(`${right.startTime || "99:99"} ${right.title}`),
            )
        : [],
    [selectedDateKey, tournamentEvents],
  );
  const loading = events.loading || teams.loading;
  const error = events.error || teams.error;

  return (
    <>
      {error ? (
        <SectionCard title="Where We Are Unavailable" kicker="Dashboards">
          <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
            {error}
          </div>
        </SectionCard>
      ) : (
        <ClubCalendar
          events={tournamentEvents}
          teams={teams.data}
          conflicts={[]}
          loading={loading}
          monthOnly
          onMonthDayClick={setSelectedDateKey}
        />
      )}

      {selectedDateKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1f33]/60 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="where-we-are-dialog-title"
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  Tournament Day
                </p>
                <h2 id="where-we-are-dialog-title" className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                  {formatDateTitle(selectedDateKey)}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close tournaments dialog"
                onClick={() => setSelectedDateKey(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line)] text-xl font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                x
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {selectedTournaments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--line)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                  No tournaments are scheduled for this day.
                </div>
              ) : (
                selectedTournaments.map((event) => {
                  const tournamentTeams = getEventTeamSchedules(event)
                    .map((entry) => teams.data.find((team) => team.id === entry.teamId))
                    .filter((team): team is NonNullable<typeof team> => Boolean(team));

                  return (
                    <div key={event.id} className="rounded-2xl border border-[color:var(--line)] px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-bold text-[color:var(--ink)]">{event.title}</p>
                          <p className="mt-1 text-sm text-[color:var(--muted)]">
                            {[formatTime(event.startTime), event.location].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className="w-fit rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#1d4f91]">
                          {formatTournamentEventLabel(event)}
                        </span>
                      </div>
                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                          Teams playing
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tournamentTeams.length === 0 ? (
                            <span className="rounded-full border border-[color:var(--line)] px-3 py-1 text-sm font-semibold text-[color:var(--muted)]">
                              Teams TBD
                            </span>
                          ) : (
                            tournamentTeams.map((team) => (
                              <span
                                key={team.id}
                                className="rounded-full border border-[#bfd5f2] bg-[#f3f8ff] px-3 py-1 text-sm font-semibold text-[#1d4f91]"
                              >
                                {team.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
