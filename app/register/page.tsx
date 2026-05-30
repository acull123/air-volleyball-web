"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { formatEventStatus, getEventStatus, shouldShowEventStatus } from "@/lib/event-status";
import { getEventTeamLabel } from "@/lib/event-teams";
import { firestoreApi, getFriendlyFirebaseError, useFirestoreCollection } from "@/lib/firebase";
import { useAuthSession } from "@/lib/firebase/auth";
import { comparePlayersByName } from "@/lib/player-name";
import { isCurrentPlayer } from "@/lib/player-status";
import type { EventDocument } from "@/lib/firebase/schema";

type RegistrationMode = "existing" | "new";

type NewPlayerDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  school: string;
  shirtSize: string;
  email: string;
  grade: string;
  position: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  phone: string;
  guardianPhone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  medications: string;
};

const emptyNewPlayerDraft: NewPlayerDraft = {
  firstName: "",
  lastName: "",
  birthDate: "",
  school: "",
  shirtSize: "",
  email: "",
  grade: "",
  position: "",
  guardianFirstName: "",
  guardianLastName: "",
  guardianEmail: "",
  phone: "",
  guardianPhone: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  medications: "",
};

const nextSteps = [
  "Choose the camp or tryout you want to attend.",
  "Sign in, then select a linked player or add a new athlete profile.",
  "If an event has a fee, staff will mark the registration paid after offline payment.",
];

const registerInteractiveCardClass =
  "group w-full cursor-pointer rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5 text-left transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]";

const registerSelectedCardClass =
  "group w-full cursor-pointer rounded-[1.5rem] border border-transparent bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)] px-5 py-5 text-left shadow-[0_12px_30px_rgba(17,58,98,0.12)] transition";

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

function draftText(value: string | undefined) {
  return value ?? "";
}

function draftTrim(value: string | undefined) {
  return draftText(value).trim();
}

function RegisterPageContent() {
  const access = useAuthSession();
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("event") ?? "";
  const events = useFirestoreCollection("events");
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("existing");
  const [existingPlayerId, setExistingPlayerId] = useState("");
  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [newPlayer, setNewPlayer] = useState<NewPlayerDraft>(emptyNewPlayerDraft);
  const [linkedPlayerIdsOverride, setLinkedPlayerIdsOverride] = useState<string[] | null>(null);
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
      : registerableEvents.some((event) => event.id === initialEventId)
        ? initialEventId
      : registerableEvents[0]?.id ?? "";

  const selectedEvent =
    registerableEvents.find((event) => event.id === effectiveSelectedEventId) ?? null;
  const profileLinkedPlayerIds = useMemo(
    () => access.authUser?.profile?.playerIds ?? [],
    [access.authUser?.profile?.playerIds],
  );
  const linkedPlayerIds = useMemo(
    () => linkedPlayerIdsOverride ?? profileLinkedPlayerIds,
    [linkedPlayerIdsOverride, profileLinkedPlayerIds],
  );
  const isRegistrationAvailable = Boolean(access.authUser?.firebaseUser.uid);

  const visiblePlayers = useMemo(() => {
    const normalizedSearch = playerSearchTerm.trim().toLowerCase();
    const linkedPlayerIdSet = new Set(linkedPlayerIds);
    const sorted = [...players.data]
      .filter(isCurrentPlayer)
      .filter((player) => linkedPlayerIdSet.has(player.id))
      .sort(comparePlayersByName);

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
  }, [linkedPlayerIds, playerSearchTerm, players.data, teams.data]);

  const selectedExistingPlayer =
    players.data.find(
      (player) => isCurrentPlayer(player) && linkedPlayerIds.includes(player.id) && player.id === existingPlayerId,
    ) ?? null;

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
          isCurrentPlayer(player) &&
          normalizeValue(player.firstName) === firstName &&
          normalizeValue(player.lastName) === lastName &&
          player.birthDate === birthDate,
      ) ?? null
    );
  }, [newPlayer.birthDate, newPlayer.firstName, newPlayer.lastName, players.data, registrationMode]);

  const canSubmit =
    Boolean(selectedEvent) &&
    isRegistrationAvailable &&
    (registrationMode === "existing"
      ? Boolean(selectedExistingPlayer)
      : Boolean(
          draftTrim(newPlayer.firstName) &&
            draftTrim(newPlayer.lastName) &&
            newPlayer.birthDate &&
            draftTrim(newPlayer.guardianFirstName) &&
            draftTrim(newPlayer.guardianLastName),
        ));

  const submitLabel = selectedEvent ? "Register" : "Choose An Event";

  const registrationPayload =
    selectedEvent &&
    (registrationMode === "existing"
      ? selectedExistingPlayer
      : draftTrim(newPlayer.firstName) && draftTrim(newPlayer.lastName) && newPlayer.birthDate)
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
              : draftTrim(newPlayer.firstName),
          athleteLastName:
            registrationMode === "existing"
              ? selectedExistingPlayer?.lastName ?? ""
              : draftTrim(newPlayer.lastName),
          birthDate:
            registrationMode === "existing"
              ? selectedExistingPlayer?.birthDate ?? ""
              : newPlayer.birthDate,
          position:
            registrationMode === "existing"
              ? selectedExistingPlayer?.position ?? ""
              : draftTrim(newPlayer.position),
          parentName:
            registrationMode === "new"
              ? `${draftTrim(newPlayer.guardianFirstName)} ${draftTrim(newPlayer.guardianLastName)}`.trim()
              : "",
          school: registrationMode === "new" ? draftTrim(newPlayer.school) : "",
          shirtSize: registrationMode === "new" ? draftTrim(newPlayer.shirtSize) : "",
          email: registrationMode === "new" ? draftTrim(newPlayer.email) : "",
          grade: registrationMode === "new" ? draftTrim(newPlayer.grade) : "",
          guardianFirstName: registrationMode === "new" ? draftTrim(newPlayer.guardianFirstName) : "",
          guardianLastName: registrationMode === "new" ? draftTrim(newPlayer.guardianLastName) : "",
          guardianEmail: registrationMode === "new" ? draftTrim(newPlayer.guardianEmail) : "",
          phone: registrationMode === "new" ? draftTrim(newPlayer.phone) : "",
          guardianPhone: registrationMode === "new" ? draftTrim(newPlayer.guardianPhone) : "",
          addressStreet: registrationMode === "new" ? draftTrim(newPlayer.addressStreet) : "",
          addressCity: registrationMode === "new" ? draftTrim(newPlayer.addressCity) : "",
          addressState: registrationMode === "new" ? draftTrim(newPlayer.addressState) : "",
          addressZip: registrationMode === "new" ? draftTrim(newPlayer.addressZip) : "",
          medications: registrationMode === "new" ? draftTrim(newPlayer.medications) : "",
        }
      : null;

  async function linkPlayerToCurrentAccount(playerId: string) {
    const uid = access.authUser?.firebaseUser.uid;

    if (!uid || !playerId || linkedPlayerIds.includes(playerId)) {
      return;
    }

    const nextPlayerIds = Array.from(new Set([...linkedPlayerIds, playerId]));

    await firestoreApi.users.update(uid, {
      playerIds: nextPlayerIds,
    });
    setLinkedPlayerIdsOverride(nextPlayerIds);
  }

  async function ensureNewRegistrationPlayerId() {
    if (!registrationPayload || registrationMode !== "new") {
      return registrationPayload?.playerId ?? "";
    }

    if (registrationPayload.playerId) {
      await linkPlayerToCurrentAccount(registrationPayload.playerId);
      return registrationPayload.playerId;
    }

    const playerId = await firestoreApi.players.create({
      firstName: registrationPayload.athleteFirstName,
      lastName: registrationPayload.athleteLastName,
      birthDate: registrationPayload.birthDate,
      school: registrationPayload.school,
      shirtSize: registrationPayload.shirtSize,
      email: registrationPayload.email,
      grade: registrationPayload.grade,
      guardianFirstName: registrationPayload.guardianFirstName,
      guardianLastName: registrationPayload.guardianLastName,
      guardianEmail: registrationPayload.guardianEmail,
      phone: registrationPayload.phone,
      guardianPhone: registrationPayload.guardianPhone,
      addressStreet: registrationPayload.addressStreet,
      addressCity: registrationPayload.addressCity,
      addressState: registrationPayload.addressState,
      addressZip: registrationPayload.addressZip,
      medications: registrationPayload.medications,
      college: "",
      position: registrationPayload.position,
      jerseyNumber: 0,
      teamId: "",
      bio: "",
      photoUrl: "",
      active: true,
      isAlumni: false,
    });

    await linkPlayerToCurrentAccount(playerId);
    return playerId;
  }

  async function submitRegistration() {
    if (!selectedEvent || !registrationPayload) {
      throw new Error("Registration details are incomplete.");
    }

    const registeredPlayerId =
      registrationMode === "new" ? await ensureNewRegistrationPlayerId() : registrationPayload.playerId;

    await firestoreApi.registrations.create({
      eventId: selectedEvent.id,
      eventTitle: selectedEvent.title,
      eventType: selectedEvent.type,
      eventPrice: selectedEvent.price ?? 0,
      playerId: registeredPlayerId,
      isNewPlayer: registrationPayload.isNewPlayer,
      athleteFirstName: registrationPayload.athleteFirstName,
      athleteLastName: registrationPayload.athleteLastName,
      birthDate: registrationPayload.birthDate,
      position: registrationPayload.position,
      parentName: registrationPayload.parentName,
      school: registrationPayload.school,
      shirtSize: registrationPayload.shirtSize,
      email: registrationPayload.email,
      grade: registrationPayload.grade,
      guardianFirstName: registrationPayload.guardianFirstName,
      guardianLastName: registrationPayload.guardianLastName,
      guardianEmail: registrationPayload.guardianEmail,
      phone: registrationPayload.phone,
      guardianPhone: registrationPayload.guardianPhone,
      addressStreet: registrationPayload.addressStreet,
      addressCity: registrationPayload.addressCity,
      addressState: registrationPayload.addressState,
      addressZip: registrationPayload.addressZip,
      medications: registrationPayload.medications,
      paymentProvider: "",
      paymentOrderId: "",
      paymentCaptureId: "",
      status: "submitted",
      paymentStatus: (selectedEvent.price ?? 0) > 0 ? "unpaid" : "paid",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEvent) {
      setError("Choose an event before continuing.");
      return;
    }

    if (!access.authUser?.firebaseUser.uid) {
      setError("Sign in before registering for an event.");
      return;
    }

    const athlete =
      registrationMode === "existing"
        ? selectedExistingPlayer
        : {
            firstName: draftTrim(newPlayer.firstName),
            lastName: draftTrim(newPlayer.lastName),
            birthDate: newPlayer.birthDate,
            position: draftTrim(newPlayer.position),
          };

    if (!athlete || !athlete.firstName || !athlete.lastName || !athlete.birthDate) {
      setError("Choose a player or complete the new player details.");
      return;
    }

    if (
      registrationMode === "new" &&
      (!draftTrim(newPlayer.guardianFirstName) || !draftTrim(newPlayer.guardianLastName))
    ) {
      setError("Guardian first and last name are required for new players.");
      return;
    }

    setStatus(null);
    setError(null);

    setSubmitting(true);

    try {
      await submitRegistration();
      setStatus(
        (selectedEvent.price ?? 0) > 0
          ? "Registration submitted. Payment status is unpaid until staff marks it paid."
          : "Registration submitted.",
      );
      setExistingPlayerId("");
      setNewPlayer(emptyNewPlayerDraft);
      setPlayerSearchTerm("");
      setRegistrationMode("existing");
    } catch (submitError) {
      setError(
        getFriendlyFirebaseError(submitError, "Unable to submit registration."),
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
        description="Choose a current camp or tryout and connect it to a player. Paid events are tracked for offline payment."
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
                const teamName = getEventTeamLabel(event, teams.data);
                const eventStatus = getEventStatus(event);
                const isSelected = event.id === effectiveSelectedEventId;

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setError(null);
                    }}
                    className={isSelected ? registerSelectedCardClass : registerInteractiveCardClass}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-bold uppercase tracking-[0.18em] ${isSelected ? "text-[#d7e5f2]" : "text-[color:var(--muted)] group-hover:text-[#d7e5f2]"}`}>
                          {event.type === "camp" ? "Camp" : "Tryout"}
                        </p>
                        <h3 className={`mt-2 text-2xl font-bold ${isSelected ? "text-white" : "text-[color:var(--ink)] group-hover:text-white"}`}>
                          {event.title}
                        </h3>
                      </div>
                      <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${isSelected ? "border-white/30 text-white" : "border-[color:var(--line)] text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white"}`}>
                        {formatMoney(event.price ?? 0)}
                      </span>
                    </div>
                    <div className={`mt-4 space-y-2 text-sm ${isSelected ? "text-[#d7e5f2]" : "text-[color:var(--muted)] group-hover:text-[#d7e5f2]"}`}>
                      <p>{formatEventDateRange(event.startDate, event.endDate)}</p>
                      <p>{formatEventTime(event.startTime)}</p>
                      <p>{event.location}</p>
                      <p>Audience: {teamName}</p>
                      <p>Age group: {event.ageGroup || "All ages"}</p>
                      {shouldShowEventStatus(eventStatus) && <p>Status: {formatEventStatus(eventStatus)}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Registration Form" kicker="Player Details">
          {selectedEvent ? access.loading ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Checking account access...
            </div>
          ) : !isRegistrationAvailable ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center">
              <p className="text-sm text-[color:var(--muted)]">
                Sign in before registering for this event.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-flex rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66]"
              >
                Sign In Or Create Account
              </Link>
            </div>
          ) : (
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
                    This event has a fee. Staff will mark the registration paid after offline payment.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationMode("existing");
                    setError(null);
                  }}
                  className={registrationMode === "existing" ? registerSelectedCardClass : registerInteractiveCardClass}
                >
                  <p className={`text-sm font-bold uppercase tracking-[0.18em] ${registrationMode === "existing" ? "text-[#d7e5f2]" : "text-[color:var(--muted)] group-hover:text-[#d7e5f2]"}`}>
                    Existing Player
                  </p>
                  <p className={`mt-2 text-sm leading-7 ${registrationMode === "existing" ? "text-[#d7e5f2]" : "text-[color:var(--muted)] group-hover:text-[#d7e5f2]"}`}>
                    Choose a player already linked in your player portal.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationMode("new");
                    setError(null);
                  }}
                  className={registrationMode === "new" ? registerSelectedCardClass : registerInteractiveCardClass}
                >
                  <p className={`text-sm font-bold uppercase tracking-[0.18em] ${registrationMode === "new" ? "text-[#d7e5f2]" : "text-[color:var(--muted)] group-hover:text-[#d7e5f2]"}`}>
                    New Player
                  </p>
                  <p className={`mt-2 text-sm leading-7 ${registrationMode === "new" ? "text-[#d7e5f2]" : "text-[color:var(--muted)] group-hover:text-[#d7e5f2]"}`}>
                    Add a player who is not in the roster yet.
                  </p>
                </button>
              </div>

              {registrationMode === "existing" ? (
                <div className="space-y-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    Search linked players
                    <input
                      value={playerSearchTerm}
                      onChange={(event) => setPlayerSearchTerm(event.target.value)}
                      className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      placeholder="Search linked players by name, team, or position"
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
                        {linkedPlayerIds.length === 0
                          ? "No players are linked to your account yet. Add a new player instead."
                          : "No linked players match the current search."}
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
                            className={isSelected ? registerSelectedCardClass : registerInteractiveCardClass}
                          >
                            <p className={`text-lg font-bold ${isSelected ? "text-white" : "text-[color:var(--ink)] group-hover:text-white"}`}>
                              {player.firstName} {player.lastName}
                            </p>
                            <div className={`mt-2 space-y-1 text-sm ${isSelected ? "text-[#d7e5f2]" : "text-[color:var(--muted)] group-hover:text-[#d7e5f2]"}`}>
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
                    <p className="md:col-span-2 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Player information
                    </p>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        First name <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.firstName)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, firstName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Last name <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.lastName)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, lastName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Birthdate <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.birthDate)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, birthDate: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                        type="date"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Position
                      <input
                        value={draftText(newPlayer.position)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, position: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                        placeholder="Outside, setter, libero..."
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      School
                      <input
                        value={draftText(newPlayer.school)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, school: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Grade
                      <input
                        value={draftText(newPlayer.grade)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, grade: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Shirt size
                      <input
                        value={draftText(newPlayer.shirtSize)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, shirtSize: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Player email
                      <input
                        type="email"
                        value={draftText(newPlayer.email)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, email: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Player phone number
                      <input
                        value={draftText(newPlayer.phone)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, phone: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <p className="md:col-span-2 mt-2 border-t border-[color:var(--line)] pt-4 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Guardian information
                    </p>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Guardian first name <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.guardianFirstName)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardianFirstName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Guardian last name <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.guardianLastName)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardianLastName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Guardian email
                      <input
                        type="email"
                        value={draftText(newPlayer.guardianEmail)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardianEmail: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Guardian phone number
                      <input
                        value={draftText(newPlayer.guardianPhone)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardianPhone: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <p className="md:col-span-2 mt-2 border-t border-[color:var(--line)] pt-4 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Address and medical
                    </p>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Street address
                      <input
                        value={draftText(newPlayer.addressStreet)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, addressStreet: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      City
                      <input
                        value={draftText(newPlayer.addressCity)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, addressCity: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      State
                      <input
                        value={draftText(newPlayer.addressState)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, addressState: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      ZIP
                      <input
                        value={draftText(newPlayer.addressZip)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, addressZip: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Medications
                      <textarea
                        value={draftText(newPlayer.medications)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, medications: event.target.value }))
                        }
                        className="min-h-24 rounded-2xl border border-[color:var(--line)] px-4 py-3"
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

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
