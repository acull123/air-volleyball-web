"use client";

import { useMemo, useState, type FormEvent } from "react";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import type { CoachDocument } from "@/lib/firebase/schema";

type CoachDraft = {
  firstName: string;
  lastName: string;
  title: string;
  teamIds: string[];
  bio: string;
  email: string;
  phone: string;
  active: boolean;
};

const emptyDraft: CoachDraft = {
  firstName: "",
  lastName: "",
  title: "",
  teamIds: [],
  bio: "",
  email: "",
  phone: "",
  active: true,
};

function getCoachTeamIds(coach: CoachDocument): string[] {
  if (Array.isArray((coach as CoachDocument & { teamIds?: string[] }).teamIds)) {
    return (coach as CoachDocument & { teamIds?: string[] }).teamIds.filter(Boolean);
  }

  const legacyTeamId = (coach as CoachDocument & { teamId?: string }).teamId;

  return legacyTeamId ? [legacyTeamId] : [];
}

function mapCoachToDraft(coach: CoachDocument): CoachDraft {
  return {
    firstName: coach.firstName,
    lastName: coach.lastName,
    title: coach.title,
    teamIds: getCoachTeamIds(coach),
    bio: coach.bio,
    email: coach.email,
    phone: coach.phone,
    active: coach.active,
  };
}

export default function CoachManagerClient() {
  const coaches = useFirestoreCollection("coaches");
  const teams = useFirestoreCollection("teams");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<CoachDraft>(emptyDraft);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredCoaches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sorted = [...coaches.data].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
    );

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((coach) => {
      const teamNames = getCoachTeamIds(coach)
        .map((teamId) => teams.data.find((team) => team.id === teamId)?.name ?? "")
        .join(" ");

      return [coach.firstName, coach.lastName, coach.title, coach.email, coach.phone, teamNames]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [coaches.data, searchTerm, teams.data]);

  function resetForm() {
    setSelectedCoachId(null);
    setDraft(emptyDraft);
    setSelectedPhotoName("");
  }

  function beginEdit(coach: CoachDocument) {
    setSelectedCoachId(coach.id);
    setDraft(mapCoachToDraft(coach));
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
        title: draft.title.trim(),
        teamIds: draft.teamIds,
        bio: draft.bio.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        // TODO: Replace this with the uploaded image URL once photo uploads are connected.
        photoUrl: "",
        active: draft.active,
      };

      if (!payload.firstName || !payload.lastName) {
        throw new Error("First name and last name are required.");
      }

      if (selectedCoachId) {
        await firestoreApi.coaches.update(selectedCoachId, payload);
        setStatus("Coach updated.");
      } else {
        await firestoreApi.coaches.create(payload);
        setStatus("Coach created.");
      }

      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save coach.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(coachId: string) {
    const confirmed = window.confirm("Delete this coach record?");

    if (!confirmed) {
      return;
    }

    setStatus(null);
    setError(null);

    try {
      await firestoreApi.coaches.remove(coachId);
      if (selectedCoachId === coachId) {
        resetForm();
      }
      setStatus("Coach deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete coach.");
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Coach Manager"
        title="Manage Coaches"
        description="Add new coaches, update coach details, and remove old records from the coach list."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title={selectedCoachId ? "Edit Coach" : "Add Coach"} kicker="Coach Details">
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
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Title (optional)
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Teams (optional)
              <div className="grid gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-4">
                {teams.data.length === 0 && (
                  <span className="text-sm font-medium text-[color:var(--muted)]">
                    Add teams before assigning coaches.
                  </span>
                )}
                {teams.data.map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-3 text-sm font-medium text-[color:var(--ink)]"
                  >
                    <input
                      type="checkbox"
                      checked={draft.teamIds.includes(team.id)}
                      onChange={(event) =>
                        setDraft((current) => ({
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
              Email (optional)
              <input
                value={draft.email}
                onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                type="email"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Phone (optional)
              <input
                value={draft.phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Bio (optional)
              <textarea
                value={draft.bio}
                onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Photo (optional)
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setSelectedPhotoName(event.target.files?.[0]?.name ?? "")}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
              <span className="text-xs font-medium text-[color:var(--muted)]">
                {selectedPhotoName ? `Selected: ${selectedPhotoName}` : "Choose a coach photo."}
              </span>
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              />
              Active coach
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : selectedCoachId ? "Save Changes" : "Add Coach"}
              </button>
              {selectedCoachId && (
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

        <SectionCard title="Current Coaches" kicker="Staff Records">
          <div className="mb-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Search coaches
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="Search by name, title, email, or phone"
              />
            </label>
          </div>
          <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
            {coaches.loading && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Loading coaches...
              </div>
            )}
            {!coaches.loading && filteredCoaches.length === 0 && (
              <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                No coaches match the current search.
              </div>
            )}
            {filteredCoaches.map((coach) => (
              <div key={coach.id} className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-[color:var(--ink)]">
                      {coach.firstName} {coach.lastName}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">{coach.title || "No title set"}</p>
                    <p className="text-sm text-[color:var(--muted)]">
                      Teams:{" "}
                      {getCoachTeamIds(coach)
                        .map((teamId) => teams.data.find((team) => team.id === teamId)?.name ?? "")
                        .filter(Boolean)
                        .join(", ") || "No teams assigned"}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      {coach.email || "No email set"}{coach.phone ? ` · ${coach.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => beginEdit(coach)}
                      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(coach.id)}
                      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
