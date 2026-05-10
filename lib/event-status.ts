import type { EventDocument, EventStatus } from "@/lib/firebase/schema";

const statusLabels: Record<EventStatus, string> = {
  none: "None",
  accepted: "Accepted",
  pending: "Pending",
  waitlisted: "Waitlisted",
};

export function getEventStatus(event: EventDocument): EventStatus {
  return event.status || "none";
}

export function formatEventStatus(status: EventStatus) {
  return statusLabels[status];
}

export function shouldShowEventStatus(status: EventStatus) {
  return status !== "none";
}
