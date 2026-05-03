"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminDashboardContent from "../AdminDashboardContent";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { isRole, useAuthSession } from "@/lib/firebase/auth";

export default function AdminDashboardGate() {
  const router = useRouter();
  const access = useAuthSession();

  useEffect(() => {
    if (!access.loading && (!access.authUser || !isRole(access.authUser.profile, "admin"))) {
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

  if (!access.authUser || !isRole(access.authUser.profile, "admin")) {
    return (
      <>
        <PageHero
          eyebrow="Admin Dashboard"
          title="Redirecting"
          description="Returning you to the admin sign-in page."
        />
        <SectionCard title="Redirecting" kicker="Admin Access">
          <p className="text-sm leading-7 text-[color:var(--muted)]">You do not have admin access.</p>
        </SectionCard>
      </>
    );
  }

  return <AdminDashboardContent />;
}
