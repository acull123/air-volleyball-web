"use client";

import { useMemo, useState } from "react";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { useAuthSession } from "@/lib/firebase/auth";
import { firestoreApi, useFirestoreCollection, getFriendlyFirebaseError } from "@/lib/firebase";
import type { PlayerDocument, UserDocument, UserRole } from "@/lib/firebase/schema";
import { compareTeamsByAge } from "@/lib/team-sort";
import {
  formatTournamentDayCount,
  getPayTypeTournamentDayCount,
  isTournamentEventType,
} from "@/lib/tournament-events";

type RoleSelection = UserRole | "inactive";
type CoachSetupDraft = {
  role: "admin" | "coach";
  title: string;
  teamIds: string[];
  description: string;
  bio: string;
  privateLessonPriceSingle: string;
  privateLessonPricePair: string;
  payTypeIds: string[];
  active: boolean;
};

const roleOptions: RoleSelection[] = ["admin", "coach", "unverifiedCoach", "parent", "player", "inactive"];
const roleBadgeClasses: Record<RoleSelection, { selected: string; unselected: string }> = {
  admin: {
    selected: "bg-[#fef3c7] text-[#7a4b00]",
    unselected: "bg-[#fef3c7] text-[#92400e]",
  },
  coach: {
    selected: "bg-[#dcfce7] text-[#14532d]",
    unselected: "bg-[#dcfce7] text-[#166534]",
  },
  unverifiedCoach: {
    selected: "bg-[#ffedd5] text-[#7c2d12]",
    unselected: "bg-[#ffedd5] text-[#9a3412]",
  },
  parent: {
    selected: "bg-[#dbeafe] text-[#1e3a8a]",
    unselected: "bg-[#dbeafe] text-[#1d4ed8]",
  },
  player: {
    selected: "bg-[#ede9fe] text-[#4c1d95]",
    unselected: "bg-[#ede9fe] text-[#6d28d9]",
  },
  inactive: {
    selected: "bg-[#ffe4e6] text-[#881337]",
    unselected: "bg-[#ffe4e6] text-[#be123c]",
  },
};

const emptyCoachSetupDraft: CoachSetupDraft = {
  role: "coach",
  title: "Coach",
  teamIds: [],
  description: "",
  bio: "",
  privateLessonPriceSingle: "0",
  privateLessonPricePair: "0",
  payTypeIds: [],
  active: true,
};

function formatRole(role: RoleSelection) {
  if (role === "unverifiedCoach") {
    return "Unverified Coach";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getUserCoachId(user: UserDocument) {
  return (user as UserDocument & { coachId?: string }).coachId ?? "";
}

function getUserActive(user: UserDocument) {
  return (user as UserDocument & { active?: boolean }).active !== false;
}

function getRoleSelection(user: UserDocument): RoleSelection {
  return getUserActive(user) ? user.role : "inactive";
}

function isPlayerDocument(player: PlayerDocument | undefined): player is PlayerDocument {
  return Boolean(player);
}

function sortIds(list: string[]) {
  return [...list].sort((left, right) => left.localeCompare(right));
}

export default function UserSetupManagerClient() {
  const access = useAuthSession();
  const users = useFirestoreCollection("users", {
    enabled: access.authUser?.profile?.role === "admin",
  });
  const coaches = useFirestoreCollection("coaches", {
    enabled: access.authUser?.profile?.role === "admin",
  });
  const players = useFirestoreCollection("players", {
    enabled: access.authUser?.profile?.role === "admin",
  });
  const teams = useFirestoreCollection("teams", {
    enabled: access.authUser?.profile?.role === "admin",
  });
  const payTypes = useFirestoreCollection("payTypes", {
    enabled: access.authUser?.profile?.role === "admin",
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingCoachId, setSavingCoachId] = useState<string | null>(null);
  const [coachSetupUserId, setCoachSetupUserId] = useState<string | null>(null);
  const [adminCoachChoiceUserId, setAdminCoachChoiceUserId] = useState<string | null>(null);
  const [coachSetupDraft, setCoachSetupDraft] = useState<CoachSetupDraft>(emptyCoachSetupDraft);
  const [pendingRoleByUserId, setPendingRoleByUserId] = useState<Record<string, RoleSelection>>({});
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () =>
      [...users.data].sort((left, right) => {
        const leftActive = getUserActive(left);
        const rightActive = getUserActive(right);

        if (leftActive !== rightActive) {
          return leftActive ? -1 : 1;
        }

        if (left.role === right.role) {
          return `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`);
        }

        return left.role.localeCompare(right.role);
      }),
    [users.data],
  );
  const filteredUsers = useMemo(() => {
    const normalizedSearch = userSearchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return sortedUsers;
    }

    return sortedUsers.filter((user) =>
      [
        user.firstName,
        user.lastName,
        user.email,
        user.phone,
        formatRole(getRoleSelection(user)),
        getUserActive(user) ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [sortedUsers, userSearchTerm]);
  const sortedCoaches = useMemo(
    () =>
      [...coaches.data].sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`),
      ),
    [coaches.data],
  );
  const selectedUser = useMemo(
    () => sortedUsers.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? sortedUsers[0] ?? null,
    [filteredUsers, selectedUserId, sortedUsers],
  );
  const selectedLinkedPlayers = useMemo(() => {
    const playerIds = selectedUser?.playerIds ?? [];

    if (playerIds.length === 0) {
      return [];
    }

    return playerIds
      .map((playerId) => players.data.find((player) => player.id === playerId))
      .filter(isPlayerDocument)
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`),
      );
  }, [players.data, selectedUser?.playerIds]);
  const adminCoachChoiceUser = adminCoachChoiceUserId
    ? sortedUsers.find((user) => user.id === adminCoachChoiceUserId) ?? null
    : null;
  const selectedCoachId = selectedUser ? getUserCoachId(selectedUser) : "";
  const linkedCoach = selectedCoachId
    ? sortedCoaches.find((coach) => coach.id === selectedCoachId) ?? null
    : null;
  const selectedRole = selectedUser
    ? pendingRoleByUserId[selectedUser.id] ?? getRoleSelection(selectedUser)
    : "inactive";
  const sortedPayTypes = useMemo(
    () =>
      [...payTypes.data].sort((left, right) =>
        `${left.eventType ?? ""} ${left.description}`.localeCompare(`${right.eventType ?? ""} ${right.description}`),
      ),
    [payTypes.data],
  );
  const defaultPayTypeIds = useMemo(
    () => payTypes.data.filter((payType) => payType.defaulted).map((payType) => payType.id),
    [payTypes.data],
  );
  const sortedTeams = useMemo(() => [...teams.data].sort(compareTeamsByAge), [teams.data]);

  async function updateUser(user: UserDocument, updates: Partial<Pick<UserDocument, "role" | "coachId" | "active">>) {
    const nextRole = updates.role ?? user.role;

    setSavingUserId(user.id);
    setMessage(null);
    setError(null);

    try {
      await firestoreApi.users.update(user.id, {
        ...updates,
        ...(nextRole !== "coach" && nextRole !== "admin" && nextRole !== "unverifiedCoach"
          ? { coachId: "" }
          : {}),
      });
      setPendingRoleByUserId((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      setMessage("Account updated.");
    } catch (updateError) {
      setError(getFriendlyFirebaseError(updateError, "Unable to update account."));
    } finally {
      setSavingUserId(null);
    }
  }

  function beginCoachSetup(user: UserDocument, role: "admin" | "coach") {
    setCoachSetupUserId(user.id);
    setAdminCoachChoiceUserId(null);
    setCoachSetupDraft({
      ...emptyCoachSetupDraft,
      role,
      payTypeIds: defaultPayTypeIds,
    });
    setMessage(null);
    setError(null);
  }

  async function updateRole(user: UserDocument, roleSelection: RoleSelection) {
    setPendingRoleByUserId((current) => ({ ...current, [user.id]: roleSelection }));

    if (roleSelection === "inactive") {
      setCoachSetupUserId(null);
      setAdminCoachChoiceUserId(null);
      await updateUser(user, { active: false });
      return;
    }

    if (roleSelection === "admin" && !getUserCoachId(user)) {
      setCoachSetupUserId(null);
      setAdminCoachChoiceUserId(user.id);
      setMessage(null);
      setError(null);
      return;
    }

    if (roleSelection === "coach" && !getUserCoachId(user)) {
      beginCoachSetup(user, roleSelection);
      return;
    }

    setCoachSetupUserId(null);
    setAdminCoachChoiceUserId(null);
    await updateUser(user, {
      role: roleSelection,
      active: true,
    });
  }

  async function saveRoleWithoutCoachProfile(user: UserDocument) {
    setAdminCoachChoiceUserId(null);
    await updateUser(user, {
      role: coachSetupDraft.role,
      active: true,
    });
    setCoachSetupUserId(null);
  }

  async function saveAdminOnly(user: UserDocument) {
    setAdminCoachChoiceUserId(null);
    setCoachSetupUserId(null);
    await updateUser(user, {
      role: "admin",
      active: true,
    });
  }

  function continueAdminWithCoachProfile(user: UserDocument) {
    setPendingRoleByUserId((current) => ({ ...current, [user.id]: "admin" }));
    beginCoachSetup(user, "admin");
  }

  async function verifyCoachWithProfile(user: UserDocument) {
    const singlePrice = coachSetupDraft.privateLessonPriceSingle.trim()
      ? Number(coachSetupDraft.privateLessonPriceSingle)
      : 0;
    const pairPrice = coachSetupDraft.privateLessonPricePair.trim()
      ? Number(coachSetupDraft.privateLessonPricePair)
      : 0;

    if (!coachSetupDraft.title.trim()) {
      setError("Coach title is required.");
      return;
    }

    if (Number.isNaN(singlePrice) || singlePrice < 0 || Number.isNaN(pairPrice) || pairPrice < 0) {
      setError("Private lesson prices must be valid amounts.");
      return;
    }

    setSavingUserId(user.id);
    setMessage(null);
    setError(null);

    try {
      const coachId = await firestoreApi.coaches.create({
        firstName: user.firstName.trim(),
        lastName: user.lastName.trim(),
        title: coachSetupDraft.title.trim(),
        teamIds: coachSetupDraft.teamIds,
        bio: coachSetupDraft.bio.trim(),
        description: coachSetupDraft.description.trim(),
        photoUrl: "",
        email: user.email.trim(),
        phone: user.phone ?? "",
        privateLessonPriceSingle: singlePrice,
        privateLessonPricePair: pairPrice,
        payTypeIds: coachSetupDraft.payTypeIds,
        active: coachSetupDraft.active,
      });

      await firestoreApi.users.update(user.id, {
        role: coachSetupDraft.role,
        coachId,
        active: true,
      });

      await Promise.all(
        coachSetupDraft.teamIds.map((teamId) => {
          const team = teams.data.find((entry) => entry.id === teamId);
          const nextCoachIds = sortIds(Array.from(new Set([...(team?.coachIds ?? []), coachId])));

          return firestoreApi.teams.update(teamId, {
            coachIds: nextCoachIds,
          });
        }),
      );
      setPendingRoleByUserId((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      setMessage(
        coachSetupDraft.role === "admin"
          ? "Admin account updated and coach profile created."
          : "Coach account verified and coach profile created.",
      );
      setCoachSetupUserId(null);
    } catch (updateError) {
      setError(getFriendlyFirebaseError(updateError, "Unable to verify coach account."));
    } finally {
      setSavingUserId(null);
    }
  }

  async function updateLinkedCoachActive(coachId: string, active: boolean) {
    if (!coachId) {
      return;
    }

    setSavingCoachId(coachId);
    setMessage(null);
    setError(null);

    try {
      await firestoreApi.coaches.update(coachId, { active });
      setMessage(active ? "Coach profile activated." : "Coach profile deactivated.");
    } catch (updateError) {
      setError(getFriendlyFirebaseError(updateError, "Unable to update coach profile."));
    } finally {
      setSavingCoachId(null);
    }
  }

  if (access.loading) {
    return (
      <>
        <PageHero
          eyebrow="Account Management"
          title="Edit Accounts"
          description="Checking your admin access."
        />
        <SectionCard title="Loading" kicker="Admin Access">
          <p className="text-sm text-[color:var(--muted)]">Verifying account access...</p>
        </SectionCard>
      </>
    );
  }

  if (access.authUser?.profile?.role !== "admin" || access.authUser.profile.active === false) {
    return (
      <>
        <PageHero
          eyebrow="Account Management"
          title="Edit Accounts"
          description="This area is only available to admins."
          actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
        />
        <SectionCard title="Access Denied" kicker="Admin Access">
          <p className="text-sm text-[color:var(--muted)]">You do not have access to account management.</p>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Account Management"
        title="Edit Accounts"
        description="Users create their own accounts. Admins review those accounts, change roles, link coach profiles, and mark accounts inactive."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      {adminCoachChoiceUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/55 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-coach-choice-title"
            className="w-full max-w-lg rounded-[1.5rem] border border-[color:var(--line)] bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Admin Role
            </p>
            <h2 id="admin-coach-choice-title" className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
              Will this admin also coach?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              {adminCoachChoiceUser.firstName} {adminCoachChoiceUser.lastName} is being changed to an admin.
              Choose whether they also need a coach profile before continuing.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={savingUserId === adminCoachChoiceUser.id}
                onClick={() => void saveAdminOnly(adminCoachChoiceUser)}
                className="rounded-2xl border border-[color:var(--line)] px-5 py-4 text-left transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block font-bold text-[color:var(--ink)]">Just admin</span>
                <span className="mt-1 block text-sm leading-5 text-[color:var(--muted)]">
                  Give admin access without creating a coach profile.
                </span>
              </button>
              <button
                type="button"
                disabled={savingUserId === adminCoachChoiceUser.id}
                onClick={() => continueAdminWithCoachProfile(adminCoachChoiceUser)}
                className="rounded-2xl bg-[color:var(--ink)] px-5 py-4 text-left text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block font-bold">Admin and coach</span>
                <span className="mt-1 block text-sm leading-5 text-white/75">
                  Continue to create and link a coach profile.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="Users" kicker="Select Account">
          {users.loading || coaches.loading ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Loading accounts...
            </div>
          ) : users.error ? (
            <div className="rounded-3xl border border-dashed border-[#e7b8b8] bg-[#fff2f2] px-6 py-10 text-center text-sm text-[#8a2d2d]">
              Account records are unavailable right now: {users.error}
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              No user accounts have been created yet.
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Search accounts
                <input
                  value={userSearchTerm}
                  onChange={(event) => setUserSearchTerm(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="Search by name, email, phone, or role"
                />
              </label>
              {filteredUsers.length === 0 && (
                <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                  No accounts match the current search.
                </div>
              )}
              {filteredUsers.map((user) => {
                const userActive = getUserActive(user);
                const roleSelection = getRoleSelection(user);
                const isSelected = selectedUser?.id === user.id;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setCoachSetupUserId(null);
                      setAdminCoachChoiceUserId(null);
                      setPendingRoleByUserId({});
                      setMessage(null);
                      setError(null);
                    }}
                    className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition ${
                      isSelected
                        ? "border-transparent bg-[color:var(--ink)] text-white"
                        : "border-[color:var(--line)] bg-white text-[color:var(--ink)] hover:bg-[color:var(--paper)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-lg font-bold ${isSelected ? "text-white" : "text-[color:var(--ink)]"}`}>
                        {user.firstName} {user.lastName}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
                          isSelected
                            ? roleBadgeClasses[roleSelection].selected
                            : roleBadgeClasses[roleSelection].unselected
                        }`}
                      >
                        {userActive ? formatRole(user.role) : "Inactive"}
                      </span>
                    </div>
                    <p className={`mt-1 text-sm ${isSelected ? "text-white/70" : "text-[color:var(--muted)]"}`}>
                      {user.email}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Edit Account" kicker="Role And Status">
          {!selectedUser ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Select a user to edit their account.
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-[color:var(--ink)]">
                  {selectedUser.firstName} {selectedUser.lastName}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{selectedUser.email}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  Role
                  <select
                    value={selectedRole}
                    disabled={savingUserId === selectedUser.id}
                    onChange={(event) => void updateRole(selectedUser, event.target.value as RoleSelection)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3 disabled:bg-[color:var(--paper)]"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {formatRole(role)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  Linked Players
                </p>
                {players.loading || teams.loading ? (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">Loading linked players...</p>
                ) : players.error || teams.error ? (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">Linked players are unavailable right now.</p>
                ) : selectedLinkedPlayers.length === 0 ? (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">No players are linked to this account.</p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {selectedLinkedPlayers.map((player) => {
                      const teamName =
                        teams.data.find((team) => team.id === player.teamId)?.name ?? "No team assigned";

                      return (
                        <div
                          key={player.id}
                          className="rounded-2xl bg-[color:var(--paper)] px-4 py-4"
                        >
                          <p className="font-semibold text-[color:var(--ink)]">
                            {player.firstName} {player.lastName}
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--muted)]">
                            {teamName}
                            {player.position ? ` · ${player.position}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {coachSetupUserId === selectedUser.id && (
                <div className="space-y-4 rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5">
                  <div className="rounded-2xl bg-[color:var(--paper)] px-4 py-4">
                    <p className="font-bold text-[color:var(--ink)]">Create coach profile</p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                      This will set the user role to {formatRole(coachSetupDraft.role)} and create a coach profile for {selectedUser.firstName} {selectedUser.lastName} using their account email and phone.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={savingUserId === selectedUser.id}
                      onClick={() => void saveRoleWithoutCoachProfile(selectedUser)}
                      className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {coachSetupDraft.role === "admin" ? "Make admin only" : "Make coach without profile"}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      <span>
                        Title <span className="text-[#b42318]">*</span>
                      </span>
                      <input
                        value={coachSetupDraft.title}
                        onChange={(event) =>
                          setCoachSetupDraft((current) => ({ ...current, title: event.target.value }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      Active coach
                      <select
                        value={coachSetupDraft.active ? "active" : "inactive"}
                        onChange={(event) =>
                          setCoachSetupDraft((current) => ({
                            ...current,
                            active: event.target.value === "active",
                          }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      1 athlete lesson price per hour
                      <input
                        value={coachSetupDraft.privateLessonPriceSingle}
                        onChange={(event) =>
                          setCoachSetupDraft((current) => ({
                            ...current,
                            privateLessonPriceSingle: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                      2 athlete lesson price per hour
                      <input
                        value={coachSetupDraft.privateLessonPricePair}
                        onChange={(event) =>
                          setCoachSetupDraft((current) => ({
                            ...current,
                            privateLessonPricePair: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                        inputMode="decimal"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    Teams
                    <div className="grid gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-4">
                      {teams.data.length === 0 && (
                        <span className="text-sm font-medium text-[color:var(--muted)]">
                          Add teams before assigning coaches.
                        </span>
                      )}
                      {sortedTeams.map((team) => (
                        <label key={team.id} className="flex items-center gap-3 text-sm font-medium text-[color:var(--ink)]">
                          <input
                            type="checkbox"
                            checked={coachSetupDraft.teamIds.includes(team.id)}
                            onChange={(event) =>
                              setCoachSetupDraft((current) => ({
                                ...current,
                                teamIds: event.target.checked
                                  ? [...current.teamIds, team.id]
                                  : current.teamIds.filter((teamId) => teamId !== team.id),
                              }))
                            }
                          />
                          <span>{team.name}</span>
                        </label>
                      ))}
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    Pay types
                    <div className="grid gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-4">
                      {sortedPayTypes.length === 0 && (
                        <span className="text-sm font-medium text-[color:var(--muted)]">
                          Add pay types from the finance setup page before assigning coach pay.
                        </span>
                      )}
                      {sortedPayTypes.map((payType) => (
                          <label key={payType.id} className="flex items-center gap-3 text-sm font-medium text-[color:var(--ink)]">
                            <input
                              type="checkbox"
                              checked={coachSetupDraft.payTypeIds.includes(payType.id)}
                              onChange={(event) =>
                                setCoachSetupDraft((current) => ({
                                  ...current,
                                  payTypeIds: event.target.checked
                                    ? [...current.payTypeIds, payType.id]
                                    : current.payTypeIds.filter((payTypeId) => payTypeId !== payType.id),
                                }))
                              }
                            />
                            <span>
                              {payType.description} · ${payType.value}
                              {isTournamentEventType(payType.eventType)
                                ? ` · ${formatTournamentDayCount(getPayTypeTournamentDayCount(payType))}`
                                : ""}
                              {payType.defaulted ? " · default" : ""}
                              {(payType.mealStipendAmount ?? 0) > 0
                                ? ` · meal stipend $${payType.mealStipendAmount}`
                                : ""}
                            </span>
                          </label>
                      ))}
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    Description
                    <textarea
                      value={coachSetupDraft.description}
                      onChange={(event) =>
                        setCoachSetupDraft((current) => ({ ...current, description: event.target.value }))
                      }
                      className="min-h-24 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    Bio
                    <textarea
                      value={coachSetupDraft.bio}
                      onChange={(event) =>
                        setCoachSetupDraft((current) => ({ ...current, bio: event.target.value }))
                      }
                      className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={savingUserId === selectedUser.id}
                      onClick={() => void verifyCoachWithProfile(selectedUser)}
                      className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingUserId === selectedUser.id
                        ? "Creating..."
                        : coachSetupDraft.role === "admin"
                          ? "Create coach profile and make admin"
                          : "Create coach profile and verify"}
                    </button>
                    <button
                      type="button"
                      disabled={savingUserId === selectedUser.id}
                      onClick={() => {
                        setCoachSetupUserId(null);
                        setPendingRoleByUserId((current) => {
                          const next = { ...current };
                          delete next[selectedUser.id];
                          return next;
                        });
                      }}
                      className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {linkedCoach && (
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">
                        Linked coach: {linkedCoach.firstName} {linkedCoach.lastName}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        Coach profile is {linkedCoach.active === false ? "inactive" : "active"}.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={savingCoachId === linkedCoach.id}
                      onClick={() => void updateLinkedCoachActive(linkedCoach.id, linkedCoach.active === false)}
                      className="w-fit rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {linkedCoach.active === false ? "Activate coach" : "Deactivate coach"}
                    </button>
                  </div>
                </div>
              )}

              {message && (
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--ink)]">
                  {message}
                </div>
              )}
              {error && (
                <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                  {error}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
