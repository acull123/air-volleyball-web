import type { Event } from "../types/models";

export default function ScheduleTable({
  events,
  emptyLabel = "No events scheduled.",
}: {
  events: Event[];
  emptyLabel?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--line)]">
      <table className="min-w-full divide-y divide-[color:var(--line)] text-left text-sm">
        <thead className="bg-[color:var(--paper)] text-[color:var(--muted)]">
          <tr>
            <th className="px-4 py-3 font-semibold">Event</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Time</th>
            <th className="px-4 py-3 font-semibold">Team</th>
            <th className="px-4 py-3 font-semibold">Location</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--line)] bg-white">
          {events.map((event) => {
            const start = new Date(event.startsAt);
            const end = new Date(event.endsAt);

            return (
              <tr key={event.id}>
                <td className="px-4 py-4 align-top font-semibold text-[color:var(--ink)]">
                  {event.eventName}
                </td>
                <td className="px-4 py-4 align-top capitalize text-[color:var(--muted)]">
                  {event.eventType}
                </td>
                <td className="px-4 py-4 align-top text-[color:var(--muted)]">
                  {start.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-4 align-top text-[color:var(--muted)]">
                  {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} to{" "}
                  {end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </td>
                <td className="px-4 py-4 align-top text-[color:var(--muted)]">
                  {event.teamName || "All teams"}
                </td>
                <td className="px-4 py-4 align-top text-[color:var(--muted)]">
                  {event.location ?? "TBD"}
                </td>
                <td className="px-4 py-4 align-top capitalize text-[color:var(--muted)]">
                  {event.status && event.status !== "none" ? event.status : "None"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
