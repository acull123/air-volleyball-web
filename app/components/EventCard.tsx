import Link from "next/link";
import type { Event } from "../types/models";
import Badge from "./Badge";

const colorByType: Record<Event["eventType"], string> = {
  practice:   "bg-blue-50 text-blue-700",
  tournament: "bg-red-50 text-red-700",
  camp:       "bg-amber-50 text-amber-800",
  clinic:     "bg-cyan-50 text-cyan-700",
  tryouts:    "bg-emerald-50 text-emerald-700",
  lesson:     "bg-purple-50 text-purple-700",
};

export default function EventCard({
  e,
  onClick,
  variant = "default",
}: {
  e: Event;
  onClick?: () => void;
  variant?: "default" | "home";
}) {
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  const date = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  const isHomeVariant = variant === "home";
  const statusLabel = e.status && e.status !== "none" ? e.status : "";

  const content = (
    <article
      className={`group flex h-full cursor-pointer flex-col rounded-[1.75rem] border border-[color:var(--line)] px-5 py-5 transition ${
        isHomeVariant
          ? "!border-[#b8dcff] bg-[color:var(--paper)] hover:!border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)]"
          : "bg-white hover:bg-[color:var(--paper)]"
      }`}
      onClick={onClick}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${colorByType[e.eventType]}`}>
              {e.eventType}
            </span>
          </Badge>
          {statusLabel && (
            <Badge>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                {statusLabel}
              </span>
            </Badge>
          )}
        </div>
        <div
          className={`text-xs font-semibold uppercase tracking-[0.14em] ${
            isHomeVariant ? "text-[color:var(--muted)] group-hover:text-[#d0deed]" : "text-[color:var(--muted)]"
          }`}
        >
          {date}
        </div>
      </div>
      <h3
        className={`text-2xl font-bold leading-snug ${
          isHomeVariant ? "text-[color:var(--ink)] group-hover:text-white" : "text-[color:var(--ink)]"
        }`}
      >
        {e.eventName}
      </h3>
      <div
        className={`mt-4 space-y-2 text-sm ${
          isHomeVariant ? "text-[color:var(--muted)] group-hover:text-[#d7e5f2]" : "text-[color:var(--muted)]"
        }`}
      >
        <p>{time}</p>
        {e.location && <p>{e.location}</p>}
      </div>
      {e.description && (
        <p
          className={`mt-4 line-clamp-3 text-sm leading-7 ${
            isHomeVariant ? "text-[color:var(--muted)] group-hover:text-[#d7e5f2]" : "text-[color:var(--muted)]"
          }`}
        >
          {e.description}
        </p>
      )}
    </article>
  );

  if (e.href) {
    return (
      <Link href={e.href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}
