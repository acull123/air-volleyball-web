"use client";

import { useState } from "react";
import Link from "next/link";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { formatEventStatus, getEventStatus, shouldShowEventStatus } from "@/lib/event-status";
import { getEventTeamSchedules } from "@/lib/event-teams";
import { useFirestoreDocument, useFirestoreCollection } from "@/lib/firebase";
import type { EventDocument } from "@/lib/firebase/schema";
import { formatTournamentEventLabel, isTournamentEventType } from "@/lib/tournament-events";

function getEventIdFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }

  const searchParam = new URLSearchParams(window.location.search).get("eventId");

  if (searchParam) {
    return searchParam;
  }

  const [, eventsSegment, eventId] = window.location.pathname.split("/");

  return eventsSegment === "events" ? eventId ?? "" : "";
}

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

function formatAgeGroups(event: EventDocument) {
  const ageGroups = event.ageGroups?.length ? event.ageGroups : event.ageGroup ? [event.ageGroup] : [];

  return ageGroups.length > 0 ? ageGroups.join(", ") : "";
}

export default function EventDetailsPage() {
  const [eventId] = useState(getEventIdFromLocation);

  const event = useFirestoreDocument("events", eventId, { enabled: Boolean(eventId) });
  const teams = useFirestoreCollection("teams");

  const teamSchedules = event.data ? getEventTeamSchedules(event.data) : [];
  const eventStatus = event.data ? getEventStatus(event.data) : "none";
  const fullDetails = event.data?.fullDetails?.trim() ?? "";
  const ageGroupLabel = event.data ? formatAgeGroups(event.data) : "";

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
        {!eventId ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Event details are unavailable right now.
          </div>
        ) : event.loading || teams.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading event details...
          </div>
        ) : event.error || teams.error || !event.data ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Event details are unavailable right now.
          </div>
        ) : (
          <div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {isTournamentEventType(event.data.type)
                  ? formatTournamentEventLabel(event.data)
                  : formatEventType(event.data.type)}
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

                        return (
                          <Link
                            key={entry.teamId}
                            href={`/team-schedule?team=${entry.teamId}`}
                            className="rounded-full border border-[color:var(--line)] px-3 py-1 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                          >
                            {teamName}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                {ageGroupLabel && (
                  <p>
                    <span className="font-semibold text-[color:var(--ink)]">Age group:</span> {ageGroupLabel}
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
              {fullDetails && (
                <div className="mt-8 rounded-3xl border border-[color:var(--line)] bg-white p-6">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Full Details
                  </p>
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[color:var(--muted)]">
                    {fullDetails}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
}
