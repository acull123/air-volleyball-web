"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { signOutUser, updateUserProfileFields, useAuthSession } from "@/lib/firebase/auth";

export default function ProfilePageClient() {
  const access = useAuthSession();
  const [draft, setDraft] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
  }>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!access.authUser) {
      setError("You must be signed in to update your profile.");
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const resolvedFirstName = draft.firstName ?? access.authUser.profile?.firstName ?? "";
      const resolvedLastName = draft.lastName ?? access.authUser.profile?.lastName ?? "";
      const resolvedPhone = draft.phone ?? access.authUser.profile?.phone ?? "";

      await updateUserProfileFields({
        uid: access.authUser.firebaseUser.uid,
        email: access.authUser.firebaseUser.email ?? access.authUser.profile?.email ?? "",
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        phone: resolvedPhone,
      });
      setDraft({});
      setStatus("Profile updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (access.loading) {
    return (
      <>
        <PageHero
          eyebrow="Profile"
          title="Loading Profile"
          description="Checking your signed-in account."
        />
        <SectionCard title="Loading" kicker="Account">
          <p className="text-sm leading-7 text-[color:var(--muted)]">Loading your profile...</p>
        </SectionCard>
      </>
    );
  }

  if (!access.authUser) {
    return (
      <>
        <PageHero
          eyebrow="Profile"
          title="Sign In Required"
          description="You need to sign in before you can edit your account information."
        />
        <SectionCard title="Account Access" kicker="Sign In">
          <div className="space-y-4 text-sm leading-7 text-[color:var(--muted)]">
            <p>Sign in through the appropriate portal, then return here to manage your profile.</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)] hover:!text-white"
              >
                Player Portal
              </Link>
              <Link
                href="/admin"
                className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                Admin Login
              </Link>
            </div>
          </div>
        </SectionCard>
      </>
    );
  }

  const firstName = draft.firstName ?? access.authUser.profile?.firstName ?? "";
  const lastName = draft.lastName ?? access.authUser.profile?.lastName ?? "";
  const phone = draft.phone ?? access.authUser.profile?.phone ?? "";

  return (
    <>
      <PageHero
        eyebrow="Profile"
        title="Your Account"
        description="Manage the contact information connected to your signed-in Air Volleyball account."
        actions={access.authUser.profile?.role === "admin" ? [{ href: "/admin/dashboard", label: "Admin Dashboard" }] : []}
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Profile Details" kicker="Edit Information">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              First name
              <input
                value={firstName}
                onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Last name
              <input
                value={lastName}
                onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Email
              <input
                value={access.authUser.firebaseUser.email ?? access.authUser.profile?.email ?? ""}
                disabled
                className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3 text-[color:var(--muted)]"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Phone
              <input
                value={phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                Sign Out
              </button>
              {status && <span className="text-sm text-[color:var(--muted)]">{status}</span>}
            </div>
            {error && (
              <div className="md:col-span-2 rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
                {error}
              </div>
            )}
          </form>
        </SectionCard>

        <SectionCard title="Account Summary" kicker="Role">
          <div className="space-y-4 text-sm leading-7 text-[color:var(--muted)]">
            <p>
              Signed in as <span className="font-semibold text-[color:var(--ink)]">{access.authUser.firebaseUser.email}</span>
            </p>
            <p>
              Role: <span className="font-semibold uppercase text-[color:var(--ink)]">{access.authUser.profile?.role ?? "unassigned"}</span>
            </p>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
