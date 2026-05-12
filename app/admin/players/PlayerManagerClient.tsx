"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import { comparePlayersByName } from "@/lib/player-name";
import type { PlayerDocument } from "@/lib/firebase/schema";
import { deletePhotoByUrl, uploadPlayerPhoto } from "@/lib/firebase/storage";

type PlayerDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  school: string;
  college: string;
  position: string;
  jerseyNumber: string;
  teamId: string;
  bio: string;
  photoUrl: string;
  active: boolean;
  isAlumni: boolean;
};

const emptyDraft: PlayerDraft = {
  firstName: "",
  lastName: "",
  birthDate: "",
  school: "",
  college: "",
  position: "",
  jerseyNumber: "",
  teamId: "",
  bio: "",
  photoUrl: "",
  active: true,
  isAlumni: false,
};

function mapPlayerToDraft(player: PlayerDocument): PlayerDraft {
  return {
    firstName: player.firstName,
    lastName: player.lastName,
    birthDate: player.birthDate ?? "",
    school: player.school ?? "",
    college: player.college ?? "",
    position: player.position,
    jerseyNumber: String(player.jerseyNumber),
    teamId: player.teamId,
    bio: player.bio,
    photoUrl: player.photoUrl ?? "",
    active: player.active,
    isAlumni: player.isAlumni === true,
  };
}

export default function PlayerManagerClient() {
  const searchParams = useSearchParams();
  const initialPlayerId = searchParams.get("player") ?? "";
  const initialSearchTerm = searchParams.get("search") ?? "";
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<PlayerDraft>(emptyDraft);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoUrlToDelete, setPhotoUrlToDelete] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (players.loading) {
      return;
    }

    if (!initialPlayerId && initialSearchTerm && !searchTerm) {
      queueMicrotask(() => setSearchTerm(initialSearchTerm));
      return;
    }

    if (!initialPlayerId || selectedPlayerId === initialPlayerId) {
      return;
    }

    const player = players.data.find((entry) => entry.id === initialPlayerId);

    queueMicrotask(() => {
      if (!player) {
        if (initialSearchTerm) {
          setSearchTerm(initialSearchTerm);
        }
        return;
      }

      setSelectedPlayerId(player.id);
      setDraft(mapPlayerToDraft(player));
      setSearchTerm(initialSearchTerm || `${player.firstName} ${player.lastName}`.trim());
      setSelectedPhotoName("");
      setSelectedPhotoFile(null);
      setPhotoUrlToDelete("");
      setStatus(null);
      setError(null);
    });
  }, [initialPlayerId, initialSearchTerm, players.data, players.loading, searchTerm, selectedPlayerId]);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sorted = [...players.data].sort(comparePlayersByName);

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((player) => {
      const teamName = teams.data.find((team) => team.id === player.teamId)?.name ?? "";
      const haystack = [
        player.firstName,
        player.lastName,
        player.position,
        player.school,
        player.college,
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
    setSelectedPhotoFile(null);
    setPhotoUrlToDelete("");
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  function beginEdit(player: PlayerDocument) {
    setSelectedPlayerId(player.id);
    setDraft(mapPlayerToDraft(player));
    setSelectedPhotoName("");
    setSelectedPhotoFile(null);
    setPhotoUrlToDelete("");
    setStatus(null);
    setError(null);
  }

  function clearSelectedPhotoFile() {
    setSelectedPhotoFile(null);
    setSelectedPhotoName("");
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  function removePhoto() {
    if (draft.photoUrl) {
      setPhotoUrlToDelete(draft.photoUrl);
    }

    setDraft((current) => ({ ...current, photoUrl: "" }));
    clearSelectedPhotoFile();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const previousPhotoUrl =
        photoUrlToDelete || (selectedPhotoFile && draft.photoUrl ? draft.photoUrl : "");
      let photoUrl = draft.photoUrl;

      if (selectedPhotoFile) {
        photoUrl = await uploadPlayerPhoto({
          file: selectedPhotoFile,
          playerId: selectedPlayerId,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
        });
      }

      const payload = {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        birthDate: draft.birthDate,
        school: draft.school.trim(),
        college: draft.college.trim(),
        position: draft.position.trim(),
        jerseyNumber: draft.jerseyNumber.trim() ? Number(draft.jerseyNumber) : 0,
        teamId: draft.teamId.trim(),
        bio: draft.bio.trim(),
        photoUrl,
        active: draft.active,
        isAlumni: draft.isAlumni,
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

      if (previousPhotoUrl && previousPhotoUrl !== photoUrl) {
        await deletePhotoByUrl(previousPhotoUrl);
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
              <span>
                First name <span className="text-[#b42318]">*</span>
              </span>
              <input
                value={draft.firstName}
                onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Last name <span className="text-[#b42318]">*</span>
              </span>
              <input
                value={draft.lastName}
                onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Birthdate <span className="text-[#b42318]">*</span>
              </span>
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
              School
              <input
                value={draft.school}
                onChange={(event) => setDraft((current) => ({ ...current, school: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              College
              <input
                value={draft.college}
                onChange={(event) => setDraft((current) => ({ ...current, college: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
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
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedPhotoFile(file);
                  setSelectedPhotoName(file?.name ?? "");
                }}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
              <span className="text-xs font-medium text-[color:var(--muted)]">
                {selectedPhotoName
                  ? `Selected: ${selectedPhotoName}`
                  : draft.photoUrl
                    ? "Current photo is saved. Choose a new file to replace it."
                    : photoUrlToDelete
                      ? "Photo will be removed when you save."
                      : "Choose a player photo."}
              </span>
              {draft.photoUrl && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="w-fit rounded-full border border-[#e7b8b8] px-4 py-2 text-sm font-semibold text-[#8a2d2d] transition hover:bg-[#fff2f2]"
                >
                  Remove photo
                </button>
              )}
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              />
              Active player
            </label>
            <label className="flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={draft.isAlumni}
                onChange={(event) => setDraft((current) => ({ ...current, isAlumni: event.target.checked }))}
              />
              Alumni player
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
                placeholder="Search by name, team, position, school, college, or birthdate"
              />
            </label>
          </div>
          <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
            {(players.loading || teams.loading) && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Loading players...
              </div>
            )}
            {!(players.loading || teams.loading) && filteredPlayers.length === 0 && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                No players match the current search.
              </div>
            )}
            {filteredPlayers.map((player) => {
              const team = teams.data.find((entry) => entry.id === player.teamId);

              return (
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
                        #{player.jerseyNumber} · {player.position} · {player.school || "School coming soon"}
                      </p>
                      {player.isAlumni === true && (
                        <p className="text-sm text-[color:var(--muted)]">
                          Alumni{player.college ? ` · ${player.college}` : ""}
                        </p>
                      )}
                      <p className="text-sm text-[color:var(--muted)]">
                        Team: {team?.name ?? player.teamId}
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
              );
            })}
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
