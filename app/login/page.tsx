"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { where } from "firebase/firestore";
import PageHero from "../components/PageHero";
import ScheduleTable from "../components/ScheduleTable";
import SectionCard from "../components/SectionCard";
import { createPortalAccount, signInUser, useAuthSession } from "@/lib/firebase/auth";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import type { RegistrationDocument } from "@/lib/firebase/schema";
import type { Event } from "../types/models";

type PortalMode = "signin" | "create";
type AccountRole = "parent" | "player";

const portalHighlights = [
  "Link one or more players to your account when you create it.",
  "See season events tied to your players and their teams.",
  "Use the same account later for balances, schedules, and club updates.",
];

function formatEventType(type: string): Event["eventType"] {
  if (type === "tryout") {
    return "tryouts";
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
            data: [...registrationMap.values()].sort((left, right) =>
              `${left.athleteLastName} ${left.athleteFirstName}`.localeCompare(
                `${right.athleteLastName} ${right.athleteFirstName}`,
              ),
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
            error: error.message,
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
  const linkedPlayerIds = useMemo(
    () => access.authUser?.profile?.playerIds ?? [],
    [access.authUser?.profile?.playerIds],
  );
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const events = useFirestoreCollection("events");
  const registrations = useRegistrationsByPlayerIds(linkedPlayerIds);
  const invoices = useFirestoreCollection("invoices", {
    enabled: Boolean(access.authUser?.firebaseUser.uid),
    constraints: access.authUser?.firebaseUser.uid
      ? [where("userId", "==", access.authUser.firebaseUser.uid)]
      : undefined,
  });

  const [mode, setMode] = useState<PortalMode>("signin");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createRole, setCreateRole] = useState<AccountRole>("parent");
  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = playerSearchTerm.trim().toLowerCase();

    return [...players.data]
      .filter((player) => player.active !== false)
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
  }, [playerSearchTerm, players.data, teams.data]);

  const linkedPlayers = useMemo(
    () => players.data.filter((player) => linkedPlayerIds.includes(player.id)),
    [linkedPlayerIds, players.data],
  );
  const linkedTeamIds = Array.from(new Set(linkedPlayers.map((player) => player.teamId).filter(Boolean)));
  const linkedTeams = teams.data.filter((team) => linkedTeamIds.includes(team.id));
  const scheduleEvents = useMemo<Event[]>(
    () =>
      [...events.data]
        .filter((event) => event.active !== false)
        .filter((event) => {
          if (event.type === "camp" || event.type === "tryout") {
            return registrations.data.some(
              (registration) =>
                registration.eventId === event.id && linkedPlayerIds.includes(registration.playerId),
            );
          }

          return !event.teamId || linkedTeamIds.includes(event.teamId);
        })
        .sort((left, right) =>
          `${left.startDate} ${left.startTime}`.localeCompare(`${right.startDate} ${right.startTime}`),
        )
        .map((event) => ({
          id: event.id,
          eventName: event.title,
          eventType: formatEventType(event.type),
          description: event.notes,
          startsAt: `${event.startDate}T${event.startTime || "00:00"}`,
          endsAt: `${event.endDate || event.startDate}T${event.startTime || "00:00"}`,
          teamIds: event.teamId ? [event.teamId] : [],
          coachIds: [],
          playerIds: [],
          location: event.location,
        })),
    [events.data, linkedPlayerIds, linkedTeamIds, registrations.data],
  );

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

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setError(null);

    try {
      await signInUser(signInEmail.trim(), signInPassword);
      setStatus("Signed in.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createFirstName.trim() || !createLastName.trim() || !createEmail.trim() || !createPassword) {
      setError("Complete the required account fields.");
      return;
    }

    if (selectedPlayerIds.length === 0) {
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
        playerIds: selectedPlayerIds,
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
      setError(submitError instanceof Error ? submitError.message : "Unable to create account.");
    } finally {
      setSubmitting(false);
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

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionCard title="Linked Players" kicker="Your Account">
            {linkedPlayers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
                No players are linked to this account yet.
              </div>
            ) : (
              <div className="space-y-4">
                {linkedPlayers.map((player) => {
                  const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "No team assigned";

                  return (
                    <div
                      key={player.id}
                      className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5"
                    >
                      <p className="text-lg font-bold text-[color:var(--ink)]">
                        {player.firstName} {player.lastName}
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                        <p>Team: {teamName}</p>
                        <p>Position: {player.position || "Position coming soon"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Portal Overview" kicker="Season Tools">
            <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-[color:var(--line)] px-5 py-5">
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
                          {team.season ? ` · ${team.season}` : ""}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[color:var(--line)] px-5 py-5">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Invoices
                  </p>
                  <div className="mt-4 space-y-3">
                    {invoices.loading ? (
                      <p className="text-sm text-[color:var(--muted)]">Loading invoices...</p>
                    ) : invoices.error ? (
                      <p className="text-sm text-[color:var(--muted)]">Invoices are unavailable right now.</p>
                    ) : invoices.data.length === 0 ? (
                      <p className="text-sm text-[color:var(--muted)]">No invoices are available yet.</p>
                    ) : (
                      invoices.data.map((invoice) => (
                        <div key={invoice.id} className="rounded-2xl bg-[color:var(--paper)] px-4 py-4">
                          <p className="font-semibold text-[color:var(--ink)]">{invoice.title}</p>
                          <p className="mt-1 text-sm text-[color:var(--muted)]">
                            {toAmountLabel(invoice.amount)} · Due {toDateLabel(invoice.dueDate)}
                          </p>
                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                            {invoice.status}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div>
                <ScheduleTable
                  events={scheduleEvents}
                  emptyLabel="No season events are connected to your players yet."
                />
              </div>
            </div>
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
          title={mode === "signin" ? "Portal Login" : "Create Account"}
          kicker="Account Access"
          headerAction={
            <button
              type="button"
              onClick={() => {
                setMode((current) => (current === "signin" ? "create" : "signin"));
                setStatus(null);
                setError(null);
              }}
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
            >
              {mode === "signin" ? "Create Account" : "Back To Login"}
            </button>
          }
        >
          {mode === "signin" ? (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Email
                <input
                  value={signInEmail}
                  onChange={(event) => setSignInEmail(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="family@email.com"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Password
                <input
                  type="password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="••••••••"
                />
              </label>
              <button
                type="submit"
                disabled={submitting || access.loading}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signing In..." : "Sign In"}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleCreateAccount}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  First name
                  <input
                    value={createFirstName}
                    onChange={(event) => setCreateFirstName(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  Last name
                  <input
                    value={createLastName}
                    onChange={(event) => setCreateLastName(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  Email
                  <input
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                    placeholder="family@email.com"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  Password
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(event) => setCreatePassword(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                    placeholder="Create a password"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  Phone (optional)
                  <input
                    value={createPhone}
                    onChange={(event) => setCreatePhone(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  Account type
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
                  </select>
                </label>
              </div>

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
                          className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition ${
                            isSelected
                              ? "border-[color:var(--ink)] bg-white"
                              : "border-[color:var(--line)] bg-white hover:bg-white/80"
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
              </div>

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
                className="rounded-[1.25rem] bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]"
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
