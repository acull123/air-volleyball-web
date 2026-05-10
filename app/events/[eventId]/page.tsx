"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { formatEventStatus, getEventStatus, shouldShowEventStatus } from "@/lib/event-status";
import { getEventTeamSchedules } from "@/lib/event-teams";
import { useFirestoreDocument, useFirestoreCollection } from "@/lib/firebase";
import type { EventDocument } from "@/lib/firebase/schema";
import { toExternalHref } from "@/lib/url";

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate) {
    return "Date coming soon";
  }

  const start = new Date(startDate);
  const end = new Date(endDate || startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startDate, endDate].filter(Boolean).join(" to ");
  }

  const formatter: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };

  if (startDate === (endDate || startDate)) {
    return start.toLocaleDateString(undefined, formatter);
  }

  return `${start.toLocaleDateString(undefined, formatter)} to ${end.toLocaleDateString(undefined, formatter)}`;
}

function formatEventTime(time: string) {
  if (!time) {
    return "Time coming soon";
  }

  const [hourRaw = "0", minuteRaw = "00"] = time.split(":");
  const hourValue = Number(hourRaw);

  if (Number.isNaN(hourValue)) {
    return time;
  }

  const meridiem = hourValue >= 12 ? "PM" : "AM";
  const hour12 = hourValue % 12 || 12;

  return `${hour12}:${minuteRaw} ${meridiem}`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

function formatEventType(type: EventDocument["type"]) {
  if (type === "areaCamp") {
    return "Area Camp";
  }

  if (type === "refScoringClinic") {
    return "Ref And Scoring Clinic";
  }

  if (type === "tryout") {
    return "Tryout";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function EventDetailsPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const event = useFirestoreDocument("events", eventId, { enabled: Boolean(eventId) });
  const teams = useFirestoreCollection("teams");

  const teamSchedules = event.data ? getEventTeamSchedules(event.data) : [];
  const eventStatus = event.data ? getEventStatus(event.data) : "none";

  return (
    <>
      <PageHero
        eyebrow="Event Details"
        title={event.data?.title || "Loading Event"}
        description="Review event dates, location, team details, and registration links."
        actions={[
          { href: "/", label: "Back To Home" },
          { href: "/training", label: "View Training", variant: "secondary" },
        ]}
      />

      <SectionCard title={event.data?.title || "Event Information"} kicker="Event Details">
        {event.loading || teams.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading event details...
          </div>
        ) : event.error || teams.error || !event.data ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Event details are unavailable right now.
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {formatEventType(event.data.type)}
              </p>
              <div className="mt-5 space-y-3 text-sm leading-7 text-[color:var(--muted)]">
                <p>
                  <span className="font-semibold text-[color:var(--ink)]">Dates:</span>{" "}
                  {formatDateRange(event.data.startDate, event.data.endDate)}
                </p>
                <p>
                  <span className="font-semibold text-[color:var(--ink)]">Time:</span>{" "}
                  {formatEventTime(event.data.startTime)}
                </p>
                <p>
                  <span className="font-semibold text-[color:var(--ink)]">Location:</span>{" "}
                  {event.data.location || "Location coming soon"}
                </p>
                {shouldShowEventStatus(eventStatus) && (
                  <p>
                    <span className="font-semibold text-[color:var(--ink)]">Status:</span>{" "}
                    {formatEventStatus(eventStatus)}
                  </p>
                )}
                {teamSchedules.length > 0 && (
                  <div>
                    <span className="font-semibold text-[color:var(--ink)]">Team schedules:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {teamSchedules.map((entry) => {
                        const teamName = teams.data.find((team) => team.id === entry.teamId)?.name ?? "Team";

                        return entry.scheduleUrl ? (
                          <a
                            key={entry.teamId}
                            href={toExternalHref(entry.scheduleUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-[color:var(--line)] px-3 py-1 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                          >
                            {teamName}
                          </a>
                        ) : (
                          <span
                            key={entry.teamId}
                            className="rounded-full bg-[color:var(--paper)] px-3 py-1 text-sm font-semibold text-[color:var(--ink)]"
                          >
                            {teamName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {event.data.ageGroup && (
                  <p>
                    <span className="font-semibold text-[color:var(--ink)]">Age group:</span> {event.data.ageGroup}
                  </p>
                )}
                <p>
                  <span className="font-semibold text-[color:var(--ink)]">Fee:</span>{" "}
                  {formatMoney(event.data.price ?? 0)}
                </p>
              </div>
              {event.data.notes && (
                <p className="mt-6 text-sm leading-7 text-[color:var(--muted)]">{event.data.notes}</p>
              )}
            </div>

            <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Next Step
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {(event.data.type === "camp" || event.data.type === "tryout") && (
                  <Link
                    href={`/register?event=${event.data.id}`}
                    className="inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-white"
                  >
                    Register For This Event
                  </Link>
                )}
                {event.data.externalUrl && (
                  <a
                    href={toExternalHref(event.data.externalUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-white"
                  >
                    Open External Link
                  </a>
                )}
                {event.data.paymentUrl && (
                  <a
                    href={toExternalHref(event.data.paymentUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-white"
                  >
                    Open Payment Link
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
}
