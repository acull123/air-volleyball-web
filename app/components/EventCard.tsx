import type { Event } from "../types/models";
import Badge from "./Badge";

const colorByType: Record<Event["eventType"], string> = {
  practice:   "bg-blue-50 text-blue-700",
  tournament: "bg-red-50 text-red-700",
  camp:       "bg-amber-50 text-amber-800",
  tryouts:    "bg-emerald-50 text-emerald-700",
  lesson:     "bg-purple-50 text-purple-700",
};

export default function EventCard({ e, onClick }: { e: Event; onClick?: () => void }) {
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  const date = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  return (
    <article
      className="rounded-xl border p-4 shadow-sm hover:shadow cursor-pointer transition"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <Badge>
          <span className={`rounded-full px-2 py-0.5 ${colorByType[e.eventType]}`}>
            {e.eventType}
          </span>
        </Badge>
        <div className="text-xs text-gray-500">{date}</div>
      </div>
      <h3 className="font-semibold leading-snug">{e.eventName}</h3>
      <p className="text-sm text-gray-600">{time}</p>
      {e.location && <p className="text-sm text-gray-600 mt-1">{e.location}</p>}
      {e.description && <p className="text-sm text-gray-500 mt-2 line-clamp-3">{e.description}</p>}
    </article>
  );
}
