"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import TeamManagerClient from "./TeamManagerClient";
import { hasAnyRole, useAuthSession } from "@/lib/firebase/auth";

export default function TeamManagerGate() {
  const router = useRouter();
  const access = useAuthSession();

  useEffect(() => {
    if (!access.loading && !hasAnyRole(access.authUser?.profile ?? null, ["admin", "coach"])) {
      router.replace("/admin");
    }
  }, [access.authUser?.profile, access.loading, router]);

  if (access.loading) {
    return (
      <>
        <PageHero
          eyebrow="Team Manager"
          title="Loading Team Access"
          description="Checking your account before opening the team manager."
        />
        <SectionCard title="Loading" kicker="Team Manager">
          <p className="text-sm leading-7 text-[color:var(--muted)]">Loading your access...</p>
        </SectionCard>
      </>
    );
  }

  if (!hasAnyRole(access.authUser?.profile ?? null, ["admin", "coach"])) {
    return (
      <>
        <PageHero
          eyebrow="Team Manager"
          title="Redirecting"
          description="Returning you to the sign-in page."
        />
        <SectionCard title="Redirecting" kicker="Team Manager">
          <p className="text-sm leading-7 text-[color:var(--muted)]">You do not have access to manage teams.</p>
        </SectionCard>
      </>
    );
  }

  return <TeamManagerClient />;
}
