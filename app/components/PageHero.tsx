import Link from "next/link";

type HeroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export default function PageHero({
  eyebrow,
  title,
  description,
  actions = [],
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: HeroAction[];
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.28),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.26),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)] px-6 py-12 text-white shadow-[0_24px_70px_rgba(12,29,50,0.2)] lg:px-10 lg:py-14">
      <div className="relative max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#d0deed]">{eyebrow}</p>
        <h1 className="mt-4 font-[family:var(--font-display)] text-5xl uppercase leading-none tracking-[0.06em] lg:text-7xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[#d7e5f2] lg:text-lg">
          {description}
        </p>
        {actions.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={
                  action.variant === "secondary"
                    ? "rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    : "rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[#ffc469]"
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
