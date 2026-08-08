"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { where } from "firebase/firestore";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { formatEventStatus, getEventStatus, shouldShowEventStatus } from "@/lib/event-status";
import { getEventTeamLabel } from "@/lib/event-teams";
import {
  firestoreApi,
  getFriendlyFirebaseError,
  getRegistrationDocumentId,
  useFirestoreCollection,
  useFirestoreDocument,
} from "@/lib/firebase";
import { useAuthSession } from "@/lib/firebase/auth";
import { comparePlayersByName } from "@/lib/player-name";
import { isCurrentPlayer } from "@/lib/player-status";
import { validateTryoutRegistrationEligibility } from "@/lib/tryout-eligibility";
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
  height: string;
  position: string;
  secondaryPosition: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  phone: string;
  guardianPhone: string;
  guardianAddressDifferent: boolean;
  guardianAddressStreet: string;
  guardianAddressCity: string;
  guardianAddressState: string;
  guardianAddressZip: string;
  guardian2FirstName: string;
  guardian2LastName: string;
  guardian2Phone: string;
  guardian2Email: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  medicalConditions: string;
  medications: string;
  concussionDiagnosedPast24Months: string;
  concussionDiagnosisDate: string;
  allergies: string;
};

const emptyNewPlayerDraft: NewPlayerDraft = {
  firstName: "",
  lastName: "",
  birthDate: "",
  school: "",
  shirtSize: "",
  email: "",
  grade: "",
  height: "",
  position: "",
  secondaryPosition: "",
  guardianFirstName: "",
  guardianLastName: "",
  guardianEmail: "",
  phone: "",
  guardianPhone: "",
  guardianAddressDifferent: false,
  guardianAddressStreet: "",
  guardianAddressCity: "",
  guardianAddressState: "",
  guardianAddressZip: "",
  guardian2FirstName: "",
  guardian2LastName: "",
  guardian2Phone: "",
  guardian2Email: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  medicalConditions: "",
  medications: "",
  concussionDiagnosedPast24Months: "",
  concussionDiagnosisDate: "",
  allergies: "",
};

const requiredNewPlayerFields: { key: keyof NewPlayerDraft; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "birthDate", label: "Birthdate" },
  { key: "height", label: "Height" },
  { key: "position", label: "Primary position" },
  { key: "secondaryPosition", label: "Secondary position" },
  { key: "school", label: "School" },
  { key: "grade", label: "Grade" },
  { key: "shirtSize", label: "Shirt size" },
  { key: "email", label: "Player email" },
  { key: "phone", label: "Player phone number" },
  { key: "guardianFirstName", label: "Guardian first name" },
  { key: "guardianLastName", label: "Guardian last name" },
  { key: "guardianEmail", label: "Guardian email" },
  { key: "guardianPhone", label: "Guardian phone number" },
  { key: "guardian2FirstName", label: "Guardian 2 first name" },
  { key: "guardian2LastName", label: "Guardian 2 last name" },
  { key: "guardian2Phone", label: "Guardian 2 phone" },
  { key: "guardian2Email", label: "Guardian 2 email" },
  { key: "addressStreet", label: "Street address" },
  { key: "addressCity", label: "City" },
  { key: "addressState", label: "State" },
  { key: "addressZip", label: "ZIP" },
  { key: "emergencyContactName", label: "Emergency contact name" },
  { key: "emergencyContactRelationship", label: "Relationship to participant" },
  { key: "emergencyContactPhone", label: "Emergency contact primary phone" },
  { key: "concussionDiagnosedPast24Months", label: "Concussion diagnosed in past 24 months" },
  { key: "medicalConditions", label: "Medical conditions" },
  { key: "medications", label: "Medications" },
  { key: "allergies", label: "Allergies" },
];

function getMissingNewPlayerFields(draft: NewPlayerDraft) {
  const missingFields = requiredNewPlayerFields
    .filter((field) => !draftTrim(String(draft[field.key] ?? "")))
    .map((field) => field.label);

  if (draft.guardianAddressDifferent) {
    [
      { key: "guardianAddressStreet", label: "Guardian street address" },
      { key: "guardianAddressCity", label: "Guardian city" },
      { key: "guardianAddressState", label: "Guardian state" },
      { key: "guardianAddressZip", label: "Guardian ZIP" },
    ].forEach((field) => {
      if (!draftTrim(String(draft[field.key as keyof NewPlayerDraft] ?? ""))) {
        missingFields.push(field.label);
      }
    });
  }

  if (draft.concussionDiagnosedPast24Months === "yes" && !draftTrim(draft.concussionDiagnosisDate)) {
    missingFields.push("Concussion diagnosis date");
  }

  return missingFields;
}

const nextSteps = [
  "Choose the camp or tryout you want to attend.",
  "Sign in, then select a linked player or add a new athlete profile.",
  "Tryout players can sign up for multiple age-group tryouts. Submit each tryout separately, and the site will check birthdate eligibility.",
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

function formatAgeGroups(event: EventDocument) {
  const ageGroups = event.ageGroups?.length ? event.ageGroups : event.ageGroup ? [event.ageGroup] : [];

  return ageGroups.length > 0 ? ageGroups.join(", ") : "All ages";
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
  const signedInUserId = access.authUser?.firebaseUser.uid ?? "";
  const currentUser = useFirestoreDocument("users", signedInUserId, { enabled: Boolean(signedInUserId) });
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
  const selectedEventFullDetails = selectedEvent?.fullDetails?.trim() ?? "";
  const profileLinkedPlayerIds = useMemo(
    () => currentUser.data?.playerIds ?? access.authUser?.profile?.playerIds ?? [],
    [access.authUser?.profile?.playerIds, currentUser.data?.playerIds],
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

  const missingNewPlayerFields = useMemo(() => getMissingNewPlayerFields(newPlayer), [newPlayer]);

  const canSubmit =
    Boolean(selectedEvent) &&
    isRegistrationAvailable &&
    (registrationMode === "existing"
      ? Boolean(selectedExistingPlayer)
      : missingNewPlayerFields.length === 0);

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
          height: registrationMode === "new" ? draftTrim(newPlayer.height) : "",
          guardianFirstName: registrationMode === "new" ? draftTrim(newPlayer.guardianFirstName) : "",
          guardianLastName: registrationMode === "new" ? draftTrim(newPlayer.guardianLastName) : "",
          guardianEmail: registrationMode === "new" ? draftTrim(newPlayer.guardianEmail) : "",
          phone: registrationMode === "new" ? draftTrim(newPlayer.phone) : "",
          guardianPhone: registrationMode === "new" ? draftTrim(newPlayer.guardianPhone) : "",
          guardianAddressDifferent:
            registrationMode === "new" ? newPlayer.guardianAddressDifferent : false,
          guardianAddressStreet:
            registrationMode === "new" ? draftTrim(newPlayer.guardianAddressStreet) : "",
          guardianAddressCity:
            registrationMode === "new" ? draftTrim(newPlayer.guardianAddressCity) : "",
          guardianAddressState:
            registrationMode === "new" ? draftTrim(newPlayer.guardianAddressState) : "",
          guardianAddressZip:
            registrationMode === "new" ? draftTrim(newPlayer.guardianAddressZip) : "",
          guardian2FirstName: registrationMode === "new" ? draftTrim(newPlayer.guardian2FirstName) : "",
          guardian2LastName: registrationMode === "new" ? draftTrim(newPlayer.guardian2LastName) : "",
          guardian2Phone: registrationMode === "new" ? draftTrim(newPlayer.guardian2Phone) : "",
          guardian2Email: registrationMode === "new" ? draftTrim(newPlayer.guardian2Email) : "",
          addressStreet: registrationMode === "new" ? draftTrim(newPlayer.addressStreet) : "",
          addressCity: registrationMode === "new" ? draftTrim(newPlayer.addressCity) : "",
          addressState: registrationMode === "new" ? draftTrim(newPlayer.addressState) : "",
          addressZip: registrationMode === "new" ? draftTrim(newPlayer.addressZip) : "",
          emergencyContactName:
            registrationMode === "new" ? draftTrim(newPlayer.emergencyContactName) : "",
          emergencyContactRelationship:
            registrationMode === "new" ? draftTrim(newPlayer.emergencyContactRelationship) : "",
          emergencyContactPhone:
            registrationMode === "new" ? draftTrim(newPlayer.emergencyContactPhone) : "",
          medicalConditions: registrationMode === "new" ? draftTrim(newPlayer.medicalConditions) : "",
          medications: registrationMode === "new" ? draftTrim(newPlayer.medications) : "",
          concussionDiagnosedPast24Months:
            registrationMode === "new" ? draftTrim(newPlayer.concussionDiagnosedPast24Months) : "",
          concussionDiagnosisDate:
            registrationMode === "new" ? draftTrim(newPlayer.concussionDiagnosisDate) : "",
          allergies: registrationMode === "new" ? draftTrim(newPlayer.allergies) : "",
          secondaryPosition: registrationMode === "new" ? draftTrim(newPlayer.secondaryPosition) : "",
          registrationTimestamp: new Date().toISOString(),
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
      height: registrationPayload.height,
      guardianFirstName: registrationPayload.guardianFirstName,
      guardianLastName: registrationPayload.guardianLastName,
      guardianEmail: registrationPayload.guardianEmail,
      phone: registrationPayload.phone,
      guardianPhone: registrationPayload.guardianPhone,
      guardianAddressDifferent: registrationPayload.guardianAddressDifferent,
      guardianAddressStreet: registrationPayload.guardianAddressStreet,
      guardianAddressCity: registrationPayload.guardianAddressCity,
      guardianAddressState: registrationPayload.guardianAddressState,
      guardianAddressZip: registrationPayload.guardianAddressZip,
      guardian2FirstName: registrationPayload.guardian2FirstName,
      guardian2LastName: registrationPayload.guardian2LastName,
      guardian2Phone: registrationPayload.guardian2Phone,
      guardian2Email: registrationPayload.guardian2Email,
      addressStreet: registrationPayload.addressStreet,
      addressCity: registrationPayload.addressCity,
      addressState: registrationPayload.addressState,
      addressZip: registrationPayload.addressZip,
      emergencyContactName: registrationPayload.emergencyContactName,
      emergencyContactRelationship: registrationPayload.emergencyContactRelationship,
      emergencyContactPhone: registrationPayload.emergencyContactPhone,
      medicalConditions: registrationPayload.medicalConditions,
      medications: registrationPayload.medications,
      concussionDiagnosedPast24Months: registrationPayload.concussionDiagnosedPast24Months,
      concussionDiagnosisDate: registrationPayload.concussionDiagnosisDate,
      allergies: registrationPayload.allergies,
      registrationTimestamp: registrationPayload.registrationTimestamp,
      college: "",
      position: registrationPayload.position,
      secondaryPosition: registrationPayload.secondaryPosition,
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
    const existingRegistrationsForPlayer = await firestoreApi.registrations.list([
      where("playerId", "==", registeredPlayerId),
    ]);

    if (existingRegistrationsForPlayer.some((registration) => registration.eventId === selectedEvent.id)) {
      throw new Error("This player is already registered for this event.");
    }

    await firestoreApi.registrations.create({
      id: getRegistrationDocumentId(selectedEvent.id, registeredPlayerId),
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
      height: registrationPayload.height,
      guardianFirstName: registrationPayload.guardianFirstName,
      guardianLastName: registrationPayload.guardianLastName,
      guardianEmail: registrationPayload.guardianEmail,
      phone: registrationPayload.phone,
      guardianPhone: registrationPayload.guardianPhone,
      guardianAddressDifferent: registrationPayload.guardianAddressDifferent,
      guardianAddressStreet: registrationPayload.guardianAddressStreet,
      guardianAddressCity: registrationPayload.guardianAddressCity,
      guardianAddressState: registrationPayload.guardianAddressState,
      guardianAddressZip: registrationPayload.guardianAddressZip,
      guardian2FirstName: registrationPayload.guardian2FirstName,
      guardian2LastName: registrationPayload.guardian2LastName,
      guardian2Phone: registrationPayload.guardian2Phone,
      guardian2Email: registrationPayload.guardian2Email,
      addressStreet: registrationPayload.addressStreet,
      addressCity: registrationPayload.addressCity,
      addressState: registrationPayload.addressState,
      addressZip: registrationPayload.addressZip,
      emergencyContactName: registrationPayload.emergencyContactName,
      emergencyContactRelationship: registrationPayload.emergencyContactRelationship,
      emergencyContactPhone: registrationPayload.emergencyContactPhone,
      medicalConditions: registrationPayload.medicalConditions,
      medications: registrationPayload.medications,
      concussionDiagnosedPast24Months: registrationPayload.concussionDiagnosedPast24Months,
      concussionDiagnosisDate: registrationPayload.concussionDiagnosisDate,
      allergies: registrationPayload.allergies,
      secondaryPosition: registrationPayload.secondaryPosition,
      registrationTimestamp: registrationPayload.registrationTimestamp,
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

    if (registrationMode === "new" && missingNewPlayerFields.length > 0) {
      setError(`Complete required fields: ${missingNewPlayerFields.join(", ")}.`);
      return;
    }

    const tryoutEligibility = validateTryoutRegistrationEligibility(selectedEvent, athlete.birthDate);

    if (!tryoutEligibility.eligible) {
      setError(tryoutEligibility.message);
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
                      <p>Age group: {formatAgeGroups(event)}</p>
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
                className="mt-4 inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[#ffc469]"
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
                {selectedEventFullDetails && (
                  <div className="mt-5 rounded-3xl border border-[color:var(--line)] bg-white p-5">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Full Details
                    </p>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[color:var(--muted)]">
                      {selectedEventFullDetails}
                    </p>
                  </div>
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
                    Choose a player already linked in your portal.
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
                      <span>
                        Height <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.height)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, height: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                        placeholder={'5\'8"'}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Primary position <span className="text-[#b42318]">*</span>
                      </span>
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
                      <span>
                        Secondary position <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.secondaryPosition)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, secondaryPosition: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        School <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.school)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, school: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Grade <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.grade)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, grade: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Shirt size <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.shirtSize)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, shirtSize: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Player email <span className="text-[#b42318]">*</span>
                      </span>
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
                      <span>
                        Player phone number <span className="text-[#b42318]">*</span>
                      </span>
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
                      <span>
                        Guardian email <span className="text-[#b42318]">*</span>
                      </span>
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
                      <span>
                        Guardian phone number <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.guardianPhone)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardianPhone: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm font-semibold text-[color:var(--ink)]">
                      <input
                        type="checkbox"
                        checked={newPlayer.guardianAddressDifferent}
                        onChange={(event) =>
                          setNewPlayer((current) => ({
                            ...current,
                            guardianAddressDifferent: event.target.checked,
                          }))
                        }
                      />
                      Guardian address is different than the player&apos;s address
                    </label>
                    {newPlayer.guardianAddressDifferent && (
                      <>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                          <span>
                            Guardian street address <span className="text-[#b42318]">*</span>
                          </span>
                          <input
                            value={draftText(newPlayer.guardianAddressStreet)}
                            onChange={(event) =>
                              setNewPlayer((current) => ({
                                ...current,
                                guardianAddressStreet: event.target.value,
                              }))
                            }
                            className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                          <span>
                            Guardian city <span className="text-[#b42318]">*</span>
                          </span>
                          <input
                            value={draftText(newPlayer.guardianAddressCity)}
                            onChange={(event) =>
                              setNewPlayer((current) => ({
                                ...current,
                                guardianAddressCity: event.target.value,
                              }))
                            }
                            className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                          <span>
                            Guardian state <span className="text-[#b42318]">*</span>
                          </span>
                          <input
                            value={draftText(newPlayer.guardianAddressState)}
                            onChange={(event) =>
                              setNewPlayer((current) => ({
                                ...current,
                                guardianAddressState: event.target.value,
                              }))
                            }
                            className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                          <span>
                            Guardian ZIP <span className="text-[#b42318]">*</span>
                          </span>
                          <input
                            value={draftText(newPlayer.guardianAddressZip)}
                            onChange={(event) =>
                              setNewPlayer((current) => ({
                                ...current,
                                guardianAddressZip: event.target.value,
                              }))
                            }
                            className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                          />
                        </label>
                      </>
                    )}
                    <p className="md:col-span-2 mt-2 border-t border-[color:var(--line)] pt-4 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Guardian 2
                    </p>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Guardian 2 first name <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.guardian2FirstName)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardian2FirstName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Guardian 2 last name <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.guardian2LastName)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardian2LastName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Guardian 2 phone <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.guardian2Phone)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardian2Phone: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Guardian 2 email <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        type="email"
                        value={draftText(newPlayer.guardian2Email)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, guardian2Email: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <p className="md:col-span-2 mt-2 border-t border-[color:var(--line)] pt-4 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Player address
                    </p>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Street address <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.addressStreet)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, addressStreet: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        City <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.addressCity)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, addressCity: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        State <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.addressState)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, addressState: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        ZIP <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.addressZip)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, addressZip: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <p className="md:col-span-2 mt-2 border-t border-[color:var(--line)] pt-4 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Emergency Contact / Medical Information
                    </p>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Emergency contact name <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.emergencyContactName)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, emergencyContactName: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Relationship to participant <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.emergencyContactRelationship)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({
                            ...current,
                            emergencyContactRelationship: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Emergency contact primary phone <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={draftText(newPlayer.emergencyContactPhone)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, emergencyContactPhone: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Concussion diagnosed in past 24 months? <span className="text-[#b42318]">*</span>
                      </span>
                      <select
                        value={draftText(newPlayer.concussionDiagnosedPast24Months)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({
                            ...current,
                            concussionDiagnosedPast24Months: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      >
                        <option value="">Select one</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                    {newPlayer.concussionDiagnosedPast24Months === "yes" && (
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                        <span>
                          Concussion diagnosis date (month/year) <span className="text-[#b42318]">*</span>
                        </span>
                        <input
                          value={draftText(newPlayer.concussionDiagnosisDate)}
                          onChange={(event) =>
                            setNewPlayer((current) => ({
                              ...current,
                              concussionDiagnosisDate: event.target.value,
                            }))
                          }
                          className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                          placeholder="MM/YYYY"
                        />
                      </label>
                    )}
                    <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Medical conditions we should be aware of <span className="text-[#b42318]">*</span>
                      </span>
                      <textarea
                        value={draftText(newPlayer.medicalConditions)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, medicalConditions: event.target.value }))
                        }
                        className="min-h-24 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Medications <span className="text-[#b42318]">*</span>
                      </span>
                      <textarea
                        value={draftText(newPlayer.medications)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, medications: event.target.value }))
                        }
                        className="min-h-24 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Allergies <span className="text-[#b42318]">*</span>
                      </span>
                      <textarea
                        value={draftText(newPlayer.allergies)}
                        onChange={(event) =>
                          setNewPlayer((current) => ({ ...current, allergies: event.target.value }))
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
