import Link from "next/link";
import { siteNav } from "../mock/data";

export default function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--line)] bg-[color:var(--paper)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr_0.9fr] lg:px-6">
        <div className="space-y-3">
          <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.18em] text-[color:var(--ink)]">
            Air Volleyball
          </p>
          <p className="max-w-md text-sm leading-6 text-[color:var(--muted)]">
            Youth volleyball development in the Chippewa Valley with team training,
            camps, private lessons, and parent-friendly season management.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Explore
          </p>
          <div className="flex flex-col gap-2 text-sm">
            {siteNav.slice(1, 7).map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[color:var(--accent-strong)]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Contact
          </p>
          <div className="space-y-2 text-sm text-[color:var(--muted)]">
            <p>info@airvolleyballclub.com</p>
            <p>Chippewa Valley, Wisconsin</p>
            <p>Parents and athletes can use the portal to manage schedules and invoices.</p>
          </div>
        </div>
      </div>

    </footer>
  );
}
