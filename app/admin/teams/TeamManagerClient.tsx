"use client";

import { useMemo, useState, type FormEvent } from "react";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import { comparePlayersByName } from "@/lib/player-name";
import { isCurrentPlayer } from "@/lib/player-status";
import type { CoachDocument, TeamDocument } from "@/lib/firebase/schema";

type TeamDraft = {
  name: string;
  season: string;
  ageGroup: string;
  level: string;
  practicesPerWeek: string;
  practiceDurationMinutes: string;
  scheduleId: string;
  description: string;
  playerIds: string[];
  coachIds: string[];
  active: boolean;
};

const emptyDraft: TeamDraft = {
  name: "",
  season: "",
  ageGroup: "",
  level: "",
  practicesPerWeek: "2",
  practiceDurationMinutes: "120",
  scheduleId: "",
  description: "",
  playerIds: [],
  coachIds: [],
  active: true,
};

function mapTeamToDraft(team: TeamDocument): TeamDraft {
  return {
    name: team.name,
    season: team.season,
    ageGroup: team.ageGroup,
    level: team.level,
    practicesPerWeek: String(team.practicesPerWeek || 2),
    practiceDurationMinutes: String(team.practiceDurationMinutes || 120),
    scheduleId: team.scheduleId,
    description: team.description,
    playerIds: team.playerIds ?? [],
    coachIds: team.coachIds ?? [],
    active: team.active,
  };
}

function getCoachTeamIds(coach: CoachDocument): string[] {
  if (Array.isArray((coach as CoachDocument & { teamIds?: string[] }).teamIds)) {
    return (coach as CoachDocument & { teamIds?: string[] }).teamIds.filter(Boolean);
  }

  const legacyTeamId = (coach as CoachDocument & { teamId?: string }).teamId;

  return legacyTeamId ? [legacyTeamId] : [];
}

function toggleId(list: string[], id: string, checked: boolean) {
  return checked ? [...list, id] : list.filter((entry) => entry !== id);
}

function sortIds(list: string[]) {
  return [...list].sort((left, right) => left.localeCompare(right));
}

function areIdListsEqual(left: string[], right: string[]) {
  const sortedLeft = sortIds(left);
  const sortedRight = sortIds(right);

  if (sortedLeft.length !== sortedRight.length) {
    return false;
  }

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export default function TeamManagerClient() {
  const teams = useFirestoreCollection("teams");
  const players = useFirestoreCollection("players");
  const coaches = useFirestoreCollection("coaches");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [playerFilter, setPlayerFilter] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [draft, setDraft] = useState<TeamDraft>(emptyDraft);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredTeams = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sorted = [...teams.data].sort((a, b) => a.name.localeCompare(b.name));

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((team) => {
      const playerNames = players.data
        .filter(isCurrentPlayer)
        .filter((player) => team.playerIds.includes(player.id))
        .sort(comparePlayersByName)
        .map((player) => `${player.firstName} ${player.lastName}`)
        .join(" ");
      const coachNames = coaches.data
        .filter((coach) => (team.coachIds ?? []).includes(coach.id))
        .map((coach) => `${coach.firstName} ${coach.lastName}`)
        .join(" ");

      return [team.name, team.season, team.ageGroup, team.level, team.description, playerNames, coachNames]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [coaches.data, players.data, searchTerm, teams.data]);

  const sortedPlayers = useMemo(
    () => [...players.data].filter(isCurrentPlayer).sort(comparePlayersByName),
    [players.data],
  );

  const sortedCoaches = useMemo(
    () =>
      [...coaches.data].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [coaches.data],
  );

  const filteredPlayers = useMemo(() => {
    const normalizedFilter = playerFilter.trim().toLowerCase();

    if (!normalizedFilter) {
      return sortedPlayers;
    }

    return sortedPlayers.filter((player) => {
      const assignedTeam = teams.data.find((team) => team.id === player.teamId)?.name ?? "";

      return [player.firstName, player.lastName, player.position, assignedTeam]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilter);
    });
  }, [playerFilter, sortedPlayers, teams.data]);

  const filteredCoaches = useMemo(() => {
    const normalizedFilter = coachFilter.trim().toLowerCase();

    if (!normalizedFilter) {
      return sortedCoaches;
    }

    return sortedCoaches.filter((coach) => {
      const assignedTeams = getCoachTeamIds(coach)
        .map((teamId) => teams.data.find((team) => team.id === teamId)?.name ?? "")
        .join(" ");

      return [coach.firstName, coach.lastName, coach.title, assignedTeams]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilter);
    });
  }, [coachFilter, sortedCoaches, teams.data]);

  function resetForm() {
    setSelectedTeamId(null);
    setDraft(emptyDraft);
    setSelectedPhotoName("");
  }

  function beginEdit(team: TeamDocument) {
    setSelectedTeamId(team.id);
    setDraft(mapTeamToDraft(team));
    setSelectedPhotoName("");
    setStatus(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const basePayload = {
        name: draft.name.trim(),
        season: draft.season.trim(),
        ageGroup: draft.ageGroup.trim(),
        level: draft.level.trim(),
        practicesPerWeek: Number(draft.practicesPerWeek),
        practiceDurationMinutes: Number(draft.practiceDurationMinutes),
        scheduleId: draft.scheduleId.trim(),
        description: draft.description.trim(),
        playerIds: sortIds(draft.playerIds),
        coachIds: sortIds(draft.coachIds),
        // TODO: Replace this with the uploaded image URL once photo uploads are connected.
        photoUrl: "",
        active: draft.active,
      };

      if (!basePayload.name) {
        throw new Error("Team name is required.");
      }

      if (
        Number.isNaN(basePayload.practicesPerWeek) ||
        Number.isNaN(basePayload.practiceDurationMinutes)
      ) {
        throw new Error("Practice schedule settings are required.");
      }

      const teamId = selectedTeamId ?? (await firestoreApi.teams.create(basePayload));

      if (selectedTeamId) {
        await firestoreApi.teams.update(teamId, basePayload);
      }

      const nextPlayerTeamById = Object.fromEntries(
        players.data.map((player) => [player.id, player.teamId]),
      );

      for (const player of players.data) {
        const isAssignedToCurrentTeam = basePayload.playerIds.includes(player.id);

        if (isAssignedToCurrentTeam) {
          nextPlayerTeamById[player.id] = teamId;
        } else if (player.teamId === teamId) {
          nextPlayerTeamById[player.id] = "";
        }
      }

      const playerUpdates = players.data
        .filter((player) => nextPlayerTeamById[player.id] !== player.teamId)
        .map((player) => firestoreApi.players.update(player.id, { teamId: nextPlayerTeamById[player.id] }));

      const nextCoachTeamIdsById = Object.fromEntries(
        coaches.data.map((coach) => [coach.id, getCoachTeamIds(coach)]),
      );

      for (const coach of coaches.data) {
        const currentTeamIds = nextCoachTeamIdsById[coach.id];
        const isAssignedToCurrentTeam = basePayload.coachIds.includes(coach.id);

        nextCoachTeamIdsById[coach.id] = isAssignedToCurrentTeam
          ? sortIds(Array.from(new Set([...currentTeamIds, teamId])))
          : currentTeamIds.filter((entry) => entry !== teamId);
      }

      const coachUpdates = coaches.data
        .filter((coach) => !areIdListsEqual(nextCoachTeamIdsById[coach.id], getCoachTeamIds(coach)))
        .map((coach) => firestoreApi.coaches.update(coach.id, { teamIds: nextCoachTeamIdsById[coach.id] }));

      await Promise.all([...playerUpdates, ...coachUpdates]);

      const allTeams = selectedTeamId
        ? teams.data
        : [
            ...teams.data,
            {
              id: teamId,
              createdAt: null,
              updatedAt: null,
              ...basePayload,
            },
          ];

      const teamUpdates = allTeams.map((team) => {
        const desiredPlayerIds = sortIds(
          players.data
            .filter((player) => nextPlayerTeamById[player.id] === team.id)
            .map((player) => player.id),
        );
        const desiredCoachIds = sortIds(
          coaches.data
            .filter((coach) => nextCoachTeamIdsById[coach.id].includes(team.id))
            .map((coach) => coach.id),
        );

        if (team.id === teamId) {
          return firestoreApi.teams.update(team.id, {
            ...basePayload,
            playerIds: desiredPlayerIds,
            coachIds: desiredCoachIds,
          });
        }

        if (
          areIdListsEqual(team.playerIds ?? [], desiredPlayerIds) &&
          areIdListsEqual(team.coachIds ?? [], desiredCoachIds)
        ) {
          return null;
        }

        return firestoreApi.teams.update(team.id, {
          playerIds: desiredPlayerIds,
          coachIds: desiredCoachIds,
        });
      });

      await Promise.all(teamUpdates.filter((update): update is Promise<void> => update !== null));

      setStatus(selectedTeamId ? "Team updated." : "Team created.");
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save team.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(teamId: string) {
    const confirmed = window.confirm("Delete this team record?");

    if (!confirmed) {
      return;
    }

    setStatus(null);
    setError(null);

    try {
      const playerUpdates = players.data
        .filter((player) => player.teamId === teamId)
        .map((player) => firestoreApi.players.update(player.id, { teamId: "" }));

      const coachUpdates = coaches.data
        .filter((coach) => getCoachTeamIds(coach).includes(teamId))
        .map((coach) =>
          firestoreApi.coaches.update(coach.id, {
            teamIds: getCoachTeamIds(coach).filter((entry) => entry !== teamId),
          }),
        );

      await Promise.all([...playerUpdates, ...coachUpdates]);
      await firestoreApi.teams.remove(teamId);

      if (selectedTeamId === teamId) {
        resetForm();
      }

      setStatus("Team deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete team.");
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Team Manager"
        title="Manage Teams"
        description="Add new teams, update roster details, and remove old team records."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title={selectedTeamId ? "Edit Team" : "Add Team"} kicker="Team Details">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Team name <span className="text-[#b42318]">*</span>
              </span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Season
              <input
                value={draft.season}
                onChange={(event) => setDraft((current) => ({ ...current, season: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Age group
              <select
                value={draft.ageGroup}
                onChange={(event) => setDraft((current) => ({ ...current, ageGroup: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="">Select age group</option>
                {["12U", "13U", "14U", "15U", "16U", "17U", "18U"].map((ageGroup) => (
                  <option key={ageGroup} value={ageGroup}>
                    {ageGroup}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Level
              <input
                value={draft.level}
                onChange={(event) => setDraft((current) => ({ ...current, level: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Practices per week <span className="text-[#b42318]">*</span>
              </span>
              <select
                value={draft.practicesPerWeek}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, practicesPerWeek: event.target.value }))
                }
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                {["1", "2", "3", "4"].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Practice length <span className="text-[#b42318]">*</span>
              </span>
              <select
                value={draft.practiceDurationMinutes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, practiceDurationMinutes: event.target.value }))
                }
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
                <option value="150">150 minutes</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Schedule ID
              <input
                value={draft.scheduleId}
                onChange={(event) => setDraft((current) => ({ ...current, scheduleId: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Description
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Players
              <input
                value={playerFilter}
                onChange={(event) => setPlayerFilter(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search players by name, position, or current team"
              />
              <div className="max-h-60 grid gap-3 overflow-y-auto rounded-2xl border border-[color:var(--line)] px-4 py-4">
                {sortedPlayers.length === 0 && (
                  <span className="text-sm font-medium text-[color:var(--muted)]">
                    Add players before building a roster.
                  </span>
                )}
                {sortedPlayers.length > 0 && filteredPlayers.length === 0 && (
                  <span className="text-sm font-medium text-[color:var(--muted)]">
                    No players match the current search.
                  </span>
                )}
                {filteredPlayers.map((player) => {
                  const assignedTeam = teams.data.find((team) => team.id === player.teamId);

                  return (
                    <label
                      key={player.id}
                      className="flex items-center gap-3 text-sm font-medium text-[color:var(--ink)]"
                    >
                      <input
                        type="checkbox"
                        checked={draft.playerIds.includes(player.id)}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            playerIds: toggleId(current.playerIds, player.id, event.target.checked),
                          }))
                        }
                      />
                      <span>
                        {player.firstName} {player.lastName}
                        {assignedTeam ? ` · ${assignedTeam.name}` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Coaches
              <input
                value={coachFilter}
                onChange={(event) => setCoachFilter(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search coaches by name, title, or assigned team"
              />
              <div className="max-h-60 grid gap-3 overflow-y-auto rounded-2xl border border-[color:var(--line)] px-4 py-4">
                {sortedCoaches.length === 0 && (
                  <span className="text-sm font-medium text-[color:var(--muted)]">
                    Add coaches before assigning staff.
                  </span>
                )}
                {sortedCoaches.length > 0 && filteredCoaches.length === 0 && (
                  <span className="text-sm font-medium text-[color:var(--muted)]">
                    No coaches match the current search.
                  </span>
                )}
                {filteredCoaches.map((coach) => {
                  const assignedTeams = getCoachTeamIds(coach)
                    .map((teamId) => teams.data.find((team) => team.id === teamId)?.name ?? "")
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <label
                      key={coach.id}
                      className="flex items-center gap-3 text-sm font-medium text-[color:var(--ink)]"
                    >
                      <input
                        type="checkbox"
                        checked={draft.coachIds.includes(coach.id)}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            coachIds: toggleId(current.coachIds, coach.id, event.target.checked),
                          }))
                        }
                      />
                      <span>
                        {coach.firstName} {coach.lastName}
                        {assignedTeams ? ` · ${assignedTeams}` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Photo
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setSelectedPhotoName(event.target.files?.[0]?.name ?? "")}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
              <span className="text-xs font-medium text-[color:var(--muted)]">
                {selectedPhotoName ? `Selected: ${selectedPhotoName}` : "Choose a team photo."}
              </span>
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              />
              Active team
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : selectedTeamId ? "Save Changes" : "Add Team"}
              </button>
              {selectedTeamId && (
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

        <SectionCard title="Current Teams" kicker="Team Records">
          <div className="mb-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Search teams
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search by team, season, age group, level, player, or coach"
              />
            </label>
          </div>
          <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
            {teams.loading && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Loading teams...
              </div>
            )}
            {!teams.loading && filteredTeams.length === 0 && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                No teams match the current search.
              </div>
            )}
            {filteredTeams.map((team) => {
              const teamPlayers = players.data
                .filter(isCurrentPlayer)
                .filter((player) => player.teamId === team.id)
                .sort(comparePlayersByName);
              const teamCoaches = coaches.data.filter((coach) => getCoachTeamIds(coach).includes(team.id));

              return (
                <div key={team.id} className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-[color:var(--ink)]">{team.name}</p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {[team.season, team.ageGroup, team.level].filter(Boolean).join(" · ") || "No details set"}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Practices: {team.practicesPerWeek || 0} per week · {team.practiceDurationMinutes || 0} minutes
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Players: {teamPlayers.length ? teamPlayers.map((player) => `${player.firstName} ${player.lastName}`).join(", ") : "No players assigned"}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Coaches: {teamCoaches.length ? teamCoaches.map((coach) => `${coach.firstName} ${coach.lastName}`).join(", ") : "No coaches assigned"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => beginEdit(team)}
                        className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(team.id)}
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
