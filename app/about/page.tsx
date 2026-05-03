import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { alumni, coaches } from "../mock/data";

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

const testimonials = [
  "Families describe Air players as making a real difference in high-pressure matches because of their experience and skill growth.",
  "Parents also point to strong coaching and quality tournament experiences as reasons they would recommend the club to others in Eau Claire and the surrounding area.",
];

export default function AboutPage() {
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

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Club Mission" kicker="Official Site Content">
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

        <SectionCard title="Coaching Staff" kicker="Leadership">
          <div className="space-y-4">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="rounded-[1.5rem] border border-[color:var(--line)] px-5 py-4"
              >
                <h3 className="text-lg font-bold text-[color:var(--ink)]">
                  {coach.firstName} {coach.lastName}
                </h3>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {coach.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                  Specialties: {coach.specialties.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

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

      <SectionCard title="What People Say About Air" kicker="From The Current Site">
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
        <div className="grid gap-4 md:grid-cols-2">
          {alumni.map((entry) => (
            <div
              key={entry.id}
              className="rounded-[1.5rem] border border-[color:var(--line)] px-5 py-5"
            >
              <p className="text-lg font-bold text-[color:var(--ink)]">{entry.name}</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {entry.college} · {entry.position}
              </p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Class of {entry.gradYear}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
