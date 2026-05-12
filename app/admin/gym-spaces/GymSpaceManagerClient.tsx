"use client";

import { useMemo, useState, type FormEvent } from "react";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import type { GymSpaceDocument } from "@/lib/firebase/schema";

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type GymSpaceDraft = {
  facilityName: string;
  courtCount: string;
  location: string;
  availableDays: string[];
  startHour: string;
  startMinute: string;
  startMeridiem: "AM" | "PM";
  endHour: string;
  endMinute: string;
  endMeridiem: "AM" | "PM";
  blockedDates: string;
  notes: string;
  active: boolean;
};

const emptyDraft: GymSpaceDraft = {
  facilityName: "",
  courtCount: "1",
  location: "",
  availableDays: [],
  startHour: "5",
  startMinute: "00",
  startMeridiem: "PM",
  endHour: "9",
  endMinute: "00",
  endMeridiem: "PM",
  blockedDates: "",
  notes: "",
  active: true,
};

function parseStoredTime(value: string, fallbackHour: string, fallbackMeridiem: "AM" | "PM") {
  if (!value) {
    return {
      hour: fallbackHour,
      minute: "00",
      meridiem: fallbackMeridiem,
    };
  }

  const [rawHour = fallbackHour, rawMinute = "00"] = value.split(":");
  const hour24 = Number(rawHour);

  if (Number.isNaN(hour24)) {
    return {
      hour: fallbackHour,
      minute: "00",
      meridiem: fallbackMeridiem,
    };
  }

  return {
    hour: String(hour24 % 12 || 12),
    minute: rawMinute,
    meridiem: hour24 >= 12 ? "PM" : "AM",
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

function formatDisplayTime(value: string) {
  if (!value) {
    return "Time coming soon";
  }

  const [rawHour = "0", rawMinute = "00"] = value.split(":");
  const hour24 = Number(rawHour);

  if (Number.isNaN(hour24)) {
    return value;
  }

  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const normalizedHour = hour24 % 12 || 12;

  return `${normalizedHour}:${rawMinute} ${meridiem}`;
}

function mapGymSpaceToDraft(gymSpace: GymSpaceDocument): GymSpaceDraft {
  const parsedStart = parseStoredTime(gymSpace.startTime, "5", "PM");
  const parsedEnd = parseStoredTime(gymSpace.endTime, "9", "PM");

  return {
    facilityName: gymSpace.facilityName,
    courtCount: String(gymSpace.courtCount || 1),
    location: gymSpace.location,
    availableDays: gymSpace.availableDays ?? [],
    startHour: parsedStart.hour,
    startMinute: parsedStart.minute,
    startMeridiem: parsedStart.meridiem,
    endHour: parsedEnd.hour,
    endMinute: parsedEnd.minute,
    endMeridiem: parsedEnd.meridiem,
    blockedDates: gymSpace.blockedDates,
    notes: gymSpace.notes,
    active: gymSpace.active,
  };
}

export default function GymSpaceManagerClient() {
  const gymSpaces = useFirestoreCollection("gymSpaces");
  const [selectedGymSpaceId, setSelectedGymSpaceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<GymSpaceDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredGymSpaces = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sorted = [...gymSpaces.data].sort((a, b) =>
      `${a.facilityName} ${a.spaceName}`.localeCompare(`${b.facilityName} ${b.spaceName}`),
    );

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((gymSpace) =>
      [
        gymSpace.facilityName,
        gymSpace.spaceName,
        gymSpace.location,
        gymSpace.availableDays.join(" "),
        gymSpace.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [gymSpaces.data, searchTerm]);

  function resetForm() {
    setSelectedGymSpaceId(null);
    setDraft(emptyDraft);
  }

  function beginEdit(gymSpace: GymSpaceDocument) {
    setSelectedGymSpaceId(gymSpace.id);
    setDraft(mapGymSpaceToDraft(gymSpace));
    setStatus(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = {
        facilityName: draft.facilityName.trim(),
        courtCount: Number(draft.courtCount),
        location: draft.location.trim(),
        availableDays: draft.availableDays,
        startTime: formatStoredTime(draft.startHour, draft.startMinute, draft.startMeridiem),
        endTime: formatStoredTime(draft.endHour, draft.endMinute, draft.endMeridiem),
        blockedDates: draft.blockedDates.trim(),
        notes: draft.notes.trim(),
        active: draft.active,
      };

      if (!payload.facilityName || payload.availableDays.length === 0) {
        throw new Error("Facility name and available days are required.");
      }

      if (Number.isNaN(payload.courtCount) || payload.courtCount < 1) {
        throw new Error("Number of courts is required.");
      }

      if (!payload.startTime || !payload.endTime) {
        throw new Error("Start and end times are required.");
      }

      if (selectedGymSpaceId) {
        await firestoreApi.gymSpaces.update(selectedGymSpaceId, payload);
        setStatus("Gym space updated.");
      } else {
        await firestoreApi.gymSpaces.create(payload);
        setStatus("Gym space created.");
      }

      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save gym space.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(gymSpaceId: string) {
    const confirmed = window.confirm("Delete this gym space?");

    if (!confirmed) {
      return;
    }

    setStatus(null);
    setError(null);

    try {
      await firestoreApi.gymSpaces.remove(gymSpaceId);
      if (selectedGymSpaceId === gymSpaceId) {
        resetForm();
      }
      setStatus("Gym space deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete gym space.");
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Gym Space Manager"
        title="Manage Gym Spaces"
        description="Add facilities, courts, and standard weekly practice windows so scheduling has a clear list of available spaces."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title={selectedGymSpaceId ? "Edit Gym Space" : "Add Gym Space"}
          kicker="Space Details"
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Facility name <span className="text-[#b42318]">*</span>
              </span>
              <input
                value={draft.facilityName}
                onChange={(event) => setDraft((current) => ({ ...current, facilityName: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Example: North High School"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Number of courts <span className="text-[#b42318]">*</span>
              </span>
              <select
                value={draft.courtCount}
                onChange={(event) => setDraft((current) => ({ ...current, courtCount: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                {["1", "2", "3", "4", "5", "6"].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Location
              <input
                value={draft.location}
                onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Address or location note"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Available days <span className="text-[#b42318]">*</span>
              </span>
              <div className="grid gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-4 md:grid-cols-2">
                {daysOfWeek.map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-3 text-sm font-medium text-[color:var(--ink)]"
                  >
                    <input
                      type="checkbox"
                      checked={draft.availableDays.includes(day)}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          availableDays: event.target.checked
                            ? [...current.availableDays, day]
                            : current.availableDays.filter((entry) => entry !== day),
                        }))
                      }
                    />
                    <span>{day}</span>
                  </label>
                ))}
              </div>
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
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                End time <span className="text-[#b42318]">*</span>
              </span>
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={draft.endHour}
                  onChange={(event) => setDraft((current) => ({ ...current, endHour: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.endMinute}
                  onChange={(event) => setDraft((current) => ({ ...current, endMinute: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  {["00", "15", "30", "45"].map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.endMeridiem}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      endMeridiem: event.target.value as "AM" | "PM",
                    }))
                  }
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Blocked dates
              <textarea
                value={draft.blockedDates}
                onChange={(event) => setDraft((current) => ({ ...current, blockedDates: event.target.value }))}
                className="min-h-24 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="List blackout dates or date ranges, one per line."
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Notes
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Add court notes, entry details, or setup reminders."
              />
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              />
              Active gym space
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : selectedGymSpaceId ? "Save Changes" : "Add Gym Space"}
              </button>
              {selectedGymSpaceId && (
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

        <SectionCard title="Current Gym Spaces" kicker="Scheduling Records">
          <div className="mb-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Search gym spaces
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search by facility, space, location, or day"
              />
            </label>
          </div>
          <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
            {gymSpaces.loading && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Loading gym spaces...
              </div>
            )}
            {!gymSpaces.loading && filteredGymSpaces.length === 0 && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                No gym spaces match the current search.
              </div>
            )}
            {filteredGymSpaces.map((gymSpace) => (
              <div
                key={gymSpace.id}
                className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-[color:var(--ink)]">
                      {gymSpace.facilityName}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      Courts: {gymSpace.courtCount || 1}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      Days: {gymSpace.availableDays.length ? gymSpace.availableDays.join(", ") : "No days set"}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      Window: {formatDisplayTime(gymSpace.startTime)} to {formatDisplayTime(gymSpace.endTime)}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      Location: {gymSpace.location || "Location coming soon"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => beginEdit(gymSpace)}
                      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(gymSpace.id)}
                      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
