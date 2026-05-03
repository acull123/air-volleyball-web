"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

function formatEventDateRange(startDate: string, endDate: string) {
  if (!startDate) {
    return "Date coming soon";
  }

  const start = new Date(startDate);
  const end = new Date(endDate || startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startDate, endDate].filter(Boolean).join(" to ");
  }

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  if ((endDate || startDate) === startDate) {
    return start.toLocaleDateString(undefined, options);
  }

  return `${start.toLocaleDateString(undefined, options)} to ${end.toLocaleDateString(undefined, options)}`;
}

export default function RegistrationManagerClient() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("event") ?? "";
  const events = useFirestoreCollection("events");
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const registrations = useFirestoreCollection("registrations");
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [parentName, setParentName] = useState("");
  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registerableEvents = useMemo(
    () =>
      [...events.data]
        .filter((event) => event.active !== false)
        .filter((event) => event.type === "camp" || event.type === "tryout")
        .sort((left, right) =>
          `${left.startDate} ${left.startTime}`.localeCompare(`${right.startDate} ${right.startTime}`),
        ),
    [events.data],
  );

  const effectiveSelectedEventId =
    selectedEventId && registerableEvents.some((event) => event.id === selectedEventId)
      ? selectedEventId
      : registerableEvents.some((event) => event.id === initialEventId)
        ? initialEventId
        : registerableEvents[0]?.id ?? "";

  const selectedEvent =
    registerableEvents.find((event) => event.id === effectiveSelectedEventId) ?? null;

  const eventRegistrations = useMemo(
    () =>
      registrations.data
        .filter((registration) => registration.eventId === selectedEvent?.id)
        .sort((left, right) =>
          `${left.athleteLastName} ${left.athleteFirstName}`.localeCompare(
            `${right.athleteLastName} ${right.athleteFirstName}`,
          ),
        ),
    [registrations.data, selectedEvent?.id],
  );

  const availablePlayers = useMemo(() => {
    const normalizedSearch = playerSearchTerm.trim().toLowerCase();
    const registeredPlayerIds = new Set(
      eventRegistrations.map((registration) => registration.playerId).filter(Boolean),
    );

    return [...players.data]
      .filter((player) => player.active !== false)
      .filter((player) => !registeredPlayerIds.has(player.id))
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`),
      )
      .filter((player) => {
        if (!normalizedSearch) {
          return true;
        }

        const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "";

        return [player.firstName, player.lastName, player.position, teamName]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });
  }, [eventRegistrations, playerSearchTerm, players.data, teams.data]);

  const selectedPlayer =
    players.data.find((player) => player.id === selectedPlayerId) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      if (!selectedEvent) {
        throw new Error("Choose an event first.");
      }

      if (!selectedPlayer) {
        throw new Error("Choose a player to register.");
      }

      if (
        registrations.data.some(
          (registration) =>
            registration.eventId === selectedEvent.id && registration.playerId === selectedPlayer.id,
        )
      ) {
        throw new Error("That player is already registered for this event.");
      }

      await firestoreApi.registrations.create({
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        eventType: selectedEvent.type,
        eventPrice: selectedEvent.price ?? 0,
        playerId: selectedPlayer.id,
        isNewPlayer: false,
        athleteFirstName: selectedPlayer.firstName,
        athleteLastName: selectedPlayer.lastName,
        birthDate: selectedPlayer.birthDate,
        position: selectedPlayer.position,
        parentName: parentName.trim() || "Staff registration",
        paymentProvider: "",
        paymentOrderId: "",
        paymentCaptureId: "",
        status: "confirmed",
        paymentStatus: (selectedEvent.price ?? 0) > 0 ? "unpaid" : "paid",
      });

      setStatus("Player registered.");
      setSelectedPlayerId("");
      setParentName("");
      setPlayerSearchTerm("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save registration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Registration Manager"
        title="Manage Registrations"
        description="Choose a camp or tryout, review who is already registered, and add players directly from the roster."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Event Registration" kicker="Choose Event">
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Event
              <select
                value={effectiveSelectedEventId}
                onChange={(event) => {
                  setSelectedEventId(event.target.value);
                  setSelectedPlayerId("");
                  setPlayerSearchTerm("");
                  setStatus(null);
                  setError(null);
                }}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                {registerableEvents.length === 0 ? (
                  <option value="">No camp or tryout events available</option>
                ) : (
                  registerableEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))
                )}
              </select>
            </label>

            {selectedEvent ? (
              <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
                <h3 className="text-xl font-bold text-[color:var(--ink)]">{selectedEvent.title}</h3>
                <div className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                  <p>Type: {selectedEvent.type === "camp" ? "Camp" : "Tryout"}</p>
                  <p>Date: {formatEventDateRange(selectedEvent.startDate, selectedEvent.endDate)}</p>
                  <p>Location: {selectedEvent.location}</p>
                  <p>Fee: {formatMoney(selectedEvent.price ?? 0)}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Choose an event to manage registrations.
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-[color:var(--ink)]">
                Current registrations
              </p>
              <div className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto pr-2">
                {registrations.loading ? (
                  <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    Loading registrations...
                  </div>
                ) : registrations.error ? (
                  <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    Registrations are unavailable right now.
                  </div>
                ) : eventRegistrations.length === 0 ? (
                  <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    No players are registered yet.
                  </div>
                ) : (
                  eventRegistrations.map((registration) => (
                    <div
                      key={registration.id}
                      className="rounded-[1.25rem] border border-[color:var(--line)] bg-white px-4 py-4"
                    >
                      <p className="font-semibold text-[color:var(--ink)]">
                        {registration.athleteFirstName} {registration.athleteLastName}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {registration.status} · {registration.paymentStatus}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Add Registration" kicker="Choose Player">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Parent name (optional)
              <input
                value={parentName}
                onChange={(event) => setParentName(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Leave blank to use staff registration"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Search players
              <input
                value={playerSearchTerm}
                onChange={(event) => setPlayerSearchTerm(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search by player name, team, or position"
              />
            </label>

            <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-2">
              {players.loading || teams.loading ? (
                <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                  Loading players...
                </div>
              ) : availablePlayers.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                  No available players match the current search.
                </div>
              ) : (
                availablePlayers.map((player) => {
                  const teamName =
                    teams.data.find((team) => team.id === player.teamId)?.name ?? "No team assigned";
                  const isSelected = player.id === selectedPlayerId;

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition ${
                        isSelected
                          ? "border-[color:var(--ink)] bg-[color:var(--paper)]"
                          : "border-[color:var(--line)] bg-white hover:bg-[color:var(--paper)]"
                      }`}
                    >
                      <p className="text-lg font-bold text-[color:var(--ink)]">
                        {player.firstName} {player.lastName}
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                        <p>Team: {teamName}</p>
                        <p>Position: {player.position || "Position coming soon"}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!selectedEvent || !selectedPlayer || saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Register Player"}
              </button>
              {selectedPlayer && (
                <span className="text-sm text-[color:var(--muted)]">
                  Selected: {selectedPlayer.firstName} {selectedPlayer.lastName}
                </span>
              )}
            </div>

            {status && (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--ink)]">
                {status}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                {error}
              </div>
            )}
          </form>
        </SectionCard>
      </div>
    </>
  );
}
