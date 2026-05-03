"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import type { PlayerDocument } from "@/lib/firebase/schema";

type PlayerDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  position: string;
  jerseyNumber: string;
  teamId: string;
  bio: string;
  active: boolean;
};

const emptyDraft: PlayerDraft = {
  firstName: "",
  lastName: "",
  birthDate: "",
  position: "",
  jerseyNumber: "",
  teamId: "",
  bio: "",
  active: true,
};

function mapPlayerToDraft(player: PlayerDocument): PlayerDraft {
  return {
    firstName: player.firstName,
    lastName: player.lastName,
    birthDate: player.birthDate ?? "",
    position: player.position,
    jerseyNumber: String(player.jerseyNumber),
    teamId: player.teamId,
    bio: player.bio,
    active: player.active,
  };
}

export default function PlayerManagerClient() {
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<PlayerDraft>(emptyDraft);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sorted = [...players.data].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
    );

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((player) => {
      const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "";
      const haystack = [
        player.firstName,
        player.lastName,
        player.position,
        player.birthDate,
        teamName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [players.data, searchTerm, teams.data]);

  function resetForm() {
    setSelectedPlayerId(null);
    setDraft(emptyDraft);
    setSelectedPhotoName("");
  }

  function beginEdit(player: PlayerDocument) {
    setSelectedPlayerId(player.id);
    setDraft(mapPlayerToDraft(player));
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
      const payload = {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        birthDate: draft.birthDate,
        position: draft.position.trim(),
        jerseyNumber: draft.jerseyNumber.trim() ? Number(draft.jerseyNumber) : 0,
        teamId: draft.teamId.trim(),
        bio: draft.bio.trim(),
        // TODO: Replace this with the uploaded image URL once photo uploads are connected.
        photoUrl: "",
        active: draft.active,
      };

      if (!payload.firstName || !payload.lastName || !payload.birthDate) {
        throw new Error("First name, last name, and birthdate are required.");
      }

      if (Number.isNaN(payload.jerseyNumber)) {
        throw new Error("Jersey number must be a valid number.");
      }

      if (selectedPlayerId) {
        await firestoreApi.players.update(selectedPlayerId, payload);
        setStatus("Player updated.");
      } else {
        await firestoreApi.players.create(payload);
        setStatus("Player created.");
      }

      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save player.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(playerId: string) {
    const confirmed = window.confirm("Delete this player record?");

    if (!confirmed) {
      return;
    }

    setStatus(null);
    setError(null);

    try {
      await firestoreApi.players.remove(playerId);
      if (selectedPlayerId === playerId) {
        resetForm();
      }
      setStatus("Player deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete player.");
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Player Manager"
        title="Manage Players"
        description="Add new players, update player details, and remove old records from the player list."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title={selectedPlayerId ? "Edit Player" : "Add Player"}
          kicker="Player Details"
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              First name
              <input
                value={draft.firstName}
                onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Last name
              <input
                value={draft.lastName}
                onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Birthdate
              <input
                value={draft.birthDate}
                onChange={(event) => setDraft((current) => ({ ...current, birthDate: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                type="date"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Jersey number
              <input
                value={draft.jerseyNumber}
                onChange={(event) => setDraft((current) => ({ ...current, jerseyNumber: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                inputMode="numeric"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Position
              <input
                value={draft.position}
                onChange={(event) => setDraft((current) => ({ ...current, position: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Team
              <select
                value={draft.teamId}
                onChange={(event) => setDraft((current) => ({ ...current, teamId: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="">Select team</option>
                {teams.data.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Bio
              <textarea
                value={draft.bio}
                onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
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
                {selectedPhotoName ? `Selected: ${selectedPhotoName}` : "Choose a player photo."}
              </span>
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              />
              Active player
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : selectedPlayerId ? "Save Changes" : "Add Player"}
              </button>
              {selectedPlayerId && (
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

        <SectionCard title="Current Players" kicker="Roster Records">
          <div className="mb-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Search players
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search by name, team, position, or birthdate"
              />
            </label>
          </div>
          <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
            {players.loading && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Loading players...
              </div>
            )}
            {!players.loading && filteredPlayers.length === 0 && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                No players match the current search.
              </div>
            )}
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-[color:var(--ink)]">
                      {player.firstName} {player.lastName}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      #{player.jerseyNumber} · {player.position} · {player.birthDate}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      Team: {teams.data.find((team) => team.id === player.teamId)?.name ?? player.teamId}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => beginEdit(player)}
                      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(player.id)}
                      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-sm text-[color:var(--muted)]">
            Need to manage team assignments first?{" "}
            <Link href="/admin/dashboard" className="font-semibold text-[color:var(--ink)]">
              Return to the admin dashboard
            </Link>
            .
          </div>
        </SectionCard>
      </div>
    </>
  );
}
