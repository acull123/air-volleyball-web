"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import { formatEventStatus, getEventStatus } from "@/lib/event-status";
import { getEventTeamLabel, getEventTeamSchedules } from "@/lib/event-teams";
import { compareAthletesByName } from "@/lib/player-name";
import { compareTeamsByAge } from "@/lib/team-sort";
import type { EventDocument, EventTeamSchedule, GymSpaceDocument, TeamDocument } from "@/lib/firebase/schema";

type EventDraft = {
  type: EventDocument["type"];
  title: string;
  status: EventDocument["status"];
  teamSchedules: EventTeamSchedule[];
  ageGroup: string;
  price: string;
  paymentUrl: string;
  externalUrl: string;
  startDate: string;
  endDate: string;
  startHour: string;
  startMinute: string;
  startMeridiem: "AM" | "PM";
  durationMinutes: string;
  gymSpaceId: string;
  location: string;
  notes: string;
  active: boolean;
};

const emptyDraft: EventDraft = {
  type: "tournament",
  title: "",
  status: "none",
  teamSchedules: [],
  ageGroup: "",
  price: "0",
  paymentUrl: "",
  externalUrl: "",
  startDate: "",
  endDate: "",
  startHour: "6",
  startMinute: "00",
  startMeridiem: "PM",
  durationMinutes: "90",
  gymSpaceId: "",
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
    startMeridiem: meridiem as "AM" | "PM",
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
    status: getEventStatus(event),
    teamSchedules: getEventTeamSchedules(event),
    ageGroup: event.ageGroup || legacyAgeGroups?.[0] || "",
    price: String(event.price ?? 0),
    paymentUrl: event.paymentUrl ?? "",
    externalUrl: event.externalUrl ?? "",
    startDate: event.startDate,
    endDate: event.endDate,
    startHour: parsedTime.startHour,
    startMinute: parsedTime.startMinute,
    startMeridiem: parsedTime.startMeridiem,
    durationMinutes: String(event.durationMinutes ?? 60),
    gymSpaceId: event.gymSpaceId ?? "",
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

function formatEventTypeLabel(type: EventDocument["type"]) {
  if (type === "twoDayTournament") {
    return "2 Day Tournament";
  }

  if (type === "areaCamp") {
    return "Area Camp";
  }

  if (type === "refScoringClinic") {
    return "Ref And Scoring Clinic";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getGymSpaceLocation(gymSpace: GymSpaceDocument | undefined) {
  return [gymSpace?.facilityName, gymSpace?.location].filter(Boolean).join(" - ");
}

function getPracticeTitle(teamSchedules: EventTeamSchedule[], teams: TeamDocument[]) {
  const teamId = teamSchedules[0]?.teamId;
  const teamName = teams.find((team) => team.id === teamId)?.name ?? "Team";

  return `Practice ${teamName}`;
}

function isTournamentType(type: EventDocument["type"]) {
  return type === "tournament" || type === "twoDayTournament";
}

function eventTypeUsesTeams(type: EventDocument["type"]) {
  return isTournamentType(type) || type === "practice";
}

function getPracticeEndDate(startDate: string, startTime: string, durationMinutes: number) {
  const start = new Date(`${startDate}T${startTime || "00:00"}:00`);

  if (!startDate || Number.isNaN(start.getTime())) {
    return startDate;
  }

  start.setMinutes(start.getMinutes() + durationMinutes);

  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
    start.getDate(),
  ).padStart(2, "0")}`;
}

function getEndTime(startTime: string, durationMinutes: number) {
  const [rawHour, rawMinute = "00"] = startTime.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return startTime;
  }

  return `${String(Math.floor((hour * 60 + minute + durationMinutes) / 60) % 24).padStart(2, "0")}:${String(
    (hour * 60 + minute + durationMinutes) % 60,
  ).padStart(2, "0")}`;
}

export default function EventManagerClient() {
  const events = useFirestoreCollection("events");
  const teams = useFirestoreCollection("teams");
  const gymSpaces = useFirestoreCollection("gymSpaces");
  const registrations = useFirestoreCollection("registrations");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEditingEvent = Boolean(selectedEventId);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sorted = [...events.data].sort((a, b) =>
      `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`),
    );

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((event) => {
      const teamName = getEventTeamLabel(event, teams.data);

      return [
        event.title,
        event.type,
        formatEventStatus(getEventStatus(event)),
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

  const activeGymSpaces = useMemo(
    () =>
      [...gymSpaces.data]
        .filter((gymSpace) => gymSpace.active !== false)
        .sort((left, right) => left.facilityName.localeCompare(right.facilityName)),
    [gymSpaces.data],
  );
  const sortedTeams = useMemo(() => [...teams.data].sort(compareTeamsByAge), [teams.data]);

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
      const selectedGymSpace = activeGymSpaces.find((gymSpace) => gymSpace.id === draft.gymSpaceId);
      const isPractice = draft.type === "practice";
      const isTournament = isTournamentType(draft.type);
      const isCamp = draft.type === "camp";
      const usesTeams = eventTypeUsesTeams(draft.type);
      const needsGymSpace = isPractice;
      const durationMinutes = draft.durationMinutes.trim() ? Number(draft.durationMinutes) : 0;
      const practiceEndDate = getPracticeEndDate(draft.startDate, startTime, durationMinutes);
      const teamSchedules = usesTeams ? (isPractice ? draft.teamSchedules.slice(0, 1) : draft.teamSchedules) : [];
      const payload = {
        type: draft.type,
        title: isPractice ? getPracticeTitle(teamSchedules, teams.data) : draft.title.trim(),
        status: isTournament ? draft.status : "none",
        teamSchedules: teamSchedules
          .map((entry) => ({
            teamId: entry.teamId.trim(),
            scheduleUrl: isPractice ? "" : entry.scheduleUrl.trim(),
          }))
          .filter((entry) => entry.teamId),
        ageGroup: isPractice || isTournament ? "" : draft.ageGroup,
        price: isPractice ? 0 : draft.price.trim() ? Number(draft.price) : 0,
        paymentUrl: isPractice || isTournament ? "" : draft.paymentUrl.trim(),
        externalUrl: isPractice || isCamp ? "" : draft.externalUrl.trim(),
        startDate: draft.startDate,
        endDate: isPractice ? practiceEndDate : normalizedEndDate,
        startTime,
        endTime: isPractice ? getEndTime(startTime, durationMinutes) : startTime,
        durationMinutes: isPractice ? durationMinutes : draft.durationMinutes.trim() ? Number(draft.durationMinutes) : 60,
        gymSpaceId: isPractice ? draft.gymSpaceId : "",
        practicePublished: isPractice,
        location: isPractice && draft.gymSpaceId ? getGymSpaceLocation(selectedGymSpace) : draft.location.trim(),
        notes: isPractice ? "" : draft.notes.trim(),
        active: draft.active,
      };

      if (!payload.title || !payload.startDate || !payload.startTime || !payload.location) {
        throw new Error("Title, start date, start time, and location are required.");
      }

      if (needsGymSpace && !payload.gymSpaceId) {
        throw new Error("Gym space is required.");
      }

      if (isPractice && payload.teamSchedules.length !== 1) {
        throw new Error("Select one team for the practice.");
      }

      if (Number.isNaN(payload.durationMinutes) || payload.durationMinutes <= 0) {
        throw new Error("Duration must be a valid number of minutes.");
      }

      if (Number.isNaN(payload.price) || payload.price < 0) {
        throw new Error("Event fee must be a valid amount.");
      }

      if (selectedEventId) {
        await firestoreApi.events.update(selectedEventId, payload);
        setStatus("Event updated.");
      } else {
        await firestoreApi.events.create({
          ...payload,
          expenseTriggered: [],
        });
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

  function toggleTeamSchedule(teamId: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      teamSchedules: checked
        ? current.teamSchedules.some((entry) => entry.teamId === teamId)
          ? current.teamSchedules
          : [...current.teamSchedules, { teamId, scheduleUrl: "" }]
        : current.teamSchedules.filter((entry) => entry.teamId !== teamId),
    }));
  }

  function updateTeamScheduleUrl(teamId: string, scheduleUrl: string) {
    setDraft((current) => ({
      ...current,
      teamSchedules: current.teamSchedules.map((entry) =>
        entry.teamId === teamId ? { ...entry, scheduleUrl } : entry,
      ),
    }));
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
                  setDraft((current) => {
                    const nextType = event.target.value as EventDocument["type"];
                    const firstTeamSchedule = current.teamSchedules[0];

                    return {
                      ...current,
                      type: nextType,
                      teamSchedules: eventTypeUsesTeams(nextType)
                        ? nextType === "practice" && firstTeamSchedule
                          ? [firstTeamSchedule]
                          : current.teamSchedules
                        : [],
                    };
                  })
                }
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="tournament">Tournament</option>
                <option value="twoDayTournament">2 Day Tournament</option>
                <option value="practice">Practice</option>
                <option value="camp">Camp</option>
                <option value="tryout">Tryout</option>
                <option value="areaCamp">Area Camp</option>
                <option value="refScoringClinic">Ref And Scoring Clinic</option>
              </select>
            </label>
            {isTournamentType(draft.type) && (
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Status
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, status: event.target.value as EventDocument["status"] }))
                  }
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  <option value="none">None</option>
                  <option value="accepted">Accepted</option>
                  <option value="pending">Pending</option>
                  <option value="waitlisted">Waitlisted</option>
                </select>
              </label>
            )}
            {eventTypeUsesTeams(draft.type) && (
              <div className="md:col-span-2 flex flex-col gap-3 text-sm font-semibold text-[color:var(--ink)]">
                {draft.type === "practice" ? "Team" : "Team schedules"}
                <div className="grid gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
                  {teams.data.length === 0 ? (
                    <p className="text-sm font-normal text-[color:var(--muted)] sm:col-span-2 xl:col-span-3">
                      No teams have been added yet.
                    </p>
                  ) : (
                    sortedTeams.map((team) => {
                      const teamSchedule = draft.teamSchedules.find((entry) => entry.teamId === team.id);
                      const isSelected = Boolean(teamSchedule);
                      const showScheduleLink = isEditingEvent && draft.type !== "practice";

                      return (
                        <div
                          key={team.id}
                          className="grid min-h-full gap-3 rounded-2xl bg-[color:var(--paper)] px-3 py-3"
                        >
                          <label className="flex items-center gap-3">
                            <input
                              type={draft.type === "practice" ? "radio" : "checkbox"}
                              name={draft.type === "practice" ? "practiceTeam" : undefined}
                              checked={isSelected}
                              onChange={(event) => {
                                if (draft.type === "practice") {
                                  setDraft((current) => ({
                                    ...current,
                                    teamSchedules: event.target.checked ? [{ teamId: team.id, scheduleUrl: "" }] : [],
                                  }));
                                  return;
                                }

                                toggleTeamSchedule(team.id, event.target.checked);
                              }}
                            />
                            <span>{team.name}</span>
                          </label>
                          {showScheduleLink && (
                            <input
                              value={teamSchedule?.scheduleUrl ?? ""}
                              onChange={(event) => updateTeamScheduleUrl(team.id, event.target.value)}
                              className="rounded-2xl border border-[color:var(--line)] px-4 py-3 disabled:bg-[color:var(--paper)]"
                              disabled={!isSelected}
                              placeholder="Team schedule link"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {draft.type !== "practice" && (
              <>
                <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    Event title <span className="text-[#b42318]">*</span>
                  </span>
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
                {!isTournamentType(draft.type) && (
                  <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    Payment link
                    <input
                      value={draft.paymentUrl}
                      onChange={(event) => setDraft((current) => ({ ...current, paymentUrl: event.target.value }))}
                      className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      placeholder="Paste a hosted payment link"
                    />
                  </label>
                )}
                {draft.type !== "camp" && (
                  <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    External link
                    <input
                      value={draft.externalUrl}
                      onChange={(event) => setDraft((current) => ({ ...current, externalUrl: event.target.value }))}
                      className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      placeholder="Paste the outside registration or event page link"
                    />
                  </label>
                )}
                {!isTournamentType(draft.type) && (
                  <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    Age group
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
                )}
              </>
            )}
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Start date <span className="text-[#b42318]">*</span>
              </span>
              <input
                value={draft.startDate}
                onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                type="date"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              End date
              <input
                value={draft.endDate}
                onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                type="date"
                disabled={draft.type === "practice"}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Start time <span className="text-[#b42318]">*</span>
              </span>
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
            {draft.type === "practice" && (
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <span>
                  Duration minutes <span className="text-[#b42318]">*</span>
                </span>
                <input
                  value={draft.durationMinutes}
                  onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  inputMode="numeric"
                  placeholder="90"
                />
              </label>
            )}
            {draft.type === "practice" && (
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <span>
                  Gym space <span className="text-[#b42318]">*</span>
                </span>
                <select
                  value={draft.gymSpaceId}
                  onChange={(event) => {
                    const gymSpaceId = event.target.value;
                    const gymSpace = activeGymSpaces.find((entry) => entry.id === gymSpaceId);

                    setDraft((current) => ({
                      ...current,
                      gymSpaceId,
                      location: gymSpaceId ? getGymSpaceLocation(gymSpace) : current.location,
                    }));
                  }}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  <option value="">Select gym space</option>
                  {activeGymSpaces.map((gymSpace) => (
                    <option key={gymSpace.id} value={gymSpace.id}>
                      {getGymSpaceLocation(gymSpace)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {draft.type !== "practice" && (
              <>
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
                  Notes
                  <textarea
                    value={draft.notes}
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                    className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                    placeholder="Add travel notes, bracket details, or arrival reminders."
                  />
                </label>
              </>
            )}
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
              const teamName = getEventTeamLabel(event, teams.data);
              const eventRegistrations = registrations.data
                .filter((registration) => registration.eventId === event.id)
                .sort(compareAthletesByName);
              const shouldShowRegistrations = event.type === "camp" || event.type === "tryout";

              return (
                <div key={event.id} className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-[color:var(--ink)]">{event.title}</p>
                      <p className="text-sm capitalize text-[color:var(--muted)]">
                        {formatEventTypeLabel(event.type)}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Status: {formatEventStatus(getEventStatus(event))}
                      </p>
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
                      <p className="text-sm text-[color:var(--muted)]">
                        External link: {event.externalUrl ? "Ready" : "Not set"}
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
