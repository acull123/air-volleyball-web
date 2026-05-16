"use client";

import { useMemo, useState } from "react";
import SectionCard from "@/app/components/SectionCard";
import ClubCalendar from "@/app/components/ClubCalendar";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import { getEventTeamIds } from "@/lib/event-teams";
import type { ConflictDocument, EventDocument, GymSpaceDocument, TeamDocument } from "@/lib/firebase/schema";

type PracticePlanSettings = {
  practicesPerWeek: string;
  durationMinutes: string;
  startDate: string;
  endDate: string;
};

type PracticeSlot = {
  dateKey: string;
  startTime: string;
  endTime: string;
  gymSpace: GymSpaceDocument;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0",
  )}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function timeToMinutes(time: string) {
  const [rawHour, rawMinute = "00"] = time.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getDateRange(startDate: string, endDate: string) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);

  if (!start || !end || end < start) {
    return [];
  }

  const dates: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function getWeekKey(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  const weekStart = addDays(date, -date.getDay());
  return toDateKey(weekStart);
}

function getGymSpaceLocation(gymSpace: GymSpaceDocument) {
  return [gymSpace.facilityName, gymSpace.location].filter(Boolean).join(" - ");
}

function getBlockedDateSet(gymSpace: GymSpaceDocument) {
  return new Set(
    (gymSpace.blockedDates || "")
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function getPracticeSlots(gymSpaces: GymSpaceDocument[], dates: string[], durationMinutes: number) {
  const slots: PracticeSlot[] = [];

  gymSpaces
    .filter((gymSpace) => gymSpace.active !== false)
    .forEach((gymSpace) => {
      const startMinutes = timeToMinutes(gymSpace.startTime);
      const endMinutes = timeToMinutes(gymSpace.endTime);
      const blockedDates = getBlockedDateSet(gymSpace);

      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return;
      }

      dates.forEach((dateKey) => {
        const date = parseDateKey(dateKey);
        const dayName = date ? dayNames[date.getDay()] : "";

        if (
          blockedDates.has(dateKey) ||
          (gymSpace.availableDays.length > 0 && !gymSpace.availableDays.includes(dayName))
        ) {
          return;
        }

        for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += durationMinutes) {
          slots.push({
            dateKey,
            startTime: minutesToTime(minutes),
            endTime: minutesToTime(minutes + durationMinutes),
            gymSpace,
          });
        }
      });
    });

  return slots.sort((left, right) =>
    `${left.dateKey} ${left.startTime} ${left.gymSpace.facilityName}`.localeCompare(
      `${right.dateKey} ${right.startTime} ${right.gymSpace.facilityName}`,
    ),
  );
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function getPracticeConflictNames(
  team: TeamDocument,
  slot: PracticeSlot,
  durationMinutes: number,
  conflicts: ConflictDocument[],
) {
  const start = new Date(`${slot.dateKey}T${slot.startTime}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  if (Number.isNaN(start.getTime())) {
    return [];
  }

  return conflicts
    .filter((conflict) => team.playerIds.includes(conflict.playerId))
    .filter((conflict) => {
      const conflictStart = new Date(conflict.startAt);
      const conflictEnd = new Date(conflict.endAt);

      return (
        !Number.isNaN(conflictStart.getTime()) &&
        !Number.isNaN(conflictEnd.getTime()) &&
        overlaps(start, end, conflictStart, conflictEnd)
      );
    })
    .map((conflict) => conflict.playerName);
}

function buildPracticeTitle(team: TeamDocument) {
  return `Practice ${team.name}`;
}

function getPracticeConflictNamesForEvent(
  event: EventDocument,
  teams: TeamDocument[],
  conflicts: ConflictDocument[],
) {
  const teamIds = getEventTeamIds(event);
  const teamPlayers = teams
    .filter((team) => teamIds.includes(team.id))
    .flatMap((team) => team.playerIds);
  const start = new Date(`${event.startDate}T${event.startTime || "00:00"}:00`);
  const endTime = event.endTime || minutesToTime((timeToMinutes(event.startTime || "00:00") ?? 0) + (event.durationMinutes || 60));
  const end = new Date(`${event.endDate || event.startDate}T${endTime}:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  return conflicts
    .filter((conflict) => teamPlayers.includes(conflict.playerId))
    .filter((conflict) => {
      const conflictStart = new Date(conflict.startAt);
      const conflictEnd = new Date(conflict.endAt);

      return (
        !Number.isNaN(conflictStart.getTime()) &&
        !Number.isNaN(conflictEnd.getTime()) &&
        overlaps(start, end, conflictStart, conflictEnd)
      );
    })
    .map((conflict) => conflict.playerName);
}

export default function PracticePlanningClient() {
  const teams = useFirestoreCollection("teams");
  const gymSpaces = useFirestoreCollection("gymSpaces");
  const conflicts = useFirestoreCollection("conflicts");
  const events = useFirestoreCollection("events");
  const [settings, setSettings] = useState<PracticePlanSettings>({
    practicesPerWeek: "2",
    durationMinutes: "90",
    startDate: "",
    endDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTeams = useMemo(
    () =>
      [...teams.data]
        .filter((team) => team.active !== false)
        .sort((left, right) => `${left.ageGroup} ${left.name}`.localeCompare(`${right.ageGroup} ${right.name}`)),
    [teams.data],
  );
  const practiceEvents = useMemo(
    () =>
      events.data
        .filter((event) => event.type === "practice")
        .sort((left, right) => `${left.startDate} ${left.startTime}`.localeCompare(`${right.startDate} ${right.startTime}`)),
    [events.data],
  );
  const calendarIssues = useMemo(() => {
    const issues: string[] = [];
    const practicesPerWeek = Number(settings.practicesPerWeek);
    const dates = getDateRange(settings.startDate, settings.endDate);

    if (!Number.isNaN(practicesPerWeek) && practicesPerWeek > 0) {
      const weekKeys = [
        ...new Set([
          ...dates.map(getWeekKey),
          ...practiceEvents.map((event) => getWeekKey(event.startDate)),
        ]),
      ].sort();

      activeTeams.forEach((team) => {
        weekKeys.forEach((weekKey) => {
          const weekPractices = practiceEvents.filter((event) => getWeekKey(event.startDate) === weekKey);

          if (dates.length === 0 && weekPractices.length === 0) {
            return;
          }

          const count = weekPractices.filter((event) => {
            const teamIds = getEventTeamIds(event);
            return teamIds.includes(team.id);
          }).length;

          if (count < practicesPerWeek) {
            issues.push(
              `${team.name} has ${count} of ${practicesPerWeek} required practices for the week of ${weekKey}.`,
            );
          }
        });
      });
    }

    practiceEvents.forEach((event) => {
      const conflictNames = getPracticeConflictNamesForEvent(event, teams.data, conflicts.data);

      if (conflictNames.length > 0) {
        issues.push(`${event.title} on ${event.startDate} has conflicts: ${[...new Set(conflictNames)].join(", ")}.`);
      }
    });

    return issues;
  }, [activeTeams, conflicts.data, practiceEvents, settings.endDate, settings.practicesPerWeek, settings.startDate, teams.data]);

  async function updateEventTime(eventId: string, startTime: string) {
    const event = practiceEvents.find((entry) => entry.id === eventId);
    const startMinutes = timeToMinutes(startTime);

    await firestoreApi.events.update(eventId, {
      startTime,
      endTime:
        event?.type === "practice" && startMinutes !== null
          ? minutesToTime(startMinutes + Math.max(15, event.durationMinutes || 60))
          : event?.endTime || startTime,
    });
  }

  async function updateEventDate(eventId: string, startDate: string, endDate: string) {
    await firestoreApi.events.update(eventId, { startDate, endDate });
  }

  async function deleteEvent(eventId: string) {
    await firestoreApi.events.remove(eventId);
  }

  async function duplicateEvent(event: EventDocument, startDate: string, startTime: string) {
    const startMinutes = timeToMinutes(startTime);
    const durationMinutes = Math.max(15, event.durationMinutes || 60);
    const endTime = startMinutes === null ? event.endTime || startTime : minutesToTime(startMinutes + durationMinutes);

    await firestoreApi.events.create({
      type: event.type,
      title: event.title,
      status: event.status || "none",
      teamSchedules: event.teamSchedules || [],
      expenseTriggered: [],
      ageGroup: event.ageGroup || "",
      price: event.price || 0,
      paymentUrl: event.paymentUrl || "",
      externalUrl: event.externalUrl || "",
      startDate,
      endDate: startDate,
      startTime,
      endTime,
      durationMinutes,
      gymSpaceId: event.gymSpaceId || "",
      practicePublished: event.practicePublished,
      location: event.location || "",
      notes: event.notes || "",
      active: event.active !== false,
    });
  }

  async function deleteAllPractices() {
    if (practiceEvents.length === 0) {
      setStatus("No practices to delete.");
      setError(null);
      return;
    }

    const confirmed = window.confirm(`Delete all ${practiceEvents.length} practice events?`);

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      await Promise.all(practiceEvents.map((event) => firestoreApi.events.remove(event.id)));
      setStatus(`${practiceEvents.length} practice${practiceEvents.length === 1 ? "" : "s"} deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete practices.");
    } finally {
      setSaving(false);
    }
  }

  async function publishPractices() {
    const unpublishedPractices = practiceEvents.filter((event) => event.practicePublished === false);

    if (unpublishedPractices.length === 0) {
      setStatus("No unpublished practices to publish.");
      setError(null);
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      await Promise.all(
        unpublishedPractices.map((event) => firestoreApi.events.update(event.id, { practicePublished: true })),
      );
      setStatus(`${unpublishedPractices.length} practice${unpublishedPractices.length === 1 ? "" : "s"} published.`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish practices.");
    } finally {
      setSaving(false);
    }
  }

  async function generatePracticeSchedule() {
    const practicesPerWeek = Number(settings.practicesPerWeek);
    const durationMinutes = Number(settings.durationMinutes);
    const dates = getDateRange(settings.startDate, settings.endDate);

    if (
      Number.isNaN(practicesPerWeek) ||
      Number.isNaN(durationMinutes) ||
      practicesPerWeek <= 0 ||
      durationMinutes <= 0 ||
      dates.length === 0
    ) {
      setError("Enter a valid date range, practices per week, and duration.");
      setStatus(null);
      return;
    }

    const slots = getPracticeSlots(gymSpaces.data, dates, durationMinutes);

    if (slots.length === 0) {
      setError("No gym space availability is set for that date range.");
      setStatus(null);
      return;
    }

    const slotUsage = new Map<string, number>();
    const createdPractices: Array<{
      team: TeamDocument;
      slot: PracticeSlot;
      conflictNames: string[];
    }> = [];
    let skippedPracticeCount = 0;

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const existingPracticeDatesByTeamWeek = new Map<string, Set<string>>();
      const existingPracticeCountsByTeamWeek = new Map<string, number>();

      practiceEvents
        .filter((event) => dates.includes(event.startDate))
        .forEach((event) => {
          getEventTeamIds(event).forEach((teamId) => {
            const teamWeekKey = `${teamId}:${getWeekKey(event.startDate)}`;
            const datesForTeamWeek = existingPracticeDatesByTeamWeek.get(teamWeekKey) ?? new Set<string>();

            datesForTeamWeek.add(event.startDate);
            existingPracticeDatesByTeamWeek.set(teamWeekKey, datesForTeamWeek);
            existingPracticeCountsByTeamWeek.set(teamWeekKey, (existingPracticeCountsByTeamWeek.get(teamWeekKey) ?? 0) + 1);
          });
        });

      activeTeams.forEach((team) => {
        [...new Set(dates.map(getWeekKey))].forEach((weekKey) => {
          const weekDates = dates.filter((dateKey) => getWeekKey(dateKey) === weekKey);
          const teamWeekKey = `${team.id}:${weekKey}`;
          const teamPracticeDates = new Set(existingPracticeDatesByTeamWeek.get(teamWeekKey) ?? []);
          const existingPracticeCount = existingPracticeCountsByTeamWeek.get(teamWeekKey) ?? 0;
          const practicesToCreate = Math.max(0, practicesPerWeek - existingPracticeCount);

          for (let practiceIndex = 0; practiceIndex < practicesToCreate; practiceIndex += 1) {
            const weekSlots = slots.filter((slot) => weekDates.includes(slot.dateKey));
            const fallbackSlots = weekSlots.length > 0 ? weekSlots : slots;
            const slot =
              fallbackSlots.find((candidate) => {
                const slotKey = `${candidate.gymSpace.id}:${candidate.dateKey}:${candidate.startTime}`;
                const usage = slotUsage.get(slotKey) ?? 0;
                const conflictNames = getPracticeConflictNames(team, candidate, durationMinutes, conflicts.data);

                return (
                  usage < candidate.gymSpace.courtCount &&
                  !teamPracticeDates.has(candidate.dateKey) &&
                  conflictNames.length === 0
                );
              }) ??
              fallbackSlots.find((candidate) => {
                const slotKey = `${candidate.gymSpace.id}:${candidate.dateKey}:${candidate.startTime}`;
                const usage = slotUsage.get(slotKey) ?? 0;

                return usage < candidate.gymSpace.courtCount && !teamPracticeDates.has(candidate.dateKey);
              }) ??
              fallbackSlots.find((candidate) => !teamPracticeDates.has(candidate.dateKey));

            if (!slot) {
              skippedPracticeCount += 1;
              return;
            }

            const slotKey = `${slot.gymSpace.id}:${slot.dateKey}:${slot.startTime}`;
            const conflictNames = getPracticeConflictNames(team, slot, durationMinutes, conflicts.data);

            slotUsage.set(slotKey, (slotUsage.get(slotKey) ?? 0) + 1);
            teamPracticeDates.add(slot.dateKey);
            createdPractices.push({ team, slot, conflictNames });
          }
        });
      });

      await Promise.all(
        createdPractices.map(({ team, slot, conflictNames }) =>
          firestoreApi.events.create({
            type: "practice",
            title: buildPracticeTitle(team),
            status: "none",
            teamSchedules: [{ teamId: team.id, scheduleUrl: "" }],
            expenseTriggered: [],
            ageGroup: "",
            price: 0,
            paymentUrl: "",
            externalUrl: "",
            startDate: slot.dateKey,
            endDate: slot.dateKey,
            startTime: slot.startTime,
            endTime: slot.endTime,
            durationMinutes,
            gymSpaceId: slot.gymSpace.id,
            practicePublished: false,
            location: getGymSpaceLocation(slot.gymSpace),
            notes: conflictNames.length > 0 ? `Conflicts: ${[...new Set(conflictNames)].join(", ")}` : "",
            active: true,
          }),
        ),
      );

      setStatus(
        `${createdPractices.length} unpublished practice${createdPractices.length === 1 ? "" : "s"} generated.${
          skippedPracticeCount > 0
            ? ` ${skippedPracticeCount} practice${skippedPracticeCount === 1 ? "" : "s"} skipped because there were not enough separate nights.`
            : ""
        }`,
      );
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate practices.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8">
      <SectionCard title="Generate Practice Schedule" kicker="Scheduling">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            Practices per week
            <input
              value={settings.practicesPerWeek}
              onChange={(event) => setSettings((current) => ({ ...current, practicesPerWeek: event.target.value }))}
              className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              inputMode="numeric"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            Duration minutes
            <input
              value={settings.durationMinutes}
              onChange={(event) => setSettings((current) => ({ ...current, durationMinutes: event.target.value }))}
              className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              inputMode="numeric"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            Start date
            <input
              type="date"
              value={settings.startDate}
              onChange={(event) => setSettings((current) => ({ ...current, startDate: event.target.value }))}
              className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            End date
            <input
              type="date"
              value={settings.endDate}
              onChange={(event) => setSettings((current) => ({ ...current, endDate: event.target.value }))}
              className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void generatePracticeSchedule()}
            className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Working..." : "Generate Practices"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void publishPractices()}
            className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Publish All Practices
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void deleteAllPractices()}
            className="rounded-full border border-[#e7b8b8] px-5 py-3 text-sm font-semibold text-[#8a2d2d] transition hover:bg-[#fff2f2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete All Practices
          </button>
        </div>

        {status && <p className="mt-4 text-sm text-[color:var(--muted)]">{status}</p>}
        {error && (
          <div className="mt-4 rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
            {error}
          </div>
        )}
      </SectionCard>

      <ClubCalendar
        events={practiceEvents}
        teams={teams.data}
        conflicts={conflicts.data}
        gymSpaces={gymSpaces.data}
        loading={teams.loading || gymSpaces.loading || conflicts.loading || events.loading}
        onEventTimeSave={updateEventTime}
        onEventDateSave={updateEventDate}
        onEventDelete={deleteEvent}
        onEventDuplicate={duplicateEvent}
      />

      <SectionCard title="Calendar Issues" kicker="Schedule Advice">
        {calendarIssues.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No practice count or conflict issues found for the selected planning range.
          </p>
        ) : (
          <div className="space-y-2">
            {calendarIssues.map((issue) => (
              <div
                key={issue}
                className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-3 text-sm text-[#8a2d2d]"
              >
                {issue}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
