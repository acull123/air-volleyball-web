"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminDashboardContent from "../AdminDashboardContent";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { hasAnyRole, useAuthSession } from "@/lib/firebase/auth";

export default function AdminDashboardGate() {
  const router = useRouter();
  const access = useAuthSession();

  useEffect(() => {
    if (!access.loading && !hasAnyRole(access.authUser?.profile ?? null, ["admin", "coach"])) {
      router.replace("/admin");
    }
  }, [access.authUser, access.loading, router]);

  if (access.loading) {
    return (
      <>
        <PageHero
          eyebrow="Admin Dashboard"
          title="Loading Admin Access"
          description="Verifying your account and role."
        />
        <SectionCard title="Loading" kicker="Admin Access">
          <p className="text-sm leading-7 text-[color:var(--muted)]">Checking your admin session...</p>
        </SectionCard>
      </>
    );
  }

  if (!access.authUser || !hasAnyRole(access.authUser.profile, ["admin", "coach"])) {
    return (
      <>
        <PageHero
          eyebrow="Admin Dashboard"
          title="Redirecting"
          description="Returning you to the admin sign-in page."
        />
        <SectionCard title="Redirecting" kicker="Admin Access">
          <p className="text-sm leading-7 text-[color:var(--muted)]">You do not have staff access.</p>
        </SectionCard>
      </>
    );
  }

  return <AdminDashboardContent role={access.authUser.profile.role} />;
}
