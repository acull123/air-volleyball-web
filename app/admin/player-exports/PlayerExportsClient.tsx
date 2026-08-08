"use client";

import { useMemo, useState } from "react";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { useFirestoreCollection } from "@/lib/firebase";
import { comparePlayersByName } from "@/lib/player-name";
import { formatTournamentEventLabel, isTournamentEventType } from "@/lib/tournament-events";
import type { EventDocument, FirestoreDate, PlayerDocument, RegistrationDocument } from "@/lib/firebase/schema";

type ExportRecord = {
  event: EventDocument;
  registration: RegistrationDocument;
  player: PlayerDocument | null;
};

const registerableEventTypes = new Set(["camp", "tryout"]);

const exportColumns = [
  "Event",
  "Event Type",
  "Event Date",
  "Event Location",
  "Payment Status",
  "Registration Status",
  "Registration Timestamp",
  "First Name",
  "Last Name",
  "Grade",
  "Current School",
  "Birthdate",
  "Height",
  "Address",
  "City",
  "State",
  "Zip",
  "Player Cell Phone",
  "Player Email",
  "Primary Position",
  "Secondary Position",
  "Shirt Size",
  "Guardian First Name",
  "Guardian Last Name",
  "Guardian Phone Number",
  "Guardian Email",
  "Guardian Address Different",
  "Guardian Address",
  "Guardian City",
  "Guardian State",
  "Guardian Zip",
  "Guardian 2 First Name",
  "Guardian 2 Last Name",
  "Guardian 2 Phone",
  "Guardian 2 Email",
  "Emergency Contact Name",
  "Relationship To Participant",
  "Emergency Contact Primary Phone",
  "Medical Conditions",
  "Medications",
  "Concussion Diagnosed In Past 24 Months",
  "Concussion Diagnosis Date",
  "Allergies",
] as const;

function formatEventType(type: EventDocument["type"]) {
  if (isTournamentEventType(type)) {
    return "Tournament";
  }

  if (type === "tryout") {
    return "Tryout";
  }

  if (type === "camp") {
    return "Camp";
  }

  return type;
}

function formatExportEventType(event: EventDocument) {
  return isTournamentEventType(event.type) ? formatTournamentEventLabel(event) : formatEventType(event.type);
}

function formatDate(value: string) {
  if (!value) {
    return "";
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

function formatFirestoreDate(value: FirestoreDate | string | undefined) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toDate().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEventDate(event: EventDocument) {
  if (!event.startDate) {
    return "";
  }

  if (!event.endDate || event.endDate === event.startDate) {
    return formatDate(event.startDate);
  }

  return `${formatDate(event.startDate)} to ${formatDate(event.endDate)}`;
}

function valueOrBlank(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function getPlayerValue(
  player: PlayerDocument | null,
  registration: RegistrationDocument,
  key: keyof PlayerDocument | keyof RegistrationDocument,
) {
  const playerValue = player && key in player ? player[key as keyof PlayerDocument] : undefined;
  const registrationValue = key in registration ? registration[key as keyof RegistrationDocument] : undefined;

  return valueOrBlank(playerValue ?? registrationValue);
}

function getPlayerName(player: PlayerDocument | null, registration: RegistrationDocument) {
  return `${player?.firstName ?? registration.athleteFirstName} ${player?.lastName ?? registration.athleteLastName}`.trim();
}

function csvCell(value: unknown) {
  const text = valueOrBlank(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function buildExportRow(record: ExportRecord) {
  const { event, player, registration } = record;

  return [
    event.title,
    formatExportEventType(event),
    formatEventDate(event),
    event.location,
    registration.paymentStatus,
    registration.status,
    formatFirestoreDate(registration.createdAt) || getPlayerValue(player, registration, "registrationTimestamp"),
    player?.firstName ?? registration.athleteFirstName,
    player?.lastName ?? registration.athleteLastName,
    getPlayerValue(player, registration, "grade"),
    getPlayerValue(player, registration, "school"),
    player?.birthDate ?? registration.birthDate,
    getPlayerValue(player, registration, "height"),
    getPlayerValue(player, registration, "addressStreet"),
    getPlayerValue(player, registration, "addressCity"),
    getPlayerValue(player, registration, "addressState"),
    getPlayerValue(player, registration, "addressZip"),
    getPlayerValue(player, registration, "phone"),
    getPlayerValue(player, registration, "email"),
    getPlayerValue(player, registration, "position"),
    getPlayerValue(player, registration, "secondaryPosition"),
    getPlayerValue(player, registration, "shirtSize"),
    getPlayerValue(player, registration, "guardianFirstName"),
    getPlayerValue(player, registration, "guardianLastName"),
    getPlayerValue(player, registration, "guardianPhone"),
    getPlayerValue(player, registration, "guardianEmail"),
    getPlayerValue(player, registration, "guardianAddressDifferent"),
    getPlayerValue(player, registration, "guardianAddressStreet"),
    getPlayerValue(player, registration, "guardianAddressCity"),
    getPlayerValue(player, registration, "guardianAddressState"),
    getPlayerValue(player, registration, "guardianAddressZip"),
    getPlayerValue(player, registration, "guardian2FirstName"),
    getPlayerValue(player, registration, "guardian2LastName"),
    getPlayerValue(player, registration, "guardian2Phone"),
    getPlayerValue(player, registration, "guardian2Email"),
    getPlayerValue(player, registration, "emergencyContactName"),
    getPlayerValue(player, registration, "emergencyContactRelationship"),
    getPlayerValue(player, registration, "emergencyContactPhone"),
    getPlayerValue(player, registration, "medicalConditions"),
    getPlayerValue(player, registration, "medications"),
    getPlayerValue(player, registration, "concussionDiagnosedPast24Months"),
    getPlayerValue(player, registration, "concussionDiagnosisDate"),
    getPlayerValue(player, registration, "allergies"),
  ];
}

function downloadCsv(records: ExportRecord[]) {
  const rows = [
    exportColumns,
    ...records.map(buildExportRow),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `air-volleyball-player-export-${dateStamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function PlayerExportsClient() {
  const events = useFirestoreCollection("events");
  const registrations = useFirestoreCollection("registrations");
  const players = useFirestoreCollection("players");
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);

  const eligibleEvents = useMemo(
    () =>
      [...events.data]
        .filter((event) => event.active !== false)
        .filter((event) => registerableEventTypes.has(event.type))
        .sort((left, right) =>
          `${left.startDate} ${left.startTime} ${left.title}`.localeCompare(
            `${right.startDate} ${right.startTime} ${right.title}`,
          ),
        ),
    [events.data],
  );

  const selectedEventIdSet = useMemo(() => new Set(selectedEventIds), [selectedEventIds]);

  const exportRecords = useMemo(() => {
    const playerMap = new Map(players.data.map((player) => [player.id, player]));

    return eligibleEvents
      .filter((event) => selectedEventIdSet.has(event.id))
      .flatMap((event) =>
        registrations.data
          .filter((registration) => registration.eventId === event.id)
          .map((registration) => ({
            event,
            registration,
            player: playerMap.get(registration.playerId) ?? null,
          })),
      )
      .sort((left, right) => {
        const eventCompare = `${left.event.startDate} ${left.event.title}`.localeCompare(
          `${right.event.startDate} ${right.event.title}`,
        );

        if (eventCompare !== 0) {
          return eventCompare;
        }

        if (left.player && right.player) {
          return comparePlayersByName(left.player, right.player);
        }

        return getPlayerName(left.player, left.registration).localeCompare(
          getPlayerName(right.player, right.registration),
        );
      });
  }, [eligibleEvents, players.data, registrations.data, selectedEventIdSet]);

  const selectedEventSummaries = useMemo(
    () =>
      eligibleEvents
        .filter((event) => selectedEventIdSet.has(event.id))
        .map((event) => ({
          event,
          count: registrations.data.filter((registration) => registration.eventId === event.id).length,
        })),
    [eligibleEvents, registrations.data, selectedEventIdSet],
  );

  const allEligibleSelected =
    eligibleEvents.length > 0 && selectedEventIds.length === eligibleEvents.length;

  function toggleEvent(eventId: string) {
    setSelectedEventIds((current) =>
      current.includes(eventId)
        ? current.filter((selectedEventId) => selectedEventId !== eventId)
        : [...current, eventId],
    );
  }

  function toggleAllEvents() {
    setSelectedEventIds(allEligibleSelected ? [] : eligibleEvents.map((event) => event.id));
  }

  return (
    <>
      <PageHero
        eyebrow="Player Exports"
        title="Player Registration Exports"
        description="Select one or more camp or tryout events and download a spreadsheet-ready player registration export."
        actions={[
          { href: "/admin/dashboard", label: "Admin Dashboard" },
          { href: "/admin/registrations", label: "Registration Manager", variant: "secondary" },
        ]}
      />

      <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="Events" kicker="Select Player Lists">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleAllEvents}
              disabled={eligibleEvents.length === 0}
              className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {allEligibleSelected ? "Clear All Events" : "Select All Events"}
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(exportRecords)}
              disabled={exportRecords.length === 0}
              className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Download Spreadsheet
            </button>
          </div>

          <div className="space-y-3">
            {events.loading ? (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Loading eligible events...
              </div>
            ) : events.error ? (
              <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                Event records are unavailable right now.
              </div>
            ) : eligibleEvents.length === 0 ? (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                No active camps or tryouts are available for export.
              </div>
            ) : (
              eligibleEvents.map((event) => {
                const registrationCount = registrations.data.filter(
                  (registration) => registration.eventId === event.id,
                ).length;

                return (
                  <label
                    key={event.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-[color:var(--line)] bg-white px-4 py-4"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEventIds.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-base font-bold text-[color:var(--ink)]">
                        {event.title}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-[color:var(--muted)]">
                        {formatExportEventType(event)} · {formatEventDate(event)} · {registrationCount}{" "}
                        registered
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </SectionCard>

        <SectionCard title="Export Summary" kicker="Spreadsheet">
          {registrations.loading || players.loading ? (
            <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
              Loading player registration data...
            </div>
          ) : registrations.error || players.error ? (
            <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
              Player registration data is unavailable right now.
            </div>
          ) : selectedEventSummaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Select one or more events to prepare the spreadsheet export.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  Export Ready
                </p>
                <p className="mt-2 text-3xl font-bold text-[color:var(--ink)]">
                  {exportRecords.length} player rows
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                  The spreadsheet includes only event and player registration data. It does not include website
                  headers, navigation, footer content, photos, internal IDs, or other site display data.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-[color:var(--paper)] text-[color:var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 font-bold">Event</th>
                      <th className="px-4 py-3 font-bold">Type</th>
                      <th className="px-4 py-3 font-bold">Date</th>
                      <th className="px-4 py-3 font-bold">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEventSummaries.map(({ event, count }) => (
                      <tr key={event.id} className="border-b border-[color:var(--line)]">
                        <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">{event.title}</td>
                        <td className="px-4 py-3 text-[color:var(--muted)]">{formatExportEventType(event)}</td>
                        <td className="px-4 py-3 text-[color:var(--muted)]">{formatEventDate(event)}</td>
                        <td className="px-4 py-3 text-[color:var(--muted)]">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
