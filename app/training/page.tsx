"use client";

import Link from "next/link";
import { useMemo } from "react";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { formatEventStatus, getEventStatus, shouldShowEventStatus } from "@/lib/event-status";
import { getEventTeamLabel } from "@/lib/event-teams";
import { useFirestoreCollection } from "@/lib/firebase";
import { toExternalHref } from "@/lib/url";

function formatEventDateRange(startDate: string, endDate: string) {
  if (!startDate) {
    return "Date coming soon";
  }

  const start = new Date(startDate);
  const end = new Date(endDate || startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startDate, endDate].filter(Boolean).join(" to ");
  }

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  if ((endDate || startDate) === startDate) {
    return start.toLocaleDateString(undefined, options);
  }

  return `${start.toLocaleDateString(undefined, options)} to ${end.toLocaleDateString(undefined, options)}`;
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

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16v12H4z" />
      <path d="m4 8 8 6 8-6" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export default function TrainingPage() {
  const events = useFirestoreCollection("events");
  const coaches = useFirestoreCollection("coaches");
  const teams = useFirestoreCollection("teams");

  const airCampEvents = [...events.data]
    .filter((event) => event.active !== false)
    .filter((event) => event.type === "camp")
    .sort((left, right) =>
      `${left.startDate} ${left.startTime}`.localeCompare(`${right.startDate} ${right.startTime}`),
    );

  const areaCampEvents = [...events.data]
    .filter((event) => event.active !== false)
    .filter((event) => event.type === "areaCamp")
    .sort((left, right) =>
      `${left.startDate} ${left.startTime}`.localeCompare(`${right.startDate} ${right.startTime}`),
    );

  const lessonCoaches = useMemo(
    () =>
      [...coaches.data]
        .filter((coach) => coach.active !== false)
        .filter((coach) => (coach.privateLessonPriceSingle ?? 0) > 0 || (coach.privateLessonPricePair ?? 0) > 0)
        .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),
    [coaches.data],
  );

  return (
    <>
      <PageHero
        eyebrow="Training Page"
        title="Camps And Skill Development"
        description="Review current camp offerings, age group fit, dates, and pricing before heading into registration."
        actions={[
          { href: "/register", label: "Register For Training" },
          { href: "#private-lessons", label: "Explore Private Lessons", variant: "secondary" },
        ]}
      />

      <SectionCard title="Open Air Camps" kicker="Seasonal Registration">
        {events.loading || teams.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading camp events...
          </div>
        ) : events.error || teams.error ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Camp information is unavailable right now.
          </div>
        ) : airCampEvents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No Air camp events are open yet.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {airCampEvents.map((camp) => {
              const teamName = getEventTeamLabel(camp, teams.data);
              const status = getEventStatus(camp);

              return (
                <Link
                  key={camp.id}
                  href={`/register?event=${camp.id}`}
                  className="group flex h-full cursor-pointer flex-col rounded-[1.75rem] border border-[color:var(--line)] !border-[#b8dcff] bg-[color:var(--paper)] px-5 py-5 transition hover:!border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
                    {camp.ageGroup || "All ages"}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">{camp.title}</h2>
                  <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
                    <p>{formatEventDateRange(camp.startDate, camp.endDate)}</p>
                    <p>{formatEventTime(camp.startTime)}</p>
                    <p>{camp.location}</p>
                    <p>Audience: {teamName}</p>
                    {shouldShowEventStatus(status) && <p>Status: {formatEventStatus(status)}</p>}
                    <p className="font-semibold text-[color:var(--ink)] group-hover:text-white">
                      {formatMoney(camp.price ?? 0)}
                    </p>
                  </div>
                  {camp.notes && (
                    <p className="mt-4 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">{camp.notes}</p>
                  )}
                  <div className="mt-5 inline-flex w-fit self-start rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition group-hover:border-white/30 group-hover:text-white">
                    Register
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Area Camps" kicker="Outside Events">
        {events.loading || teams.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading area camps...
          </div>
        ) : events.error || teams.error ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Area camp information is unavailable right now.
          </div>
        ) : areaCampEvents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No area camps are listed yet.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {areaCampEvents.map((camp) => {
              const teamName = getEventTeamLabel(camp, teams.data);
              const status = getEventStatus(camp);

              return (
                camp.externalUrl ? (
                  <a
                    key={camp.id}
                    href={toExternalHref(camp.externalUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex h-full cursor-pointer flex-col rounded-[1.75rem] border border-[color:var(--line)] !border-[#b8dcff] bg-[color:var(--paper)] px-5 py-5 transition hover:!border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
                  >
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
                      {camp.ageGroup || "All ages"}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">{camp.title}</h2>
                    <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
                      <p>{formatEventDateRange(camp.startDate, camp.endDate)}</p>
                      <p>{formatEventTime(camp.startTime)}</p>
                      <p>{camp.location}</p>
                      <p>Audience: {teamName}</p>
                      {shouldShowEventStatus(status) && <p>Status: {formatEventStatus(status)}</p>}
                      <p className="font-semibold text-[color:var(--ink)] group-hover:text-white">
                        {formatMoney(camp.price ?? 0)}
                      </p>
                    </div>
                    {camp.notes && (
                      <p className="mt-4 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">{camp.notes}</p>
                    )}
                    <div className="mt-5 inline-flex w-fit items-center gap-2 self-start rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition group-hover:border-white/30 group-hover:text-white">
                      Open External Camp
                      <ExternalLinkIcon />
                    </div>
                  </a>
                ) : (
                  <div
                    key={camp.id}
                    className="rounded-[1.75rem] border border-[color:var(--line)] !border-[#b8dcff] bg-[color:var(--paper)] px-5 py-5"
                  >
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      {camp.ageGroup || "All ages"}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">{camp.title}</h2>
                    <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                      <p>{formatEventDateRange(camp.startDate, camp.endDate)}</p>
                      <p>{formatEventTime(camp.startTime)}</p>
                      <p>{camp.location}</p>
                      <p>Audience: {teamName}</p>
                      {shouldShowEventStatus(status) && <p>Status: {formatEventStatus(status)}</p>}
                      <p className="font-semibold text-[color:var(--ink)]">
                        {formatMoney(camp.price ?? 0)}
                      </p>
                    </div>
                    {camp.notes && (
                      <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{camp.notes}</p>
                    )}
                  </div>
                )
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Private Lessons" kicker="Available Coaches">
        <div id="private-lessons" className="scroll-mt-28">
          {coaches.loading ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Loading private lesson coaches...
            </div>
          ) : coaches.error ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Private lesson options are unavailable right now.
            </div>
          ) : lessonCoaches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              No coaches have private lesson pricing available yet.
            </div>
          ) : (
            <div className="space-y-4">
              {lessonCoaches.map((coach) => (
                <div
                  key={coach.id}
                  className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(17,58,98,0.04)] md:px-6"
                >
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-start">
                    <div className="lg:sticky lg:top-24">
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {coach.title || "Private lesson coach"}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold leading-tight text-[color:var(--ink)]">
                        {coach.firstName} {coach.lastName}
                      </h2>
                    </div>
                    <div>
                      {(coach.description || coach.bio) && (
                        <p className="text-sm leading-7 text-[color:var(--muted)]">
                          {coach.description || coach.bio}
                        </p>
                      )}
                      <div className="mt-5 rounded-[1.25rem] bg-[color:var(--paper)] px-4 py-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Hourly Lesson Rates
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                          {(coach.privateLessonPriceSingle ?? 0) > 0 && (
                            <p>
                              <span className="font-semibold text-[color:var(--ink)]">1 athlete:</span>{" "}
                              {formatMoney(coach.privateLessonPriceSingle)} / hour
                            </p>
                          )}
                          {(coach.privateLessonPricePair ?? 0) > 0 && (
                            <p>
                              <span className="font-semibold text-[color:var(--ink)]">2 athletes:</span>{" "}
                              {formatMoney(coach.privateLessonPricePair)} / hour
                            </p>
                          )}
                        </div>
                      </div>
                      {coach.email && (
                        <a
                          href={`mailto:${coach.email}`}
                          className="mt-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                          aria-label={`Email ${coach.firstName} ${coach.lastName}`}
                        >
                          <MailIcon />
                          Email coach
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </>
  );
}
