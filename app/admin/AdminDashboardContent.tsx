"use client";

import Link from "next/link";
import AccessManager from "./AccessManager";
import PageHero from "../components/PageHero";
import SectionCard from "../components/SectionCard";
import { adminTasks } from "../mock/data";
import type { UserRole } from "@/lib/firebase/schema";

type AdminDashboardContentProps = {
  role: UserRole;
};

export default function AdminDashboardContent({ role }: AdminDashboardContentProps) {
  const isAdmin = role === "admin";

  return (
    <>
      <PageHero
        eyebrow="Admin Page"
        title="Club Management"
        description="This admin page centralizes schedule publishing, conflict review, and registration controls so staff can manage public content quickly."
        actions={[
          { href: "/profile", label: "View Profile" },
          { href: "/register", label: "Review Registration Flow", variant: "secondary" },
        ]}
      />

      <SectionCard title="Primary Admin Actions" kicker="Content Controls">
        <div className="grid gap-5 lg:grid-cols-3">
          <Link
            href="/admin/players"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Manage players</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              Add, edit, and remove player records for current rosters.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open player manager
            </div>
          </Link>

          <Link
            href="/admin/teams"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Manage teams</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              Add, edit, and remove teams while assigning players and coaches.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open team manager
            </div>
          </Link>

          <Link
            href="/admin/coaches"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Manage coaches</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              Add, edit, and remove coach records for current staff.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open coach manager
            </div>
          </Link>

          {adminTasks.map((task) => (
            task.id === "ad3" ? (
              <Link
                key={task.id}
                href="/admin/registrations"
                className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
              >
                <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">{task.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">{task.detail}</p>
                <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
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

      <SectionCard title="Finances" kicker="Expense Tracking">
        <div className="grid gap-5 lg:grid-cols-3">
          <Link
            href="/admin/finances/expense-reports"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Expense reports</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              {isAdmin
                ? "Review coach expense reports and accept, reject, or pay pending submissions."
                : "Submit expense reports and review the status of your submissions."}
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open expense reports
            </div>
          </Link>
        </div>
      </SectionCard>

      <SectionCard title="Scheduling" kicker="Planning Tools">
        <div className="grid gap-5 lg:grid-cols-4">
          <Link
            href="/admin/events"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Manage events</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              Create tournaments, camps, tryouts, and published team events.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open event manager
            </div>
          </Link>

          <Link
            href="/admin/gym-spaces"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Manage gym spaces</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              Track facilities, courts, and available practice windows.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open gym manager
            </div>
          </Link>

          <Link
            href="/admin/conflicts"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Review conflicts</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              Review blocked times submitted by players and families.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open conflict manager
            </div>
          </Link>

          <Link
            href="/admin/practice-planning"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Practice planning</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              Set team practice needs and review suggested time slots.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open practice planner
            </div>
          </Link>
        </div>
      </SectionCard>

      <SectionCard title="Dashboards" kicker="Club View">
        <div className="grid gap-5 lg:grid-cols-3">
          <Link
            href="/admin/dashboards"
            className="group rounded-[1.75rem] border border-[color:var(--line)] bg-white px-5 py-5 transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          >
            <h2 className="text-2xl font-bold text-[color:var(--ink)] group-hover:text-white">Where we are</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] group-hover:text-[#d7e5f2]">
              Placeholder for future club dashboard views.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] group-hover:border-white/30 group-hover:text-white">
              Open dashboards
            </div>
          </Link>
        </div>
      </SectionCard>

      {isAdmin && <AccessManager />}
    </>
  );
}
