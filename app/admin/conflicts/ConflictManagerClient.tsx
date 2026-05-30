"use client";

import { useMemo, useState, type FormEvent } from "react";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection, getFriendlyFirebaseError } from "@/lib/firebase";
import { comparePlayersByName } from "@/lib/player-name";
import type { ConflictDocument } from "@/lib/firebase/schema";
import { isCurrentPlayer } from "@/lib/player-status";

type ConflictDraft = {
  playerId: string;
  startAt: string;
  endAt: string;
  reason: string;
  status: ConflictDocument["status"];
};

function toDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildEmptyDraft() {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  defaultStart.setMinutes(0, 0, 0);

  return {
    playerId: "",
    startAt: toDateTimeInputValue(defaultStart),
    endAt: toDateTimeInputValue(new Date(defaultStart.getTime() + 60 * 60 * 1000)),
    reason: "",
    status: "submitted" as const,
  };
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

function mapConflictToDraft(conflict: ConflictDocument): ConflictDraft {
  const start = new Date(conflict.startAt);
  const end = new Date(conflict.endAt);

  return {
    playerId: conflict.playerId,
    startAt: Number.isNaN(start.getTime()) ? "" : toDateTimeInputValue(start),
    endAt: Number.isNaN(end.getTime()) ? "" : toDateTimeInputValue(end),
    reason: conflict.reason ?? "",
    status: conflict.status,
  };
}

export default function ConflictManagerClient() {
  const conflicts = useFirestoreCollection("conflicts");
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const users = useFirestoreCollection("users");
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<ConflictDraft>(buildEmptyDraft);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectablePlayers = useMemo(
    () => [...players.data].filter(isCurrentPlayer).sort(comparePlayersByName),
    [players.data],
  );

  const filteredConflicts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sorted = [...conflicts.data].sort((a, b) => `${a.startAt}`.localeCompare(`${b.startAt}`));

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((conflict) => {
      const player = players.data.find((entry) => entry.id === conflict.playerId);
      const teamName = teams.data.find((team) => team.id === player?.teamId)?.name ?? "";

      return [
        conflict.playerName,
        player?.school ?? "",
        player?.position ?? "",
        conflict.reason,
        conflict.status,
        teamName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [conflicts.data, players.data, searchTerm, teams.data]);

  function resetForm() {
    setSelectedConflictId(null);
    setDraft(buildEmptyDraft());
  }

  function beginEdit(conflict: ConflictDocument) {
    setSelectedConflictId(conflict.id);
    setDraft(mapConflictToDraft(conflict));
    setStatus(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const player = selectablePlayers.find((entry) => entry.id === draft.playerId) ?? null;

      if (!player) {
        throw new Error("Choose a player.");
      }

      if (!draft.startAt || !draft.endAt) {
        throw new Error("Start and end date/time are required.");
      }

      const start = new Date(draft.startAt);
      const end = new Date(draft.endAt);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Enter valid conflict dates.");
      }

      if (end.getTime() <= start.getTime()) {
        throw new Error("End date/time must be after the start date/time.");
      }

      const linkedUser = users.data.find((user) => user.playerIds.includes(player.id)) ?? null;

      if (!linkedUser?.id) {
        throw new Error("That player must be linked to a portal account before a conflict can be assigned.");
      }

      const payload = {
        userId: linkedUser.id,
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        reason: draft.reason.trim(),
        status: draft.status,
      };

      if (selectedConflictId) {
        await firestoreApi.conflicts.update(selectedConflictId, payload);
        setStatus("Conflict updated.");
      } else {
        await firestoreApi.conflicts.create(payload);
        setStatus("Conflict created.");
      }

      resetForm();
    } catch (submitError) {
      setError(getFriendlyFirebaseError(submitError, "Unable to save conflict."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(conflictId: string) {
    const confirmed = window.confirm("Delete this conflict?");

    if (!confirmed) {
      return;
    }

    setStatus(null);
    setError(null);

    try {
      await firestoreApi.conflicts.remove(conflictId);
      if (selectedConflictId === conflictId) {
        resetForm();
      }
      setStatus("Conflict deleted.");
    } catch (deleteError) {
      setError(getFriendlyFirebaseError(deleteError, "Unable to delete conflict."));
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Conflict Manager"
        title="Review Conflicts"
        description="Add, edit, and review player scheduling conflicts before practice times are finalized."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title={selectedConflictId ? "Edit Conflict" : "Add Conflict"} kicker="Scheduling">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Player <span className="text-[#b42318]">*</span>
              </span>
              <select
                value={draft.playerId}
                onChange={(event) => setDraft((current) => ({ ...current, playerId: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="">Select player</option>
                {selectablePlayers.map((player) => {
                  const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "";
                  return (
                    <option key={player.id} value={player.id}>
                      {player.firstName} {player.lastName}
                      {teamName ? ` · ${teamName}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Start date/time <span className="text-[#b42318]">*</span>
              </span>
              <input
                type="datetime-local"
                value={draft.startAt}
                onChange={(event) => setDraft((current) => ({ ...current, startAt: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                End date/time <span className="text-[#b42318]">*</span>
              </span>
              <input
                type="datetime-local"
                value={draft.endAt}
                onChange={(event) => setDraft((current) => ({ ...current, endAt: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Status
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as ConflictDocument["status"],
                  }))
                }
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Reason
              <textarea
                value={draft.reason}
                onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
                className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Add any context that staff should know."
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : selectedConflictId ? "Save Changes" : "Add Conflict"}
              </button>
              {selectedConflictId && (
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

        <SectionCard title="Current Conflicts" kicker="Conflict Records">
          <div className="mb-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Search conflicts
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search by player, team, reason, or status"
              />
            </label>
          </div>
          <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
            {(conflicts.loading || players.loading || teams.loading || users.loading) && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Loading conflicts...
              </div>
            )}
            {!conflicts.loading && filteredConflicts.length === 0 && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                No conflicts match the current search.
              </div>
            )}
            {filteredConflicts.map((conflict) => {
              const player = players.data.find((entry) => entry.id === conflict.playerId);
              const teamName = teams.data.find((team) => team.id === player?.teamId)?.name ?? "No team assigned";

              return (
                <div
                  key={conflict.id}
                  className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-[color:var(--ink)]">{conflict.playerName}</p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Team: {teamName}
                        {player?.position ? ` · ${player.position}` : ""}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {formatConflictDateTime(conflict.startAt)} to {formatConflictDateTime(conflict.endAt)}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Status: {conflict.status}
                      </p>
                      {conflict.reason && (
                        <p className="text-sm text-[color:var(--muted)]">{conflict.reason}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => beginEdit(conflict)}
                        className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(conflict.id)}
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
