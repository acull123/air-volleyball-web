"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { hasAnyRole, isRole, signInUser, useAuthSession } from "@/lib/firebase/auth";

export default function AdminGate() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const access = useAuthSession();

  useEffect(() => {
    if (access.authUser && isRole(access.authUser.profile, "admin")) {
      router.replace("/admin/dashboard");
    }
    if (access.authUser && isRole(access.authUser.profile, "coach")) {
      router.replace("/admin/dashboard");
    }
  }, [access.authUser, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      await signInUser(email, password);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  if (access.loading) {
    return (
      <>
        <PageHero
          eyebrow="Admin Page"
          title="Admin Login"
          description="Checking your sign-in and access level."
        />
        <SectionCard title="Loading" kicker="Admin Access">
          <p className="text-sm leading-7 text-[color:var(--muted)]">Verifying admin access...</p>
        </SectionCard>
      </>
    );
  }

  if (access.authUser && isRole(access.authUser.profile, "admin")) {
    return null;
  }

  if (access.authUser && isRole(access.authUser.profile, "coach")) {
    return null;
  }

  return (
    <>
      <PageHero
        eyebrow="Admin Page"
        title="Admin Login"
        description="Approved club staff can sign in here to manage Air Volleyball website content and updates."
      />

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Sign In" kicker="Staff Access">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Email <span className="text-[#b42318]">*</span>
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="admin@airvolleyball.com"
                type="email"
                autoComplete="email"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              <span>
                Password <span className="text-[#b42318]">*</span>
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Admin Access" kicker="Need Access?">
          <div className="space-y-4 text-sm leading-7 text-[color:var(--muted)]">
            <p>
              Admin access is restricted to approved club staff accounts.
            </p>
            <p>
              Contact Ryan Foster to request access to an admin role for the Air Volleyball site.
            </p>
            <p>
              Email:{" "}
              <a className="font-semibold text-[color:var(--ink)]" href="mailto:ryan@airvolleyball.com">
                ryan@airvolleyball.com
              </a>
            </p>
            {access.authUser && !hasAnyRole(access.authUser.profile, ["admin", "coach"]) && (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4 text-[color:var(--ink)]">
                Signed in as {access.authUser.firebaseUser.email}, but this account does not have admin access.
              </div>
            )}
            {(submitError ?? access.error) && (
              <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-[#8a2d2d]">
                {submitError ?? access.error}
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
