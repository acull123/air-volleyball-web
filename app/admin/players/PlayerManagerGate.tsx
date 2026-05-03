"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import PlayerManagerClient from "./PlayerManagerClient";
import { hasAnyRole, useAuthSession } from "@/lib/firebase/auth";

export default function PlayerManagerGate() {
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
          eyebrow="Player Manager"
          title="Loading Player Access"
          description="Checking your account before opening the player manager."
        />
        <SectionCard title="Loading" kicker="Player Manager">
          <p className="text-sm leading-7 text-[color:var(--muted)]">Loading your access...</p>
        </SectionCard>
      </>
    );
  }

  if (!hasAnyRole(access.authUser?.profile ?? null, ["admin", "coach"])) {
    return (
      <>
        <PageHero
          eyebrow="Player Manager"
          title="Redirecting"
          description="Returning you to the sign-in page."
        />
        <SectionCard title="Redirecting" kicker="Player Manager">
          <p className="text-sm leading-7 text-[color:var(--muted)]">You do not have access to manage players.</p>
        </SectionCard>
      </>
    );
  }

  return <PlayerManagerClient />;
}
