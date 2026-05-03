"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { hasAnyRole, useAuthSession } from "@/lib/firebase/auth";

type StaffAccessGateProps = {
  eyebrow: string;
  title: string;
  description: string;
  deniedMessage: string;
  children: React.ReactNode;
};

export default function StaffAccessGate({
  eyebrow,
  title,
  description,
  deniedMessage,
  children,
}: StaffAccessGateProps) {
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
          eyebrow={eyebrow}
          title={`Loading ${title}`}
          description={description}
        />
        <SectionCard title="Loading" kicker={title}>
          <p className="text-sm leading-7 text-[color:var(--muted)]">Loading your access...</p>
        </SectionCard>
      </>
    );
  }

  if (!hasAnyRole(access.authUser?.profile ?? null, ["admin", "coach"])) {
    return (
      <>
        <PageHero
          eyebrow={eyebrow}
          title="Redirecting"
          description="Returning you to the sign-in page."
        />
        <SectionCard title="Redirecting" kicker={title}>
          <p className="text-sm leading-7 text-[color:var(--muted)]">{deniedMessage}</p>
        </SectionCard>
      </>
    );
  }

  return <>{children}</>;
}
