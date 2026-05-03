"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import PayPalCheckout from "./PayPalCheckout";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import type { EventDocument } from "@/lib/firebase/schema";

type RegistrationMode = "existing" | "new";

type NewPlayerDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  position: string;
};

const emptyNewPlayerDraft: NewPlayerDraft = {
  firstName: "",
  lastName: "",
  birthDate: "",
  position: "",
};

const nextSteps = [
  "Choose the camp or tryout you want to attend.",
  "Select a current player or add a new athlete profile for this registration.",
  "Complete payment right away when a payment link is ready for that event.",
];

function isRegisterableEvent(
  event: EventDocument,
): event is EventDocument & { type: "camp" | "tryout" } {
  return event.type === "camp" || event.type === "tryout";
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

function formatEventTime(time: string) {
  if (!time) {
    return "Time coming soon";
  }

  const [hourRaw = "0", minuteRaw = "00"] = time.split(":");
  const hourValue = Number(hourRaw);

  if (Number.isNaN(hourValue)) {
    return time;
  }

  const meridiem = hourValue >= 12 ? "PM" : "AM";
  const hour12 = hourValue % 12 || 12;

  return `${hour12}:${minuteRaw} ${meridiem}`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

function formatBirthDate(value: string) {
  if (!value) {
    return "Birthdate needed";
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

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

export default function RegisterPage() {
  const payPalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
  const events = useFirestoreCollection("events");
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("existing");
  const [existingPlayerId, setExistingPlayerId] = useState("");
  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [newPlayer, setNewPlayer] = useState<NewPlayerDraft>(emptyNewPlayerDraft);
  const [parentName, setParentName] = useState("");
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registerableEvents = useMemo(
    () =>
      [...events.data]
        .filter((event) => event.active !== false)
        .filter(isRegisterableEvent)
        .sort((left, right) =>
          `${left.startDate} ${left.startTime}`.localeCompare(`${right.startDate} ${right.startTime}`),
        ),
    [events.data],
  );

  const effectiveSelectedEventId =
    selectedEventId && registerableEvents.some((event) => event.id === selectedEventId)
      ? selectedEventId
      : registerableEvents[0]?.id ?? "";

  const selectedEvent =
    registerableEvents.find((event) => event.id === effectiveSelectedEventId) ?? null;

  const visiblePlayers = useMemo(() => {
    const normalizedSearch = playerSearchTerm.trim().toLowerCase();
    const sorted = [...players.data]
      .filter((player) => player.active !== false)
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`),
      );

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((player) => {
      const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "";
      return [player.firstName, player.lastName, player.position, teamName]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [playerSearchTerm, players.data, teams.data]);

  const selectedExistingPlayer =
    players.data.find((player) => player.id === existingPlayerId) ?? null;

  const matchedExistingPlayerForNewRegistration = useMemo(() => {
    if (registrationMode !== "new") {
      return null;
    }

    const firstName = normalizeValue(newPlayer.firstName);
    const lastName = normalizeValue(newPlayer.lastName);
    const birthDate = newPlayer.birthDate;

    if (!firstName || !lastName || !birthDate) {
      return null;
    }

    return (
      players.data.find(
        (player) =>
          player.active !== false &&
          normalizeValue(player.firstName) === firstName &&
          normalizeValue(player.lastName) === lastName &&
          player.birthDate === birthDate,
      ) ?? null
    );
  }, [newPlayer.birthDate, newPlayer.firstName, newPlayer.lastName, players.data, registrationMode]);

  const canSubmit =
    Boolean(selectedEvent) &&
    parentName.trim().length > 0 &&
    (registrationMode === "existing"
      ? Boolean(selectedExistingPlayer)
      : Boolean(newPlayer.firstName.trim() && newPlayer.lastName.trim() && newPlayer.birthDate));

  const requiresPayment = Boolean(selectedEvent && (selectedEvent.price ?? 0) > 0);
  const submitLabel = selectedEvent
    ? requiresPayment
      ? "Register And Pay"
      : "Register"
    : "Choose An Event";

  const registrationPayload =
    selectedEvent &&
    parentName.trim() &&
    (registrationMode === "existing"
      ? selectedExistingPlayer
      : newPlayer.firstName.trim() && newPlayer.lastName.trim() && newPlayer.birthDate)
      ? {
          eventId: selectedEvent.id,
          playerId:
            registrationMode === "existing"
              ? selectedExistingPlayer?.id ?? ""
              : matchedExistingPlayerForNewRegistration?.id ?? "",
          isNewPlayer: registrationMode === "new",
          athleteFirstName:
            registrationMode === "existing"
              ? selectedExistingPlayer?.firstName ?? ""
              : newPlayer.firstName.trim(),
          athleteLastName:
            registrationMode === "existing"
              ? selectedExistingPlayer?.lastName ?? ""
              : newPlayer.lastName.trim(),
          birthDate:
            registrationMode === "existing"
              ? selectedExistingPlayer?.birthDate ?? ""
              : newPlayer.birthDate,
          position:
            registrationMode === "existing"
              ? selectedExistingPlayer?.position ?? ""
              : newPlayer.position.trim(),
          parentName: parentName.trim(),
        }
      : null;

  async function submitFreeRegistration() {
    if (!selectedEvent || !registrationPayload) {
      throw new Error("Registration details are incomplete.");
    }

    await firestoreApi.registrations.create({
      eventId: selectedEvent.id,
      eventTitle: selectedEvent.title,
      eventType: selectedEvent.type,
      eventPrice: selectedEvent.price ?? 0,
      playerId: registrationPayload.playerId,
      isNewPlayer: registrationPayload.isNewPlayer,
      athleteFirstName: registrationPayload.athleteFirstName,
      athleteLastName: registrationPayload.athleteLastName,
      birthDate: registrationPayload.birthDate,
      position: registrationPayload.position,
      parentName: registrationPayload.parentName,
      paymentProvider: "",
      paymentOrderId: "",
      paymentCaptureId: "",
      status: "submitted",
      paymentStatus: "paid",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEvent) {
      setError("Choose an event before continuing.");
      return;
    }

    if (!parentName.trim()) {
      setError("Parent name is required.");
      return;
    }

    const athlete =
      registrationMode === "existing"
        ? selectedExistingPlayer
        : {
            firstName: newPlayer.firstName.trim(),
            lastName: newPlayer.lastName.trim(),
            birthDate: newPlayer.birthDate,
            position: newPlayer.position.trim(),
          };

    if (!athlete || !athlete.firstName || !athlete.lastName || !athlete.birthDate) {
      setError("Choose a player or complete the new player details.");
      return;
    }

    setStatus(null);
    setError(null);

    if ((selectedEvent.price ?? 0) > 0) {
      if (!payPalClientId) {
        setError("Payment is not set up yet for this site.");
        return;
      }

      setShowPaymentStep(true);
      return;
    }

    setSubmitting(true);

    try {
      await submitFreeRegistration();
      setStatus("Registration submitted.");
      setExistingPlayerId("");
      setNewPlayer(emptyNewPlayerDraft);
      setParentName("");
      setPlayerSearchTerm("");
      setShowPaymentStep(false);
      setRegistrationMode("existing");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to submit registration.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Registration"
        title="Camp And Tryout Registration"
        description="Choose a current camp or tryout, connect it to a player, and move straight into payment when that event is ready to collect it."
        actions={[
          { href: "/training", label: "View Training" },
          { href: "/teams", label: "Explore Teams", variant: "secondary" },
        ]}
      />

      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Open Registration Events" kicker="Choose An Event">
          {events.loading ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Loading current events...
            </div>
          ) : events.error ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Registration events are unavailable right now.
            </div>
          ) : registerableEvents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              No camps or tryouts are open yet.
            </div>
          ) : (
            <div className="space-y-4">
              {registerableEvents.map((event) => {
                const teamName =
                  teams.data.find((team) => team.id === event.teamId)?.name ?? "All players";
                const isSelected = event.id === effectiveSelectedEventId;

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setShowPaymentStep(false);
                      setError(null);
                    }}
                    className={`w-full rounded-[1.5rem] border px-5 py-5 text-left transition ${
                      isSelected
                        ? "border-[color:var(--ink)] bg-[color:var(--paper)]"
                        : "border-[color:var(--line)] bg-white hover:bg-[color:var(--paper)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          {event.type === "camp" ? "Camp" : "Tryout"}
                        </p>
                        <h3 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                          {event.title}
                        </h3>
                      </div>
                      <span className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
                        {formatMoney(event.price ?? 0)}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                      <p>{formatEventDateRange(event.startDate, event.endDate)}</p>
                      <p>{formatEventTime(event.startTime)}</p>
                      <p>{event.location}</p>
                      <p>Audience: {teamName}</p>
                      <p>Age group: {event.ageGroup || "All ages"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Registration Form" kicker="Player Details">
          {selectedEvent ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  Selected Event
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                  {selectedEvent.title}
                </h3>
                <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)] sm:grid-cols-2">
                  <p>Date: {formatEventDateRange(selectedEvent.startDate, selectedEvent.endDate)}</p>
                  <p>Time: {formatEventTime(selectedEvent.startTime)}</p>
                  <p>Location: {selectedEvent.location}</p>
                  <p>Fee: {formatMoney(selectedEvent.price ?? 0)}</p>
                </div>
                {(selectedEvent.price ?? 0) > 0 && (
                  <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
                    Payment will be collected during registration for this event.
                  </p>
                )}
              </div>

              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Parent name
                <input
                  value={parentName}
                  onChange={(event) => setParentName(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="Parent or guardian name"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationMode("existing");
                    setShowPaymentStep(false);
                    setError(null);
                  }}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    registrationMode === "existing"
                      ? "border-[color:var(--ink)] bg-[color:var(--paper)]"
                      : "border-[color:var(--line)] bg-white hover:bg-[color:var(--paper)]"
                  }`}
                >
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Existing Player
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                    Choose a player already in the club records.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationMode("new");
                    setShowPaymentStep(false);
                    setError(null);
                  }}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    registrationMode === "new"
                      ? "border-[color:var(--ink)] bg-[color:var(--paper)]"
                      : "border-[color:var(--line)] bg-white hover:bg-[color:var(--paper)]"
                  }`}
                >
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    New Player
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                    Add a player who is not in the roster yet.
                  </p>
                </button>
              </div>

              {registrationMode === "existing" ? (
                <div className="space-y-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    Search players
                    <input
                      value={playerSearchTerm}
                      onChange={(event) => setPlayerSearchTerm(event.target.value)}
                      className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      placeholder="Search by player name, team, or position"
                    />
                  </label>
                  <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-2">
                    {players.loading || teams.loading ? (
                      <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                        Loading players...
                      </div>
                    ) : players.error || teams.error ? (
                      <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                        Player records are unavailable right now.
                      </div>
                    ) : visiblePlayers.length === 0 ? (
                      <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                        No players match the current search.
                      </div>
                    ) : (
                      visiblePlayers.map((player) => {
                        const teamName =
                          teams.data.find((team) => team.id === player.teamId)?.name ?? "No team assigned";
                        const isSelected = existingPlayerId === player.id;

                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => setExistingPlayerId(player.id)}
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
                              <p>Birthdate: {formatBirthDate(player.birthDate)}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      First name
                      <input
                        value={newPlayer.firstName}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, firstName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Last name
                      <input
                        value={newPlayer.lastName}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, lastName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Birthdate
                      <input
                        value={newPlayer.birthDate}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, birthDate: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                        type="date"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Position (optional)
                      <input
                        value={newPlayer.position}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, position: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                        placeholder="Outside, setter, libero..."
                      />
                    </label>
                  </div>
                  {matchedExistingPlayerForNewRegistration && (
                    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
                      This athlete matches an existing player record and will be linked to that profile automatically.
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : submitLabel}
                </button>
                {selectedEvent?.price ? (
                  <span className="text-sm text-[color:var(--muted)]">
                    Event fee: {formatMoney(selectedEvent.price)}
                  </span>
                ) : (
                  <span className="text-sm text-[color:var(--muted)]">No event fee</span>
                )}
              </div>

              {showPaymentStep && registrationPayload && requiresPayment && payPalClientId && (
                <PayPalCheckout
                  clientId={payPalClientId}
                  eventId={selectedEvent.id}
                  registration={registrationPayload}
                  onSuccess={() => {
                    setStatus("Registration and payment completed.");
                    setError(null);
                    setExistingPlayerId("");
                    setNewPlayer(emptyNewPlayerDraft);
                    setParentName("");
                    setPlayerSearchTerm("");
                    setShowPaymentStep(false);
                    setRegistrationMode("existing");
                  }}
                  onError={(message) => {
                    setError(message);
                  }}
                />
              )}

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
          ) : (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Choose an event from the left to begin registration.
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="How Registration Works" kicker="Simple Flow">
        <div className="grid gap-4 md:grid-cols-3">
          {nextSteps.map((step) => (
            <div
              key={step}
              className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5 text-sm leading-7 text-[color:var(--muted)]"
            >
              {step}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/training"
            className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
          >
            View Training
          </Link>
          <Link
            href="/teams"
            className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
          >
            Explore Teams
          </Link>
        </div>
      </SectionCard>
    </>
  );
}
