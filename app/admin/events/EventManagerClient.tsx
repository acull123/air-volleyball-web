"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import type { EventDocument } from "@/lib/firebase/schema";

type EventDraft = {
  type: EventDocument["type"];
  title: string;
  teamId: string;
  ageGroup: string;
  price: string;
  paymentUrl: string;
  startDate: string;
  endDate: string;
  startHour: string;
  startMinute: string;
  startMeridiem: "AM" | "PM";
  location: string;
  notes: string;
  active: boolean;
};

const emptyDraft: EventDraft = {
  type: "tournament",
  title: "",
  teamId: "",
  ageGroup: "",
  price: "0",
  paymentUrl: "",
  startDate: "",
  endDate: "",
  startHour: "6",
  startMinute: "00",
  startMeridiem: "PM",
  location: "",
  notes: "",
  active: true,
};

function parseStoredTime(value: string) {
  if (!value) {
    return {
      startHour: "6",
      startMinute: "00",
      startMeridiem: "PM" as const,
    };
  }

  const [rawHour = "18", rawMinute = "00"] = value.split(":");
  const hour24 = Number(rawHour);

  if (Number.isNaN(hour24)) {
    return {
      startHour: "6",
      startMinute: "00",
      startMeridiem: "PM" as const,
    };
  }

  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const normalizedHour = hour24 % 12 || 12;

  return {
    startHour: String(normalizedHour),
    startMinute: rawMinute,
    startMeridiem: meridiem,
  };
}

function formatStoredTime(hour: string, minute: string, meridiem: "AM" | "PM") {
  const normalizedHour = Number(hour);

  if (Number.isNaN(normalizedHour)) {
    return "";
  }

  const hour24 =
    meridiem === "AM"
      ? normalizedHour === 12
        ? 0
        : normalizedHour
      : normalizedHour === 12
        ? 12
        : normalizedHour + 12;

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function mapEventToDraft(event: EventDocument): EventDraft {
  const legacyAgeGroups = (event as EventDocument & { ageGroups?: string[] }).ageGroups;
  const parsedTime = parseStoredTime(event.startTime);

  return {
    type: event.type,
    title: event.title,
    teamId: event.teamId,
    ageGroup: event.ageGroup || legacyAgeGroups?.[0] || "",
    price: String(event.price ?? 0),
    paymentUrl: event.paymentUrl ?? "",
    startDate: event.startDate,
    endDate: event.endDate,
    startHour: parsedTime.startHour,
    startMinute: parsedTime.startMinute,
    startMeridiem: parsedTime.startMeridiem,
    location: event.location,
    notes: event.notes,
    active: event.active,
  };
}

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate) {
    return "Date coming soon";
  }

  const start = new Date(startDate);
  const end = new Date(endDate || startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startDate, endDate].filter(Boolean).join(" to ");
  }

  const formatter: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  if (startDate === (endDate || startDate)) {
    return start.toLocaleDateString(undefined, formatter);
  }

  return `${start.toLocaleDateString(undefined, formatter)} to ${end.toLocaleDateString(undefined, formatter)}`;
}

export default function EventManagerClient() {
  const events = useFirestoreCollection("events");
  const teams = useFirestoreCollection("teams");
  const registrations = useFirestoreCollection("registrations");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sorted = [...events.data].sort((a, b) =>
      `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`),
    );

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((event) => {
      const teamName = teams.data.find((team) => team.id === event.teamId)?.name ?? "";

      return [
        event.title,
        event.type,
        event.startDate,
        event.endDate,
        event.startTime,
        event.location,
        teamName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [events.data, searchTerm, teams.data]);

  function resetForm() {
    setSelectedEventId(null);
    setDraft(emptyDraft);
  }

  function beginEdit(event: EventDocument) {
    setSelectedEventId(event.id);
    setDraft(mapEventToDraft(event));
    setStatus(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const normalizedEndDate = draft.endDate || draft.startDate;
      const startTime = formatStoredTime(draft.startHour, draft.startMinute, draft.startMeridiem);
      const payload = {
        type: draft.type,
        title: draft.title.trim(),
        teamId: draft.teamId.trim(),
        ageGroup: draft.ageGroup,
        price: draft.price.trim() ? Number(draft.price) : 0,
        paymentUrl: draft.paymentUrl.trim(),
        startDate: draft.startDate,
        endDate: normalizedEndDate,
        startTime,
        location: draft.location.trim(),
        notes: draft.notes.trim(),
        active: draft.active,
      };

      if (!payload.title || !payload.startDate || !payload.startTime || !payload.location) {
        throw new Error("Title, start date, start time, and location are required.");
      }

      if (Number.isNaN(payload.price) || payload.price < 0) {
        throw new Error("Event fee must be a valid amount.");
      }

      if (selectedEventId) {
        await firestoreApi.events.update(selectedEventId, payload);
        setStatus("Event updated.");
      } else {
        await firestoreApi.events.create(payload);
        setStatus("Event created.");
      }

      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId: string) {
    const confirmed = window.confirm("Delete this event?");

    if (!confirmed) {
      return;
    }

    setStatus(null);
    setError(null);

    try {
      await firestoreApi.events.remove(eventId);
      if (selectedEventId === eventId) {
        resetForm();
      }
      setStatus("Event deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete event.");
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Event Manager"
        title="Manage Events"
        description="Create tournaments and other team events with a date range, start time, team assignment, and location."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title={selectedEventId ? "Edit Event" : "Add Event"} kicker="Event Details">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Event type
              <select
                value={draft.type}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, type: event.target.value as EventDocument["type"] }))
                }
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="tournament">Tournament</option>
                <option value="practice">Practice</option>
                <option value="camp">Camp</option>
                <option value="tryout">Tryout</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Team (optional)
              <select
                value={draft.teamId}
                onChange={(event) => setDraft((current) => ({ ...current, teamId: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="">All players</option>
                {teams.data.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Event title
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Example: President's Day Tournament"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Event fee
              <input
                value={draft.price}
                onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                inputMode="decimal"
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Payment link (optional)
              <input
                value={draft.paymentUrl}
                onChange={(event) => setDraft((current) => ({ ...current, paymentUrl: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Paste a hosted payment link"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Age group (optional)
              <select
                value={draft.ageGroup}
                onChange={(event) => setDraft((current) => ({ ...current, ageGroup: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="">All ages</option>
                {["12U", "13U", "14U", "15U", "16U", "17U", "18U"].map((ageGroup) => (
                  <option key={ageGroup} value={ageGroup}>
                    {ageGroup}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Start date
              <input
                value={draft.startDate}
                onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                type="date"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              End date (optional)
              <input
                value={draft.endDate}
                onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                type="date"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Start time
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={draft.startHour}
                  onChange={(event) => setDraft((current) => ({ ...current, startHour: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.startMinute}
                  onChange={(event) => setDraft((current) => ({ ...current, startMinute: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  {["00", "15", "30", "45"].map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.startMeridiem}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      startMeridiem: event.target.value as "AM" | "PM",
                    }))
                  }
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Location
              <input
                value={draft.location}
                onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Facility or venue"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Notes (optional)
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Add travel notes, bracket details, or arrival reminders."
              />
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              />
              Active event
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : selectedEventId ? "Save Changes" : "Add Event"}
              </button>
              {selectedEventId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                >
                  Cancel Edit
                </button>
              )}
              {status && <span className="text-sm text-[color:var(--muted)]">{status}</span>}
            </div>
            {error && (
              <div className="md:col-span-2 rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                {error}
              </div>
            )}
          </form>
        </SectionCard>

        <SectionCard title="Current Events" kicker="Event Records">
          <div className="mb-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Search events
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search by title, team, location, or date"
              />
            </label>
          </div>
          <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
            {events.loading && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Loading events...
              </div>
            )}
            {!events.loading && filteredEvents.length === 0 && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                No events match the current search.
              </div>
            )}
            {filteredEvents.map((event) => {
              const teamName = teams.data.find((team) => team.id === event.teamId)?.name ?? "All players";
              const eventRegistrations = registrations.data
                .filter((registration) => registration.eventId === event.id)
                .sort((left, right) =>
                  `${left.athleteLastName} ${left.athleteFirstName}`.localeCompare(
                    `${right.athleteLastName} ${right.athleteFirstName}`,
                  ),
                );
              const shouldShowRegistrations = event.type === "camp" || event.type === "tryout";

              return (
                <div key={event.id} className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-[color:var(--ink)]">{event.title}</p>
                      <p className="text-sm capitalize text-[color:var(--muted)]">{event.type}</p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Team: {teamName}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Fee: {typeof event.price === "number" ? `$${event.price.toFixed(2)}` : "$0.00"}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Age group: {event.ageGroup || (event as EventDocument & { ageGroups?: string[] }).ageGroups?.[0] || "All ages"}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Dates: {formatDateRange(event.startDate, event.endDate)}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Start time: {event.startTime || "Time coming soon"}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Location: {event.location}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Payment: {event.paymentUrl ? "Ready" : event.price > 0 ? "Link needed" : "No payment needed"}
                      </p>
                      {shouldShowRegistrations && (
                        <div className="pt-2">
                          <p className="text-sm font-semibold text-[color:var(--ink)]">
                            Registered players: {eventRegistrations.length}
                          </p>
                          {registrations.loading ? (
                            <p className="text-sm text-[color:var(--muted)]">Loading registrations...</p>
                          ) : registrations.error ? (
                            <p className="text-sm text-[color:var(--muted)]">Registrations are unavailable right now.</p>
                          ) : eventRegistrations.length === 0 ? (
                            <p className="text-sm text-[color:var(--muted)]">No players have registered yet.</p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {eventRegistrations.map((registration) => (
                                <span
                                  key={registration.id}
                                  className="rounded-full bg-[color:var(--paper)] px-3 py-1 text-xs font-semibold text-[color:var(--ink)]"
                                >
                                  {registration.athleteFirstName} {registration.athleteLastName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {(event.type === "camp" || event.type === "tryout") && (
                        <Link
                          href={`/admin/registrations?event=${event.id}`}
                          className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                        >
                          Registrations
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => beginEdit(event)}
                        className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(event.id)}
                        className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
