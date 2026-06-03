"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { where } from "firebase/firestore";
import PageHero from "../components/PageHero";
import ScheduleTable from "../components/ScheduleTable";
import SectionCard from "../components/SectionCard";
import { getEventStatus } from "@/lib/event-status";
import { getEventTeamIds } from "@/lib/event-teams";
import { createPortalAccount, sendPasswordReset, signInUser, useAuthSession } from "@/lib/firebase/auth";
import { firestoreApi, useFirestoreCollection, getFriendlyFirebaseError } from "@/lib/firebase";
import { compareAthletesByName, comparePlayersByName } from "@/lib/player-name";
import { isCurrentPlayer } from "@/lib/player-status";
import type { ConflictDocument, InvoiceDocument, RegistrationDocument } from "@/lib/firebase/schema";
import type { Event } from "../types/models";

type PortalMode = "signin" | "create" | "reset";
type AccountRole = "parent" | "player" | "unverifiedCoach";

const portalHighlights = [
  "Link one or more players to your account when you create it.",
  "Register your linked players for camps, tryouts, and other open events.",
  "See season events tied to your players and their teams.",
  "Use the same account later for balances, schedules, and club updates.",
];

const portalStaticCardClass =
  "rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(17,58,98,0.04)]";

const portalInteractiveCardClass =
  "group rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(17,58,98,0.04)] transition cursor-pointer hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]";

const portalSelectedCardClass =
  "group rounded-[1.5rem] border border-transparent bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)] px-5 py-5 shadow-[0_12px_30px_rgba(17,58,98,0.12)] transition cursor-pointer";

function formatEventType(type: string): Event["eventType"] {
  if (type === "tryout") {
    return "tryouts";
  }

  if (type === "areaCamp") {
    return "camp";
  }

  if (type === "twoDayTournament") {
    return "tournament";
  }

  if (type === "camp" || type === "practice" || type === "tournament") {
    return type;
  }

  return "practice";
}

function toDateLabel(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return "Due date coming soon";
}

function toAmountLabel(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

function toDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0",
  )}`;
}

function isCurrentOrFutureEvent(event: { startDate: string; endDate?: string }) {
  const todayKey = toDateKey(new Date());
  const eventEndDate = event.endDate || event.startDate;

  return !eventEndDate || eventEndDate >= todayKey;
}

function formatConflictDateTime(value: string) {
  if (!value) {
    return "Date coming soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function useRegistrationsByPlayerIds(playerIds: string[]) {
  const [state, setState] = useState<{
    key: string | null;
    data: RegistrationDocument[];
    error: string | null;
  }>({
    key: null,
    data: [],
    error: null,
  });

  const normalizedPlayerIds = useMemo(
    () => Array.from(new Set(playerIds.filter(Boolean))).sort(),
    [playerIds],
  );
  const subscriptionKey = normalizedPlayerIds.join("|");

  useEffect(() => {
    if (normalizedPlayerIds.length === 0) {
      return;
    }

    let cancelled = false;
    const registrationMap = new Map<string, RegistrationDocument>();

    const unsubscribers = normalizedPlayerIds.map((playerId) =>
      firestoreApi.registrations.subscribe(
        (items) => {
          if (cancelled) {
            return;
          }

          for (const [registrationId, registration] of registrationMap.entries()) {
            if (registration.playerId === playerId) {
              registrationMap.delete(registrationId);
            }
          }

          items.forEach((item) => {
            registrationMap.set(item.id, item);
          });

          setState({
            key: subscriptionKey,
            data: [...registrationMap.values()].sort(compareAthletesByName),
            error: null,
          });
        },
        [where("playerId", "==", playerId)],
        (error) => {
          if (cancelled) {
            return;
          }

          setState({
            key: subscriptionKey,
            data: [],
            error: getFriendlyFirebaseError(error, "Unable to load registrations right now."),
          });
        },
      ),
    );

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [normalizedPlayerIds, subscriptionKey]);

  if (normalizedPlayerIds.length === 0) {
    return {
      data: [],
      loading: false,
      error: null,
    };
  }

  return {
    data: state.key === subscriptionKey ? state.data : [],
    loading: state.key !== subscriptionKey && state.error === null,
    error: state.key === subscriptionKey ? state.error : null,
  };
}

function useConflictsByPlayerIds(playerIds: string[]) {
  const [state, setState] = useState<{
    key: string | null;
    data: ConflictDocument[];
    error: string | null;
  }>({
    key: null,
    data: [],
    error: null,
  });

  const normalizedPlayerIds = useMemo(
    () => Array.from(new Set(playerIds.filter(Boolean))).sort(),
    [playerIds],
  );
  const subscriptionKey = normalizedPlayerIds.join("|");

  useEffect(() => {
    if (normalizedPlayerIds.length === 0) {
      return;
    }

    let cancelled = false;
    const conflictMap = new Map<string, ConflictDocument>();

    const unsubscribers = normalizedPlayerIds.map((playerId) =>
      firestoreApi.conflicts.subscribe(
        (items) => {
          if (cancelled) {
            return;
          }

          for (const [conflictId, conflict] of conflictMap.entries()) {
            if (conflict.playerId === playerId) {
              conflictMap.delete(conflictId);
            }
          }

          items.forEach((item) => {
            conflictMap.set(item.id, item);
          });

          setState({
            key: subscriptionKey,
            data: [...conflictMap.values()].sort((left, right) =>
              `${left.startAt}`.localeCompare(`${right.startAt}`),
            ),
            error: null,
          });
        },
        [where("playerId", "==", playerId)],
        (error) => {
          if (cancelled) {
            return;
          }

          setState({
            key: subscriptionKey,
            data: [],
            error: getFriendlyFirebaseError(error, "Unable to load conflicts right now."),
          });
        },
      ),
    );

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [normalizedPlayerIds, subscriptionKey]);

  if (normalizedPlayerIds.length === 0) {
    return {
      data: [],
      loading: false,
      error: null,
    };
  }

  return {
    data: state.key === subscriptionKey ? state.data : [],
    loading: state.key !== subscriptionKey && state.error === null,
    error: state.key === subscriptionKey ? state.error : null,
  };
}

function useInvoicesByPlayerIds(playerIds: string[]) {
  const [state, setState] = useState<{
    key: string | null;
    data: InvoiceDocument[];
    error: string | null;
  }>({
    key: null,
    data: [],
    error: null,
  });

  const normalizedPlayerIds = useMemo(
    () => Array.from(new Set(playerIds.filter(Boolean))).sort(),
    [playerIds],
  );
  const subscriptionKey = normalizedPlayerIds.join("|");

  useEffect(() => {
    if (normalizedPlayerIds.length === 0) {
      return;
    }

    let cancelled = false;
    const invoiceMap = new Map<string, InvoiceDocument>();

    const unsubscribers = normalizedPlayerIds.map((playerId) =>
      firestoreApi.invoices.subscribe(
        (items) => {
          if (cancelled) {
            return;
          }

          for (const [invoiceId, invoice] of invoiceMap.entries()) {
            if (invoice.playerId === playerId) {
              invoiceMap.delete(invoiceId);
            }
          }

          items.forEach((item) => {
            invoiceMap.set(item.id, item);
          });

          setState({
            key: subscriptionKey,
            data: [...invoiceMap.values()].sort((left, right) =>
              `${left.teamId} ${left.title}`.localeCompare(`${right.teamId} ${right.title}`),
            ),
            error: null,
          });
        },
        [where("playerId", "==", playerId)],
        (error) => {
          if (cancelled) {
            return;
          }

          setState({
            key: subscriptionKey,
            data: [],
            error: getFriendlyFirebaseError(error, "Unable to load payment status right now."),
          });
        },
      ),
    );

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [normalizedPlayerIds, subscriptionKey]);

  if (normalizedPlayerIds.length === 0) {
    return {
      data: [],
      loading: false,
      error: null,
    };
  }

  return {
    data: state.key === subscriptionKey ? state.data : [],
    loading: state.key !== subscriptionKey && state.error === null,
    error: state.key === subscriptionKey ? state.error : null,
  };
}

export default function LoginPage() {
  const access = useAuthSession();
  const [linkedPlayerIdsOverride, setLinkedPlayerIdsOverride] = useState<{
    userId: string;
    playerIds: string[];
  } | null>(null);
  const authUserId = access.authUser?.firebaseUser.uid ?? "";
  const profileLinkedPlayerIds = useMemo(
    () => access.authUser?.profile?.playerIds ?? [],
    [access.authUser?.profile?.playerIds],
  );
  const linkedPlayerIds =
    linkedPlayerIdsOverride?.userId === authUserId ? linkedPlayerIdsOverride.playerIds : profileLinkedPlayerIds;
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const events = useFirestoreCollection("events");
  const registrations = useRegistrationsByPlayerIds(linkedPlayerIds);
  const invoices = useInvoicesByPlayerIds(linkedPlayerIds);
  const conflicts = useConflictsByPlayerIds(linkedPlayerIds);

  const [mode, setMode] = useState<PortalMode>("signin");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createRole, setCreateRole] = useState<AccountRole>("parent");
  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [conflictPlayerId, setConflictPlayerId] = useState("");
  const [conflictStartAt, setConflictStartAt] = useState(() => {
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    defaultStart.setMinutes(0, 0, 0);
    return toDateTimeInputValue(defaultStart);
  });
  const [conflictEndAt, setConflictEndAt] = useState(() => {
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    defaultStart.setMinutes(0, 0, 0);
    return toDateTimeInputValue(new Date(defaultStart.getTime() + 60 * 60 * 1000));
  });
  const [conflictReason, setConflictReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [submittingConflict, setSubmittingConflict] = useState(false);
  const [savingLinkedPlayers, setSavingLinkedPlayers] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkedPlayerStatus, setLinkedPlayerStatus] = useState<string | null>(null);
  const [linkedPlayerError, setLinkedPlayerError] = useState<string | null>(null);
  const [conflictStatus, setConflictStatus] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = playerSearchTerm.trim().toLowerCase();

    return [...players.data]
      .filter(isCurrentPlayer)
      .sort(comparePlayersByName)
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
  }, [playerSearchTerm, players.data, teams.data]);

  const linkedPlayers = useMemo(
    () =>
      players.data
        .filter((player) => isCurrentPlayer(player) && linkedPlayerIds.includes(player.id))
        .sort(comparePlayersByName),
    [linkedPlayerIds, players.data],
  );
  const linkedTeamIds = Array.from(new Set(linkedPlayers.map((player) => player.teamId).filter(Boolean)));
  const linkedTeams = teams.data.filter((team) => linkedTeamIds.includes(team.id));
  const effectiveConflictPlayerId =
    linkedPlayers.some((player) => player.id === conflictPlayerId)
      ? conflictPlayerId
      : linkedPlayers[0]?.id ?? "";
  const visibleConflicts = useMemo(
    () =>
      [...conflicts.data]
        .sort((left, right) => `${left.startAt}`.localeCompare(`${right.startAt}`)),
    [conflicts.data],
  );
  const scheduleEvents = useMemo<Event[]>(
    () =>
      [...events.data]
        .filter((event) => event.active !== false)
        .filter(isCurrentOrFutureEvent)
        .filter((event) => event.type !== "areaCamp")
        .filter((event) => {
          if (event.type === "camp" || event.type === "tryout") {
            return registrations.data.some(
              (registration) =>
                registration.eventId === event.id && linkedPlayerIds.includes(registration.playerId),
            );
          }

          const eventTeamIds = getEventTeamIds(event);
          return eventTeamIds.length === 0 || eventTeamIds.some((teamId) => linkedTeamIds.includes(teamId));
        })
        .sort((left, right) =>
          `${left.startDate} ${left.startTime}`.localeCompare(`${right.startDate} ${right.startTime}`),
        )
        .map((event) => {
          const eventTeamIds = getEventTeamIds(event);
          const scheduleTeamId = eventTeamIds.find((teamId) => linkedTeamIds.includes(teamId)) ?? eventTeamIds[0] ?? "";
          const registeredPlayer = registrations.data
            .filter((registration) => registration.eventId === event.id)
            .map((registration) => linkedPlayers.find((player) => player.id === registration.playerId) ?? null)
            .find((player) => player !== null);
          const displayedTeamId = scheduleTeamId || registeredPlayer?.teamId || "";
          const displayedTeamName = displayedTeamId
            ? teams.data.find((team) => team.id === displayedTeamId)?.name ?? "Team"
            : "";

          return {
            id: event.id,
            eventName: event.title,
            eventType: formatEventType(event.type),
            description: event.notes,
            startsAt: `${event.startDate}T${event.startTime || "00:00"}`,
            endsAt: `${event.endDate || event.startDate}T${event.endTime || event.startTime || "00:00"}`,
            teamIds: eventTeamIds,
            coachIds: [],
            playerIds: [],
            location: event.location,
            teamName: displayedTeamName,
            status: getEventStatus(event),
          };
        }),
    [events.data, linkedPlayerIds, linkedPlayers, linkedTeamIds, registrations.data, teams.data],
  );
  const eventPaymentRegistrations = useMemo(
    () =>
      registrations.data
        .filter((registration) => (registration.eventPrice ?? 0) > 0)
        .sort((left, right) => left.eventTitle.localeCompare(right.eventTitle)),
    [registrations.data],
  );
  const teamPaymentInvoices = useMemo(
    () =>
      invoices.data
        .filter((invoice) => invoice.teamId && linkedPlayerIds.includes(invoice.playerId))
        .sort((left, right) => {
          const leftTeam = teams.data.find((team) => team.id === left.teamId)?.name ?? left.title;
          const rightTeam = teams.data.find((team) => team.id === right.teamId)?.name ?? right.title;
          return leftTeam.localeCompare(rightTeam);
        }),
    [invoices.data, linkedPlayerIds, teams.data],
  );

  function getLinkedPlayerName(playerId: string, fallback: string) {
    const player = linkedPlayers.find((entry) => entry.id === playerId);
    return player ? `${player.firstName} ${player.lastName}` : fallback;
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => {
      if (createRole === "player") {
        return current[0] === playerId ? [] : [playerId];
      }

      return current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId];
    });
  }

  async function updateLinkedPlayerIds(nextPlayerIds: string[]) {
    if (!access.authUser?.firebaseUser.uid) {
      setLinkedPlayerError("You must be signed in to update linked players.");
      return;
    }

    const normalizedPlayerIds = Array.from(new Set(nextPlayerIds.filter(Boolean)));

    if (access.authUser.profile?.role === "player" && normalizedPlayerIds.length !== 1) {
      setLinkedPlayerError("Player accounts must stay linked to exactly one player.");
      return;
    }

    setSavingLinkedPlayers(true);
    setLinkedPlayerStatus(null);
    setLinkedPlayerError(null);

    try {
      await firestoreApi.users.update(access.authUser.firebaseUser.uid, {
        playerIds: normalizedPlayerIds,
      });
      setLinkedPlayerIdsOverride({
        userId: access.authUser.firebaseUser.uid,
        playerIds: normalizedPlayerIds,
      });
      setLinkedPlayerStatus("Linked players updated.");

      if (conflictPlayerId && !normalizedPlayerIds.includes(conflictPlayerId)) {
        setConflictPlayerId("");
      }
    } catch (submitError) {
      setLinkedPlayerError(
        getFriendlyFirebaseError(submitError, "Unable to update linked players."),
      );
    } finally {
      setSavingLinkedPlayers(false);
    }
  }

  function addLinkedPlayer(playerId: string) {
    const nextPlayerIds =
      access.authUser?.profile?.role === "player" ? [playerId] : [...linkedPlayerIds, playerId];

    void updateLinkedPlayerIds(nextPlayerIds);
  }

  function removeLinkedPlayer(playerId: string) {
    void updateLinkedPlayerIds(linkedPlayerIds.filter((id) => id !== playerId));
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setError(null);

    try {
      await signInUser(signInEmail.trim(), signInPassword);
      setStatus("Signed in.");
    } catch (submitError) {
      setError(getFriendlyFirebaseError(submitError, "Unable to sign in."));
    } finally {
      setSubmitting(false);
    }
  }

  function openPasswordReset() {
    setResetEmail(signInEmail.trim());
    setMode("reset");
    setStatus(null);
    setError(null);
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = resetEmail.trim();

    if (!email) {
      setError("Enter your email address.");
      return;
    }

    setSendingPasswordReset(true);
    setStatus(null);
    setError(null);

    try {
      await sendPasswordReset(email);
      setStatus("Password reset email sent. Check your inbox for the reset link.");
    } catch (resetError) {
      setError(getFriendlyFirebaseError(resetError, "Unable to send password reset email."));
    } finally {
      setSendingPasswordReset(false);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createFirstName.trim() || !createLastName.trim() || !createEmail.trim() || !createPassword) {
      setError("Complete the required account fields.");
      return;
    }

    if (createRole !== "unverifiedCoach" && selectedPlayerIds.length === 0) {
      setError("Select at least one player for this account.");
      return;
    }

    if (createRole === "player" && selectedPlayerIds.length !== 1) {
      setError("Player accounts must be linked to one player.");
      return;
    }

    setSubmitting(true);
    setStatus(null);
    setError(null);

    try {
      await createPortalAccount({
        email: createEmail.trim(),
        password: createPassword,
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        phone: createPhone.trim(),
        role: createRole,
        playerIds: createRole === "unverifiedCoach" ? [] : selectedPlayerIds,
      });

      setStatus("Account created.");
      setCreateFirstName("");
      setCreateLastName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreatePhone("");
      setSelectedPlayerIds([]);
      setPlayerSearchTerm("");
    } catch (submitError) {
      setError(getFriendlyFirebaseError(submitError, "Unable to create account."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitConflict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingConflict(true);
    setConflictStatus(null);
    setConflictError(null);

    try {
      const selectedPlayer = linkedPlayers.find((player) => player.id === effectiveConflictPlayerId) ?? null;

      if (!access.authUser?.firebaseUser.uid) {
        throw new Error("You must be signed in to submit a conflict.");
      }

      if (!selectedPlayer) {
        throw new Error("Choose a player for this conflict.");
      }

      if (!conflictStartAt || !conflictEndAt) {
        throw new Error("Start and end date/time are required.");
      }

      const start = new Date(conflictStartAt);
      const end = new Date(conflictEndAt);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Enter valid conflict dates and times.");
      }

      if (end.getTime() <= start.getTime()) {
        throw new Error("End date/time must be after the start date/time.");
      }

      await firestoreApi.conflicts.create({
        userId: access.authUser.firebaseUser.uid,
        playerId: selectedPlayer.id,
        playerName: `${selectedPlayer.firstName} ${selectedPlayer.lastName}`,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        reason: conflictReason.trim(),
        status: "submitted",
      });

      setConflictStatus("Conflict submitted.");
      setConflictReason("");
      setConflictStartAt("");
      setConflictEndAt("");
    } catch (submitError) {
      setConflictError(getFriendlyFirebaseError(submitError, "Unable to submit conflict."));
    } finally {
      setSubmittingConflict(false);
    }
  }

  if (access.authUser) {
    return (
      <>
        <PageHero
          eyebrow="Player Portal"
          title="Your Portal"
          description="Your account is connected to the players you selected, so the portal can show the schedule and account information that matters to your family."
          actions={[{ href: "/profile", label: "Edit Profile" }]}
        />

        <div className="flex flex-col gap-8">
          <div className="order-2">
            <SectionCard title="Linked Players" kicker="Your Account">
            {linkedPlayers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
                No players are linked to this account yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {linkedPlayers.map((player) => {
                  const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "No team assigned";

                  return (
                    <div
                      key={player.id}
                      className={portalStaticCardClass}
                    >
                      <p className="text-lg font-bold text-[color:var(--ink)]">
                        {player.firstName} {player.lastName}
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                        <p>Team: {teamName}</p>
                        <p>Position: {player.position || "Position coming soon"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLinkedPlayer(player.id)}
                        disabled={savingLinkedPlayers}
                        className="mt-4 rounded-full border border-[#e7b8b8] px-4 py-2 text-sm font-semibold text-[#8a2d2d] transition hover:bg-[#fff2f2] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-6 space-y-4 border-t border-[color:var(--line)] pt-6">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Add linked player
                <input
                  value={playerSearchTerm}
                  onChange={(event) => setPlayerSearchTerm(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="Search by player name, team, or position"
                />
              </label>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {players.loading || teams.loading ? (
                  <div className="min-w-[18rem] rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    Loading players...
                  </div>
                ) : filteredPlayers.length === 0 ? (
                  <div className="min-w-[18rem] rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    No players match the current search.
                  </div>
                ) : (
                  filteredPlayers.map((player) => {
                    const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "No team assigned";
                    const isLinked = linkedPlayerIds.includes(player.id);

                    return (
                      <div key={player.id} className="min-w-[18rem] rounded-2xl border border-[color:var(--line)] bg-white px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-[color:var(--ink)]">
                              {player.firstName} {player.lastName}
                            </p>
                            <p className="mt-1 text-sm text-[color:var(--muted)]">
                              {teamName} · {player.position || "Position coming soon"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => (isLinked ? removeLinkedPlayer(player.id) : addLinkedPlayer(player.id))}
                            disabled={savingLinkedPlayers}
                            className="w-fit rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isLinked
                              ? "Remove"
                              : access.authUser?.profile?.role === "player"
                                ? "Switch"
                                : "Add"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {linkedPlayerStatus && <p className="text-sm text-[color:var(--muted)]">{linkedPlayerStatus}</p>}
              {linkedPlayerError && (
                <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                  {linkedPlayerError}
                </div>
              )}
            </div>
            </SectionCard>
          </div>

          <div className="order-1">
            <SectionCard title="Portal Overview" kicker="Season Tools">
            <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
              <div className="space-y-4">
                <div className={portalStaticCardClass}>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Teams
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                    {linkedTeams.length === 0 ? (
                      <p>No teams are linked yet.</p>
                    ) : (
                      linkedTeams.map((team) => (
                        <p key={team.id}>
                          <span className="font-semibold text-[color:var(--ink)]">{team.name}</span>
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div className={portalStaticCardClass}>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Payments
                  </p>
                  <div className="mt-4 space-y-3">
                    {registrations.loading || invoices.loading ? (
                      <p className="text-sm text-[color:var(--muted)]">Loading payment status...</p>
                    ) : registrations.error || invoices.error ? (
                      <p className="text-sm text-[color:var(--muted)]">Payment status is unavailable right now.</p>
                    ) : eventPaymentRegistrations.length === 0 && teamPaymentInvoices.length === 0 ? (
                      <p className="text-sm text-[color:var(--muted)]">No paid events or team payments are linked yet.</p>
                    ) : (
                      <>
                        {eventPaymentRegistrations.map((registration) => (
                          <div key={registration.id} className="rounded-2xl bg-[color:var(--paper)] px-4 py-4">
                            <p className="font-semibold text-[color:var(--ink)]">{registration.eventTitle}</p>
                            <p className="mt-1 text-sm text-[color:var(--muted)]">
                              {getLinkedPlayerName(
                                registration.playerId,
                                `${registration.athleteFirstName} ${registration.athleteLastName}`.trim(),
                              )} · {toAmountLabel(registration.eventPrice)}
                            </p>
                            <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                              Event payment: {registration.paymentStatus}
                            </p>
                          </div>
                        ))}
                        {teamPaymentInvoices.map((invoice) => {
                          const teamName = teams.data.find((team) => team.id === invoice.teamId)?.name ?? invoice.title;

                          return (
                            <div key={invoice.id} className="rounded-2xl bg-[color:var(--paper)] px-4 py-4">
                              <p className="font-semibold text-[color:var(--ink)]">{teamName}</p>
                              <p className="mt-1 text-sm text-[color:var(--muted)]">
                                {getLinkedPlayerName(invoice.playerId, "Linked player")}
                                {invoice.amount ? ` · ${toAmountLabel(invoice.amount)}` : ""}
                                {invoice.dueDate ? ` · Due ${toDateLabel(invoice.dueDate)}` : ""}
                              </p>
                              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                                Team payment: {invoice.status}
                              </p>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                {registrations.error && (
                  <div className="mb-4 rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                    Registration access is unavailable for this account right now.
                  </div>
                )}
                <ScheduleTable
                  events={scheduleEvents}
                  emptyLabel={
                    registrations.loading
                      ? "Loading season events..."
                      : "No season events are connected to your players yet."
                  }
                />
              </div>
            </div>
            </SectionCard>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionCard title="Submit A Conflict" kicker="Schedule Update">
            {linkedPlayers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
                Link a player to this account before submitting conflicts.
              </div>
            ) : (
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmitConflict}>
                <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    Player <span className="text-[#b42318]">*</span>
                  </span>
                  <select
                    value={effectiveConflictPlayerId}
                    onChange={(event) => setConflictPlayerId(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  >
                    {linkedPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.firstName} {player.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    Start date/time <span className="text-[#b42318]">*</span>
                  </span>
                  <input
                    type="datetime-local"
                    value={conflictStartAt}
                    onChange={(event) => setConflictStartAt(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    End date/time <span className="text-[#b42318]">*</span>
                  </span>
                  <input
                    type="datetime-local"
                    value={conflictEndAt}
                    onChange={(event) => setConflictEndAt(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  Reason
                  <textarea
                    value={conflictReason}
                    onChange={(event) => setConflictReason(event.target.value)}
                    className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                    placeholder="Add any context that coaches should know."
                  />
                </label>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={submittingConflict}
                    className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingConflict ? "Submitting..." : "Submit Conflict"}
                  </button>
                  {conflictStatus && <span className="text-sm text-[color:var(--muted)]">{conflictStatus}</span>}
                </div>
                {conflictError && (
                  <div className="md:col-span-2 rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                    {conflictError}
                  </div>
                )}
              </form>
            )}
          </SectionCard>

          <SectionCard title="Submitted Conflicts" kicker="Your History">
            {conflicts.loading ? (
              <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
                Loading conflicts...
              </div>
            ) : conflicts.error ? (
              <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
                Conflicts are unavailable right now.
              </div>
            ) : visibleConflicts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
                No conflicts have been submitted yet.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleConflicts.map((conflict: ConflictDocument) => (
                  <div
                    key={conflict.id}
                    className={portalStaticCardClass}
                  >
                    <p className="text-lg font-bold text-[color:var(--ink)]">{conflict.playerName}</p>
                    <div className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                      <p>
                        <span className="font-semibold text-[color:var(--ink)]">Start:</span>{" "}
                        {formatConflictDateTime(conflict.startAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-[color:var(--ink)]">End:</span>{" "}
                        {formatConflictDateTime(conflict.endAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-[color:var(--ink)]">Status:</span>{" "}
                        {conflict.status}
                      </p>
                    </div>
                    {conflict.reason && (
                      <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{conflict.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Player Portal"
        title="Parents And Players Login"
        description="Sign in to your portal account or create a new one and connect it to the players you want this account to follow."
        actions={[
          { href: "/register", label: "Register For An Event" },
          { href: "/teams", label: "View Team Info", variant: "secondary" },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <SectionCard
          title={mode === "signin" ? "Portal Login" : mode === "reset" ? "Reset Password" : "Create Account"}
          kicker="Account Access"
        >
          {mode === "signin" ? (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <span>
                  Email <span className="text-[#b42318]">*</span>
                </span>
                <input
                  value={signInEmail}
                  onChange={(event) => setSignInEmail(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="family@email.com"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <span>
                  Password <span className="text-[#b42318]">*</span>
                </span>
                <input
                  type="password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="••••••••"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || access.loading}
                  className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Signing In..." : "Sign In"}
                </button>
                <button
                  type="button"
                  onClick={openPasswordReset}
                  className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Forgot Password?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("create");
                    setStatus(null);
                    setError(null);
                  }}
                  className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                >
                  Create Account
                </button>
              </div>
            </form>
          ) : mode === "reset" ? (
            <form className="space-y-4" onSubmit={handlePasswordReset}>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <span>
                  Email <span className="text-[#b42318]">*</span>
                </span>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="family@email.com"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={sendingPasswordReset}
                  className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingPasswordReset ? "Sending..." : "Send Recovery Link"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setStatus(null);
                    setError(null);
                  }}
                  className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                >
                  Back To Login
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleCreateAccount}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    First name <span className="text-[#b42318]">*</span>
                  </span>
                  <input
                    value={createFirstName}
                    onChange={(event) => setCreateFirstName(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    Last name <span className="text-[#b42318]">*</span>
                  </span>
                  <input
                    value={createLastName}
                    onChange={(event) => setCreateLastName(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    Email <span className="text-[#b42318]">*</span>
                  </span>
                  <input
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                    placeholder="family@email.com"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    Password <span className="text-[#b42318]">*</span>
                  </span>
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(event) => setCreatePassword(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                    placeholder="Create a password"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  Phone
                  <input
                    value={createPhone}
                    onChange={(event) => setCreatePhone(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <span>
                    Account type <span className="text-[#b42318]">*</span>
                  </span>
                  <select
                    value={createRole}
                    onChange={(event) => {
                      setCreateRole(event.target.value as AccountRole);
                      setSelectedPlayerIds([]);
                    }}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  >
                    <option value="parent">Parent account</option>
                    <option value="player">Player account</option>
                    <option value="unverifiedCoach">Coach account</option>
                  </select>
                </label>
              </div>

              {createRole === "unverifiedCoach" ? (
                <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-4 py-4 text-sm leading-7 text-[color:var(--muted)]">
                  Coach accounts are created as unverified. An admin will approve the account and link it to a coach profile.
                </div>
              ) : (
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
                  <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    {createRole === "parent"
                      ? "Choose one or more players for this account."
                      : "Choose the player profile for this account."}
                  </div>
                  <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-2">
                    {players.loading || teams.loading ? (
                      <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                        Loading players...
                      </div>
                    ) : filteredPlayers.length === 0 ? (
                      <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                        No players match the current search.
                      </div>
                    ) : (
                      filteredPlayers.map((player) => {
                        const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "No team assigned";
                        const isSelected = selectedPlayerIds.includes(player.id);

                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => togglePlayer(player.id)}
                            className={`w-full text-left ${
                              isSelected
                                ? portalSelectedCardClass
                                : portalInteractiveCardClass
                            }`}
                          >
                            <p className={`text-lg font-bold ${isSelected ? "text-white" : "text-[color:var(--ink)] group-hover:text-white"}`}>
                              {player.firstName} {player.lastName}
                            </p>
                            <div className={`mt-2 space-y-1 text-sm ${isSelected ? "text-[#d7e5f2]" : "text-[color:var(--muted)] group-hover:text-[#d7e5f2]"}`}>
                              <p>Team: {teamName}</p>
                              <p>Position: {player.position || "Position coming soon"}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          )}

          {status && (
            <div className="mt-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--ink)]">
              {status}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
              {error}
            </div>
          )}
        </SectionCard>

        <SectionCard title="What This Portal Covers" kicker="Family Access">
          <div className="space-y-3">
            {portalHighlights.map((item) => (
              <div
                key={item}
                className={`${portalStaticCardClass} text-sm text-[color:var(--muted)]`}
              >
                {item}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
