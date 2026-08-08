import type { ClubEventType, EventDocument, PayTypeDocument } from "@/lib/firebase/schema";

export function isTournamentEventType(type: ClubEventType) {
  return type === "tournament" || type === "twoDayTournament";
}

export function getTournamentDayCount(event: Pick<EventDocument, "type" | "tournamentDayCount">) {
  if (typeof event.tournamentDayCount === "number" && event.tournamentDayCount > 0) {
    return event.tournamentDayCount;
  }

  return event.type === "twoDayTournament" ? 2 : 1;
}

export function formatTournamentDayCount(dayCount: number) {
  return `${dayCount} ${dayCount === 1 ? "day" : "days"}`;
}

export function formatTournamentEventLabel(event: Pick<EventDocument, "type" | "tournamentDayCount">) {
  return `Tournament (${formatTournamentDayCount(getTournamentDayCount(event))})`;
}

export function getPayTypeTournamentDayCount(payType: Pick<PayTypeDocument, "eventType" | "tournamentDayCount">) {
  if (typeof payType.tournamentDayCount === "number" && payType.tournamentDayCount > 0) {
    return payType.tournamentDayCount;
  }

  return payType.eventType === "twoDayTournament" ? 2 : 1;
}

export function payTypeMatchesEvent(payType: PayTypeDocument, event: EventDocument) {
  const payTypeIsTournament = isTournamentEventType(payType.eventType);
  const eventIsTournament = isTournamentEventType(event.type);

  if (payTypeIsTournament || eventIsTournament) {
    return (
      payTypeIsTournament &&
      eventIsTournament &&
      getPayTypeTournamentDayCount(payType) === getTournamentDayCount(event)
    );
  }

  return payType.eventType === event.type;
}
