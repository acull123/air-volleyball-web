import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { coaches, privateLessonPackages } from "../mock/data";

export default function PrivateLessonsPage() {
  return (
    <>
      <PageHero
        eyebrow="Private Lessons"
        title="Book Focused Skill Work"
        description="Private lessons give athletes a faster feedback loop with targeted reps, position-specific coaching, and scheduling flexibility."
        actions={[
          { href: "/register", label: "Request A Lesson" },
          { href: "/training", label: "Back To Training", variant: "secondary" },
        ]}
      />

      <SectionCard title="Lesson Options" kicker="Available Formats">
        <div className="grid gap-5 lg:grid-cols-3">
          {privateLessonPackages.map((pkg) => {
            const coach = coaches.find((entry) => entry.id === pkg.coachId);

            return (
              <div
                key={pkg.id}
                className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
              >
                <h2 className="text-2xl font-bold text-[color:var(--ink)]">{pkg.title}</h2>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {pkg.format} · {pkg.duration}
                </p>
                <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{pkg.focus}</p>
                <div className="mt-5 space-y-2 text-sm text-[color:var(--muted)]">
                  <p>
                    <span className="font-semibold text-[color:var(--ink)]">Coach:</span>{" "}
                    {coach?.firstName} {coach?.lastName}
                  </p>
                  <p>
                    <span className="font-semibold text-[color:var(--ink)]">Price:</span> {pkg.price}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Lesson Request Form" kicker="Athlete Intake">
        <form className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            Athlete name
            <input className="rounded-2xl border border-[color:var(--line)] px-4 py-3" placeholder="Ava Johnson" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            Parent email
            <input className="rounded-2xl border border-[color:var(--line)] px-4 py-3" placeholder="parent@email.com" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            Skill focus
            <input className="rounded-2xl border border-[color:var(--line)] px-4 py-3" placeholder="Serving, setting, defense" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            Preferred format
            <select className="rounded-2xl border border-[color:var(--line)] px-4 py-3">
              <option>Single Athlete Session</option>
              <option>Partner Lesson</option>
              <option>Small Group Accelerator</option>
            </select>
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
            Availability
            <textarea
              className="min-h-32 rounded-2xl border border-[color:var(--line)] px-4 py-3"
              placeholder="Share preferred days, times, and any coach requests."
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66]"
            >
              Submit Lesson Request
            </button>
          </div>
        </form>
      </SectionCard>
    </>
  );
}
