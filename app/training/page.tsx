import Link from "next/link";
import EventCard from "../components/EventCard";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { camps, events, trainingPrograms } from "../mock/data";

const trainingEvents = events.filter((event) => event.eventType === "camp" || event.eventType === "lesson");

export default function TrainingPage() {
  return (
    <>
      <PageHero
        eyebrow="Training Page"
        title="Camps And Skill Development"
        description="The training page gives families a direct place to review camp offerings, development tracks, and open sessions before they register."
        actions={[
          { href: "/register", label: "Register For Training" },
          { href: "/private-lessons", label: "Explore Private Lessons", variant: "secondary" },
        ]}
      />

      <SectionCard title="Open Camps" kicker="Seasonal Registration">
        <div className="grid gap-5 lg:grid-cols-3">
          {camps.map((camp) => (
            <div
              key={camp.id}
              className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
            >
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {camp.season}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">{camp.title}</h2>
              <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                <p>{camp.dateLabel}</p>
                <p>{camp.ageRange}</p>
                <p>{camp.location}</p>
                <p className="font-semibold text-[color:var(--ink)]">{camp.price}</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{camp.focus}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {camp.spotsLeft} spots left
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Training Tracks" kicker="Program Types">
          <div className="space-y-4">
            {trainingPrograms.map((program) => (
              <div
                key={program.id}
                className="rounded-[1.5rem] border border-[color:var(--line)] px-5 py-4"
              >
                <h3 className="text-lg font-bold text-[color:var(--ink)]">{program.title}</h3>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {program.audience} · {program.cadence}
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{program.summary}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Calendar Preview" kicker="Upcoming Training">
          <div className="grid gap-4 md:grid-cols-2">
            {trainingEvents.map((event) => (
              <EventCard key={event.id} e={event} />
            ))}
          </div>
          <Link
            href="/register"
            className="mt-6 inline-flex rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66]"
          >
            Continue To Registration
          </Link>
        </SectionCard>
      </div>
    </>
  );
}
