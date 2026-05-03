"use client";

import Link from "next/link";
import AccessManager from "./AccessManager";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { adminTasks } from "../mock/data";

export default function AdminDashboardContent() {
  return (
    <>
      <PageHero
        eyebrow="Admin Page"
        title="Club Management"
        description="This admin page centralizes schedule publishing, alumni updates, and registration controls so staff can manage public content quickly."
        actions={[
          { href: "/profile", label: "View Profile" },
          { href: "/register", label: "Review Registration Flow", variant: "secondary" },
        ]}
      />

      <SectionCard title="Primary Admin Actions" kicker="Content Controls">
        <div className="grid gap-5 lg:grid-cols-3">
          <Link
            href="/admin/players"
            className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:bg-[color:var(--paper)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">Manage players</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              Add, edit, and remove player records for current rosters.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
              Open player manager
            </div>
          </Link>

          <Link
            href="/admin/teams"
            className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:bg-[color:var(--paper)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">Manage teams</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              Add, edit, and remove teams while assigning players and coaches.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
              Open team manager
            </div>
          </Link>

          <Link
            href="/admin/coaches"
            className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:bg-[color:var(--paper)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">Manage coaches</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              Add, edit, and remove coach records for current staff.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
              Open coach manager
            </div>
          </Link>

          {adminTasks.map((task) => (
            task.id === "ad3" ? (
              <Link
                key={task.id}
                href="/admin/registrations"
                className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:bg-[color:var(--paper)]"
              >
                <h2 className="text-2xl font-bold text-[color:var(--ink)]">{task.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{task.detail}</p>
                <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
                  {task.actionLabel}
                </div>
              </Link>
            ) : (
              <div
                key={task.id}
                className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5"
              >
                <h2 className="text-2xl font-bold text-[color:var(--ink)]">{task.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{task.detail}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
                    <input type="file" className="hidden" />
                    {task.actionLabel}
                  </label>
                </div>
              </div>
            )
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Scheduling" kicker="Planning Tools">
        <div className="grid gap-5 lg:grid-cols-4">
          <Link
            href="/admin/events"
            className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:bg-[color:var(--paper)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">Manage events</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              Create tournaments, camps, tryouts, and published team events.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
              Open event manager
            </div>
          </Link>

          <Link
            href="/admin/gym-spaces"
            className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:bg-[color:var(--paper)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">Manage gym spaces</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              Track facilities, courts, and available practice windows.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
              Open gym manager
            </div>
          </Link>

          <Link
            href="/admin/conflicts"
            className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:bg-[color:var(--paper)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">Review conflicts</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              Review blocked times submitted by players and families.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
              Open conflict manager
            </div>
          </Link>

          <Link
            href="/admin/practice-planning"
            className="rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:bg-[color:var(--paper)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">Practice planning</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              Set team practice needs and review suggested time slots.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
              Open practice planner
            </div>
          </Link>
        </div>
      </SectionCard>

      <AccessManager />
    </>
  );
}
