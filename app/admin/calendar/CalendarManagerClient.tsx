"use client";

import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import ClubCalendar from "@/app/components/ClubCalendar";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";

export default function CalendarManagerClient() {
  const events = useFirestoreCollection("events");
  const teams = useFirestoreCollection("teams");
  const conflicts = useFirestoreCollection("conflicts");

  async function updateEventTime(eventId: string, startTime: string) {
    await firestoreApi.events.update(eventId, { startTime });
  }

  const loading = events.loading || teams.loading || conflicts.loading;
  const error = events.error || teams.error || conflicts.error;

  return (
    <>
      <PageHero
        eyebrow="Scheduling"
        title="Club Calendar"
        description="Review team events and family conflicts in a large monthly scheduling view."
        actions={[
          { href: "/admin/dashboard", label: "Admin Dashboard" },
          { href: "/admin/events", label: "Manage Events", variant: "secondary" },
        ]}
      />

      {error ? (
        <SectionCard title="Calendar Unavailable" kicker="Scheduling">
          <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
            {error}
          </div>
        </SectionCard>
      ) : (
        <ClubCalendar
          events={events.data}
          teams={teams.data}
          conflicts={conflicts.data}
          loading={loading}
          onEventTimeSave={updateEventTime}
        />
      )}
    </>
  );
}
