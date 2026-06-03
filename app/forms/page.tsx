import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";

const formDownloads = [
  {
    title: "Concussion Agreement",
    description:
      "Wisconsin concussion fact sheet, parent agreement, athlete agreement, and emergency contact details.",
    href: "https://www.airvolleyball.com/_files/ugd/105f46_c874ab4f053943cabc2537f9967bb7d3.pdf",
    action: "Download Concussion Form",
  },
  {
    title: "Parent Medical Release Form",
    description:
      "Player medical release, emergency contacts, insurance details, and emergency care authorization.",
    href: "https://www.airvolleyball.com/_files/ugd/105f46_d9e514e8c7054652a3d9d56ba8f8c5cf.pdf",
    action: "Download Medical Release",
  },
];

export default function FormsPage() {
  return (
    <>
      <PageHero
        eyebrow="Club Forms"
        title="Forms"
        description="Download the required player forms, complete them, and bring signed copies to club staff."
      />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Required Forms" kicker="Download And Sign">
          <div className="grid gap-4">
            {formDownloads.map((form) => (
              <div
                key={form.href}
                className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-5"
              >
                <h2 className="text-2xl font-bold text-[color:var(--ink)]">{form.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{form.description}</p>
                <a
                  href={form.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[#ffc469]"
                >
                  {form.action}
                </a>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Conflict Resolution" kicker="Process">
          <div className="space-y-4 text-sm leading-7 text-[color:var(--muted)]">
            <p>The athlete should speak with the coach first regarding the matter.</p>
            <p>
              If the matter remains unresolved, the parent and athlete should request to meet with
              the coach. Coaches meet with parents only when the athlete is present, and not at a
              tournament.
            </p>
            <p>
              If the matter still remains unresolved, the parent can request a meeting with the club
              director, coach, and player. The player must be present.
            </p>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
