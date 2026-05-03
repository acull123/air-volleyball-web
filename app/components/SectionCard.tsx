export default function SectionCard({
  title,
  kicker,
  headerAction,
  children,
}: {
  title: string;
  kicker?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-[color:var(--line)] bg-white p-6 shadow-[0_20px_50px_rgba(17,58,98,0.08)] lg:p-8">
      {kicker && (
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--muted)]">
          {kicker}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-[color:var(--ink)]">{title}</h2>
        {headerAction}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
