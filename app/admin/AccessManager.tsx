"use client";

import { useState, type FormEvent } from "react";
import SectionCard from "../components/SectionCard";
import { firestoreApi, type UserRole, useFirestoreCollection } from "@/lib/firebase";

const roleOptions: UserRole[] = ["admin", "coach", "parent", "player"];

export default function AccessManager() {
  const users = useFirestoreCollection("users");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("parent");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedUsers = [...users.data].sort((a, b) => {
    if (a.role === b.role) {
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
    }

    return a.role.localeCompare(b.role);
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      // TODO: Replace this placeholder with the server-side account-creation call.
      // That call should create the sign-in account, return the new account id,
      // and then create the matching role/profile record in the database.
      setMessage("New account setup will be connected here next.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to continue.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(targetUid: string) {
    const confirmed = window.confirm(
      "Delete this access record? This removes the site role record but does not remove the sign-in account itself.",
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setError(null);

    try {
      await firestoreApi.users.remove(targetUid);
      setMessage("Access profile deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete access profile.");
    }
  }

  return (
    <SectionCard title="Account Access Manager" kicker="Roles">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <p className="text-sm leading-7 text-[color:var(--muted)]">
            Use this section to manage account access for staff, parents, players, and coaches.
          </p>
          <p className="text-sm leading-7 text-[color:var(--muted)]">
            New account setup will be connected here next. For now, this area shows the fields that
            will be used once that setup flow is in place.
          </p>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Email <span className="text-[#b42318]">*</span>
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="user@airvolleyball.com"
                type="email"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                First name
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Last name
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Phone
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Role
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Working..." : "Create Account"}
              </button>
              {message && <span className="text-sm text-[color:var(--muted)]">{message}</span>}
            </div>

            {error && (
              <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                {error}
              </div>
            )}
          </form>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Current Access Profiles
          </p>

          {users.loading && (
            <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
              Loading user access records...
            </div>
          )}

          {users.error && (
            <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
              {users.error}
            </div>
          )}

          <div className="space-y-3">
            {sortedUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-[color:var(--ink)]">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">{user.email}</p>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      {user.role}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDelete(user.id)}
                    className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                  >
                    Delete Access
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
