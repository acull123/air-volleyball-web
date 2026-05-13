"use client";

import { useMemo, useState } from "react";
import type { ConflictDocument, EventDocument, EventTeamSchedule, TeamDocument } from "@/lib/firebase/schema";
import { getEventTeamSchedules } from "@/lib/event-teams";

type ClubCalendarProps = {
  events: EventDocument[];
  teams: TeamDocument[];
  conflicts: ConflictDocument[];
  loading?: boolean;
  onEventTimeSave?: (eventId: string, startTime: string) => Promise<void>;
};

type CalendarEventEntry = {
  id: string;
  event: EventDocument;
  dateKey: string;
  teamLabel: string;
};

type CalendarConflictEntry = {
  id: string;
  conflict: ConflictDocument;
  dateKey: string;
};

const eventTypeLabels: Record<EventDocument["type"], string> = {
  tournament: "Tournament",
  twoDayTournament: "2 Day Tournament",
  practice: "Practice",
  camp: "Camp",
  tryout: "Tryout",
  areaCamp: "Area Camp",
  refScoringClinic: "Ref And Scoring Clinic",
};

const eventTypeClasses: Record<EventDocument["type"], string> = {
  tournament: "bg-[#1d67cd] text-white",
  twoDayTournament: "bg-[#1d67cd] text-white",
  practice: "bg-[#237a57] text-white",
  camp: "bg-[#b35d19] text-white",
  tryout: "bg-[#7c3aed] text-white",
  areaCamp: "bg-[#0f766e] text-white",
  refScoringClinic: "bg-[#be123c] text-white",
};

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function parseDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDaysBetween(startDate: string, endDate: string) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate || startDate) ?? start;

  if (!start || !end) {
    return [];
  }

  const days: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    days.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return days;
}

function getConflictDays(conflict: ConflictDocument) {
  const start = parseDateTime(conflict.startAt);
  const end = parseDateTime(conflict.endAt) ?? start;

  if (!start || !end) {
    return [];
  }

  const days: string[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor <= last) {
    days.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return days;
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
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
  const normalizedHour = hour % 12 || 12;

  return `${normalizedHour}:${rawMinute} ${meridiem}`;
}

function getTeamLabel(teamSchedules: EventTeamSchedule[], teams: TeamDocument[]) {
  const teamIds = teamSchedules.map((entry) => entry.teamId).filter(Boolean);

  if (teamIds.length === 0) {
    return "All teams";
  }

  if (teamIds.length > 1) {
    return "Multiple teams";
  }

  return teams.find((team) => team.id === teamIds[0])?.name ?? "Team TBD";
}

export default function ClubCalendar({
  events,
  teams,
  conflicts,
  loading = false,
  onEventTimeSave,
}: ClubCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [enabledEventTypes, setEnabledEventTypes] = useState<Set<EventDocument["type"]>>(
    () => new Set(Object.keys(eventTypeLabels) as EventDocument["type"][]),
  );
  const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(() => new Set());
  const [showConflicts, setShowConflicts] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [timeDraft, setTimeDraft] = useState("");
  const [savingTime, setSavingTime] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) ?? null : null;
  const activeEvents = useMemo(
    () =>
      events
        .filter((event) => event.active !== false)
        .filter((event) => enabledEventTypes.has(event.type))
        .filter((event) => !hiddenEventIds.has(event.id)),
    [enabledEventTypes, events, hiddenEventIds],
  );
  const eventEntries = useMemo<CalendarEventEntry[]>(
    () =>
      activeEvents.flatMap((event) => {
        const teamSchedules = getEventTeamSchedules(event);
        const teamLabel = getTeamLabel(teamSchedules, teams);

        return getDaysBetween(event.startDate, event.endDate || event.startDate).map((dateKey) => ({
          id: `${event.id}:${dateKey}`,
          event,
          dateKey,
          teamLabel,
        }));
      }),
    [activeEvents, teams],
  );
  const conflictEntries = useMemo<CalendarConflictEntry[]>(
    () =>
      showConflicts
        ? conflicts.flatMap((conflict) =>
            getConflictDays(conflict).map((dateKey) => ({
              id: `${conflict.id}:${dateKey}`,
              conflict,
              dateKey,
            })),
          )
        : [],
    [conflicts, showConflicts],
  );
  const monthDays = useMemo(() => {
    const start = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const firstGridDate = addDays(start, -start.getDay());

    return Array.from({ length: 42 }, (_, index) => addDays(firstGridDate, index));
  }, [visibleMonth]);
  const eventOptions = useMemo(
    () =>
      [...events]
        .filter((event) => event.active !== false)
        .sort((left, right) => `${left.startDate} ${left.title}`.localeCompare(`${right.startDate} ${right.title}`)),
    [events],
  );
  const monthAgenda = useMemo(() => {
    const month = visibleMonth.getMonth();
    const year = visibleMonth.getFullYear();

    return eventEntries
      .filter((entry) => {
        const date = parseDateKey(entry.dateKey);
        return date?.getMonth() === month && date.getFullYear() === year;
      })
      .sort((left, right) => `${left.dateKey} ${left.event.startTime}`.localeCompare(`${right.dateKey} ${right.event.startTime}`));
  }, [eventEntries, visibleMonth]);

  function toggleEventType(type: EventDocument["type"], checked: boolean) {
    setEnabledEventTypes((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(type);
      } else {
        next.delete(type);
      }

      return next;
    });
  }

  function toggleEventVisibility(eventId: string, checked: boolean) {
    setHiddenEventIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }

      return next;
    });
  }

  function openEventDialog(event: EventDocument) {
    setSelectedEventId(event.id);
    setTimeDraft(event.startTime || "");
    setStatus(null);
    setError(null);
  }

  async function saveEventTime() {
    if (!selectedEvent || !onEventTimeSave) {
      setSelectedEventId(null);
      return;
    }

    setSavingTime(true);
    setStatus(null);
    setError(null);

    try {
      await onEventTimeSave(selectedEvent.id, timeDraft);
      setStatus("Event time updated.");
      setSelectedEventId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update event time.");
    } finally {
      setSavingTime(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <aside className="space-y-4 rounded-[1.5rem] border border-[color:var(--line)] bg-white px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">Filters</p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
              Show or hide event types, specific events, and conflicts.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-[color:var(--ink)]">Event types</p>
            {(Object.keys(eventTypeLabels) as EventDocument["type"][]).map((type) => (
              <label key={type} className="flex items-center gap-3 text-sm text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  checked={enabledEventTypes.has(type)}
                  onChange={(event) => toggleEventType(type, event.target.checked)}
                />
                <span className={`h-3 w-3 rounded-full ${eventTypeClasses[type]}`} />
                <span>{eventTypeLabels[type]}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-[color:var(--ink)]">Calendar items</p>
            <label className="flex items-center gap-3 text-sm text-[color:var(--ink)]">
              <input
                type="checkbox"
                checked={showConflicts}
                onChange={(event) => setShowConflicts(event.target.checked)}
              />
              <span>Conflicts</span>
            </label>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {eventOptions.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">No active events yet.</p>
              ) : (
                eventOptions.map((event) => (
                  <label key={event.id} className="flex items-start gap-3 text-sm text-[color:var(--ink)]">
                    <input
                      type="checkbox"
                      checked={!hiddenEventIds.has(event.id)}
                      onChange={(changeEvent) => toggleEventVisibility(event.id, changeEvent.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold">{event.title}</span>
                      <span className="block text-xs text-[color:var(--muted)]">{formatShortDate(event.startDate)}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="rounded-[1.5rem] border border-[color:var(--line)] bg-white p-3 shadow-[0_14px_35px_rgba(18,38,63,0.06)] md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">Calendar</p>
              <h2 className="mt-1 text-3xl font-bold text-[color:var(--ink)]">{formatMonthTitle(visibleMonth)}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                }
                className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                }
                className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-12 text-center text-sm text-[color:var(--muted)]">
              Loading calendar...
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-7 border-l border-t border-[color:var(--line)] text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="border-b border-r border-[color:var(--line)] px-2 py-2 text-center">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-[color:var(--line)]">
                {monthDays.map((day) => {
                  const dateKey = toDateKey(day);
                  const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                  const isToday = dateKey === toDateKey(today);
                  const dayEvents = eventEntries.filter((entry) => entry.dateKey === dateKey);
                  const dayConflicts = conflictEntries.filter((entry) => entry.dateKey === dateKey);

                  return (
                    <div
                      key={dateKey}
                      className={`min-h-28 border-b border-r border-[color:var(--line)] px-1.5 py-2 md:min-h-36 md:px-2 ${
                        isCurrentMonth ? "bg-white" : "bg-[color:var(--paper)]/60"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-1">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                            isToday
                              ? "bg-[color:var(--ink)] text-white"
                              : isCurrentMonth
                                ? "text-[color:var(--ink)]"
                                : "text-[color:var(--muted)]"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {dayEvents.slice(0, 4).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => openEventDialog(entry.event)}
                            className={`w-full rounded-lg px-2 py-1 text-left text-[0.7rem] font-semibold leading-4 shadow-sm transition hover:brightness-95 md:text-xs ${eventTypeClasses[entry.event.type]}`}
                          >
                            <span className="block truncate">{entry.event.title}</span>
                            <span className="block truncate opacity-85">
                              {formatTime(entry.event.startTime)} · {entry.teamLabel}
                            </span>
                          </button>
                        ))}
                        {dayConflicts.slice(0, 3).map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-lg border border-[#e7b8b8] bg-[#fff2f2] px-2 py-1 text-[0.7rem] font-semibold leading-4 text-[#8a2d2d] md:text-xs"
                          >
                            <span className="block truncate">Conflict: {entry.conflict.playerName}</span>
                            <span className="block truncate opacity-80">{entry.conflict.status}</span>
                          </div>
                        ))}
                        {dayEvents.length + dayConflicts.length > 7 && (
                          <p className="px-1 text-[0.7rem] font-semibold text-[color:var(--muted)]">
                            +{dayEvents.length + dayConflicts.length - 7} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 md:hidden">
                <p className="mb-3 text-sm font-bold text-[color:var(--ink)]">Month agenda</p>
                <div className="space-y-2">
                  {monthAgenda.length === 0 ? (
                    <p className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                      No visible events this month.
                    </p>
                  ) : (
                    monthAgenda.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => openEventDialog(entry.event)}
                        className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ${eventTypeClasses[entry.event.type]}`}
                      >
                        <span className="block">{formatShortDate(entry.dateKey)} · {entry.event.title}</span>
                        <span className="block opacity-85">
                          {formatTime(entry.event.startTime)} · {entry.teamLabel}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {status && <p className="text-sm text-[color:var(--muted)]">{status}</p>}
      {error && (
        <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
          {error}
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1f33]/60 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-event-dialog-title"
            className="w-full max-w-xl rounded-[1.5rem] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {eventTypeLabels[selectedEvent.type]}
                </p>
                <h2 id="calendar-event-dialog-title" className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close event dialog"
                onClick={() => setSelectedEventId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line)] text-xl font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                x
              </button>
            </div>

            <div className="mt-5 grid gap-4 text-sm text-[color:var(--muted)]">
              <p>
                <span className="font-semibold text-[color:var(--ink)]">Date:</span>{" "}
                {formatShortDate(selectedEvent.startDate)}
                {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate
                  ? ` to ${formatShortDate(selectedEvent.endDate)}`
                  : ""}
              </p>
              <p>
                <span className="font-semibold text-[color:var(--ink)]">Teams:</span>{" "}
                {getTeamLabel(getEventTeamSchedules(selectedEvent), teams)}
              </p>
              <label className="flex flex-col gap-2 font-semibold text-[color:var(--ink)]">
                Event time
                <input
                  type="time"
                  value={timeDraft}
                  onChange={(event) => setTimeDraft(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                />
              </label>
              {selectedEvent.location && (
                <p>
                  <span className="font-semibold text-[color:var(--ink)]">Location:</span> {selectedEvent.location}
                </p>
              )}
              {selectedEvent.notes && <p className="leading-7">{selectedEvent.notes}</p>}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={savingTime}
                onClick={() => void saveEventTime()}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTime ? "Saving..." : "Save Time"}
              </button>
              <button
                type="button"
                disabled={savingTime}
                onClick={() => setSelectedEventId(null)}
                className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
