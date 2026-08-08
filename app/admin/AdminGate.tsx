"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { isRole, useAuthSession } from "@/lib/firebase/auth";

export default function AdminGate() {
  const router = useRouter();
  const access = useAuthSession();
  const hasAdminAccess = isRole(access.authUser?.profile ?? null, "admin");

  useEffect(() => {
    if (access.loading) {
      return;
    }

    router.replace(hasAdminAccess ? "/admin/dashboard" : "/login");
  }, [access.loading, hasAdminAccess, router]);

  return (
    <>
      <PageHero
        eyebrow="Portal"
        title="Redirecting"
        description="Taking you to the right Air Volleyball account area."
      />
      <SectionCard title="Redirecting" kicker="Account Access">
        <p className="text-sm leading-7 text-[color:var(--muted)]">
          {access.loading ? "Checking your account..." : "Sending you to the portal login."}
        </p>
      </SectionCard>
    </>
  );
}
