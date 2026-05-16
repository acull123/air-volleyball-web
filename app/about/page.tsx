"use client";

import { useMemo } from "react";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { useFirestoreCollection } from "@/lib/firebase";
import { toExternalHref } from "@/lib/url";
import { comparePlayersByName } from "@/lib/player-name";
import { isAlumniPlayer } from "@/lib/player-status";

const pillars = [
  {
    title: "Best Coaches",
    copy: "The club has long emphasized strong coaching so athletes can learn, grow, and compete at a higher level.",
  },
  {
    title: "Learning And Fun",
    copy: "The official program message stresses both development and enjoyment so athletes want to keep improving.",
  },
  {
    title: "Accountability",
    copy: "Air athletes are expected to hold themselves and their teammates to a high standard of effort and commitment.",
  },
];
//Test deploy

const testimonials = [
  "Families describe Air players as making a real difference in high-pressure matches because of their experience and skill growth.",
  "Parents also point to strong coaching and quality tournament experiences as reasons they would recommend the club to others in Eau Claire and the surrounding area.",
];

function getGraduationYearFromBirthDate(birthDate: string) {
  const birthYear = Number(birthDate.split("-")[0]);

  return Number.isNaN(birthYear) ? null : birthYear + 18;
}

const recruitingSections = [
  {
    title: "Prepping for the process",
    copy: [
      "Education is the most important part of playing college volleyball. The environment which you will be involved in for the next few years will influence the person you become.",
      "If you have not already done so I would encourage you to sit down with your guardians and create a list of Colleges and the major you may be interested in. This list will be a good starting point at the very least.",
    ],
  },
  {
    title: "Level based on your skills and size",
    copy: [
      "This can be a hard fact to face but your skill and size do determine at what level you play and what college you may or may not be able to attend.",
      "One of the hardest things to figure out is where this level is for each athlete. I want to help you figure out where you may fit best!",
    ],
  },
  {
    title: "Create a recruiting profile",
    copy: [
      "One way coaches can find you is by your recruiting profile. College coaches will use this tool to research athletes they might be interested in. Maybe they saw a player at a game or tournament and wanted to see more or they contact the athlete or program via email.",
      "NCSA is one of the largest recruiting profiles that a lot of coaches use. Hudl is also a good resource to upload video to.",
    ],
    links: [
      { href: "https://www.ncsasports.org/", label: "NCSA Recruiting Profile" },
      { href: "https://www.hudl.com", label: "Hudl Video Platform" },
    ],
  },
  {
    title: "Get your measurables",
    copy: [
      "A lot of coaches like stats. Simple reason - they do not lie. Contact your high school coach to get your stats so you can add them to your profile. If you do not know them already it is ok.",
      "Other measurables that are good to know are your vertical jump, block jump and approach jump. If you do not know these yet and would like help with this please let me know and I can help you out with this.",
    ],
  },
  {
    title: "Create a highlight video",
    copy: [
      "This may be one of the most important aspects of the recruiting process. Coaches need to see what you have to offer. Coaches go through a lot of athletes, so you need to stand out.",
      "In my experience if I did not see something that stood out to me in the first 30 seconds I was moving on with the search. For this step of the process I want you to create a highlight video and send it to me.",
      "I will review it and make any suggestions that will hopefully get you noticed.",
    ],
  },
  {
    title: "Sending an Email of Interest",
    copy: [
      "After we have your recruiting profile set up and your highlights created we want to let the coach know you are interested.",
      "It is a myth that even great players will get noticed for just their play. Even great players need to let coaches know they are out there and they are interested in their program.",
      "I want you to create a draft email and send it to me as if I was the coach you want to play for. Again I would keep this pretty simple but highly impactful. You need to grab the coaches attention right away so they keep reading.",
    ],
    checklist: [
      "Name, club and team you are playing for, and high school",
      "Awards",
      "Recruiting profile link to highlights",
      "Why you are interested",
      "Major you are interested in",
      "Club tournament schedule or high school game schedule that they can come and watch",
      "Any other information about yourself that tells the coach about the person you are",
    ],
  },
  {
    title: "Attending college camps",
    copy: [
      "Once the process is underway, one of the best ways to get noticed is at their camps.",
      "Coaches hold camps for this very reason. They want to see people interested in their program and see what you have in person. This is a great opportunity to demonstrate your skills.",
    ],
  },
];

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
    month: "short",
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

export default function AboutPage() {
  const events = useFirestoreCollection("events");
  const players = useFirestoreCollection("players");
  const refScoringClinicEvents = useMemo(
    () =>
      [...events.data]
        .filter((event) => event.active !== false && event.type === "refScoringClinic")
        .sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`)),
    [events.data],
  );
  const alumniPlayers = useMemo(
    () => [...players.data].filter(isAlumniPlayer).sort(comparePlayersByName),
    [players.data],
  );

  return (
    <>
      <PageHero
        eyebrow="About Air"
        title="About Air Volleyball Club"
        description="The official club message centers on delivering the best volleyball club program in the Chippewa Valley through strong coaching, long-term athlete growth, and a high standard for effort."
        actions={[
          { href: "/teams", label: "Meet The Teams" },
          { href: "/login", label: "View Parent Portal", variant: "secondary" },
        ]}
      />

      <div className="grid gap-8">
        <SectionCard title="Club Mission" kicker="Purpose And Growth">
          <div className="space-y-4 text-sm leading-7 text-[color:var(--muted)]">
            <p>
              The live Air site describes the club as being dedicated to providing the best
              volleyball club program in the Chippewa Valley. It also emphasizes that the club
              has been serving the area for more than 25 years while continuing to evolve.
            </p>
            <p>
              The club messaging also frames Air as a place where athletes can become the best
              volleyball players they can be through a mix of learning, fun, and consistent
              expectations for growth and accountability.
            </p>
          </div>
        </SectionCard>

        <div id="ref-scoring-clinic" className="scroll-mt-28">
        <SectionCard title="Ref And Scoring Clinic" kicker="Upcoming Events">
          {events.loading ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Loading clinic events...
            </div>
          ) : events.error ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Clinic events are unavailable right now.
            </div>
          ) : refScoringClinicEvents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              No ref and scoring clinic events have been added yet.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {refScoringClinicEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {event.ageGroup || "All ages"}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">{event.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                    {formatDateRange(event.startDate, event.endDate)}
                  </p>
                  <div className="mt-5 space-y-2 text-sm text-[color:var(--muted)]">
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Start time:</span>{" "}
                      {formatEventTime(event.startTime)}
                    </p>
                    <p>
                      <span className="font-semibold text-[color:var(--ink)]">Location:</span>{" "}
                      {event.location || "Location coming soon"}
                    </p>
                    {typeof event.price === "number" && event.price > 0 && (
                      <p>
                        <span className="font-semibold text-[color:var(--ink)]">Fee:</span> $
                        {event.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                  {event.notes && (
                    <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{event.notes}</p>
                  )}
                  {(event.externalUrl || event.paymentUrl) && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {event.externalUrl && (
                        <a
                          href={toExternalHref(event.externalUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                        >
                          Learn more
                        </a>
                      )}
                      {event.paymentUrl && (
                        <a
                          href={toExternalHref(event.paymentUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                        >
                          Register
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        </div>
      </div>

      <SectionCard title="Recruiting Process" kicker="Step By Step">
        <div className="space-y-4">
          {recruitingSections.map((section) => (
            <div
              key={section.title}
              className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(17,58,98,0.04)] md:px-6"
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-start">
                <div className="lg:sticky lg:top-24">
                  <h3 className="text-2xl font-bold leading-tight text-[color:var(--ink)]">
                    {section.title}
                  </h3>
                </div>
                <div>
                  <div className="space-y-3 text-sm leading-7 text-[color:var(--muted)]">
                    {section.copy.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  {section.links && (
                    <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                      {section.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[color:var(--line)] px-3 py-2 text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                  {section.checklist && (
                    <ul className="mt-4 grid gap-x-6 gap-y-2 pl-5 text-sm leading-7 text-[color:var(--muted)] marker:text-[color:var(--ink)] md:grid-cols-2">
                      {section.checklist.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="What Families Can Expect" kicker="Club Standards">
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5"
            >
              <h3 className="text-lg font-bold text-[color:var(--ink)]">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{pillar.copy}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="What People Say About Air" kicker="Family Feedback">
        <div className="grid gap-4 md:grid-cols-2">
          {testimonials.map((item) => (
            <div
              key={item}
              className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5 text-sm leading-7 text-[color:var(--muted)]"
            >
              {item}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Alumni Spotlight" kicker="Next-Level Athletes">
        {players.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading alumni...
          </div>
        ) : players.error ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Alumni information is unavailable right now.
          </div>
        ) : alumniPlayers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No alumni players have been added yet.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {alumniPlayers.map((player) => {
              const graduationYear = getGraduationYearFromBirthDate(player.birthDate);

              return (
                <div
                  key={player.id}
                  className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {player.school || "Alumni"}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                    {player.firstName} {player.lastName}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                    {[player.college, player.position].filter(Boolean).join(" · ") || "College details coming soon"}
                  </p>
                  {graduationYear && (
                    <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
                      Year: {graduationYear}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}
