import type { CoachDocument, EventDocument, PayTypeDocument } from "@/lib/firebase/schema";
import { payTypeMatchesEvent } from "@/lib/tournament-events";

export function getExpenseEventEndDate(event: Pick<EventDocument, "endDate" | "startDate">) {
  return event.endDate || event.startDate;
}

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isEventExpenseEligible(
  event: Pick<EventDocument, "endDate" | "startDate">,
  nowMs = Date.now(),
) {
  const endDate = getExpenseEventEndDate(event);

  if (!endDate) {
    return false;
  }

  const end = parseDateOnly(endDate);

  if (!end) {
    return false;
  }

  const today = new Date(nowMs);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eligibleAt = new Date(end);
  eligibleAt.setDate(eligibleAt.getDate() + 7);

  return eligibleAt.getTime() <= todayStart.getTime();
}

export type SuggestedExpense = {
  id: string;
  event: EventDocument;
  payType: PayTypeDocument;
  kind: "base" | "meal";
  description: string;
  amount: number;
  mealStipend: boolean;
};

export function getCoachTeamIds(coach: CoachDocument): string[] {
  if (Array.isArray((coach as CoachDocument & { teamIds?: string[] }).teamIds)) {
    return (coach as CoachDocument & { teamIds?: string[] }).teamIds.filter(Boolean);
  }

  const legacyTeamId = (coach as CoachDocument & { teamId?: string }).teamId;

  return legacyTeamId ? [legacyTeamId] : [];
}

export function getCoachPayTypeIds(coach: CoachDocument): string[] {
  return Array.isArray(coach.payTypeIds) ? coach.payTypeIds.filter(Boolean) : [];
}

export function getEventTriggeredUserIds(event: EventDocument): string[] {
  const value = (event as EventDocument & { expenseTriggered?: string[] }).expenseTriggered;

  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getMealStipendAmount(payType: PayTypeDocument) {
  return typeof payType.mealStipendAmount === "number" && payType.mealStipendAmount > 0
    ? payType.mealStipendAmount
    : 0;
}

function buildSuggestedExpensesForPayType(event: EventDocument, payType: PayTypeDocument): SuggestedExpense[] {
  const suggestions: SuggestedExpense[] = [
    {
      id: `${event.id}:${payType.id}:base`,
      event,
      payType,
      kind: "base",
      description: payType.description,
      amount: payType.value,
      mealStipend: false,
    },
  ];
  const mealStipendAmount = getMealStipendAmount(payType);

  if (mealStipendAmount > 0) {
    suggestions.push({
      id: `${event.id}:${payType.id}:meal`,
      event,
      payType,
      kind: "meal",
      description: `${payType.description} meal stipend`,
      amount: mealStipendAmount,
      mealStipend: true,
    });
  }

  return suggestions;
}

export function buildAvailableSuggestedExpenses(params: {
  uid: string;
  currentCoach: CoachDocument | null;
  events: EventDocument[];
  payTypes: PayTypeDocument[];
  skippedSuggestedExpenseIds?: string[];
  submittedSuggestedExpenseIds?: string[];
  nowMs?: number;
}): SuggestedExpense[] {
  if (!params.uid || !params.currentCoach) {
    return [];
  }

  const coachTeamIds = new Set(getCoachTeamIds(params.currentCoach));
  const coachPayTypeIds = new Set(getCoachPayTypeIds(params.currentCoach));
  const assignedPayTypes = params.payTypes.filter((payType) =>
    coachPayTypeIds.size > 0 ? coachPayTypeIds.has(payType.id) : payType.defaulted,
  );
  const completedSuggestedExpenseIds = new Set([
    ...(params.submittedSuggestedExpenseIds ?? []),
    ...(params.skippedSuggestedExpenseIds ?? []),
  ]);

  if (coachTeamIds.size === 0 || assignedPayTypes.length === 0) {
    return [];
  }

  return params.events
    .filter((event) => {
      const eventTeamIds = event.teamSchedules.map((entry) => entry.teamId).filter(Boolean);
      const alreadyTriggered = getEventTriggeredUserIds(event).includes(params.uid);

      return (
        event.active !== false &&
        isEventExpenseEligible(event, params.nowMs) &&
        !alreadyTriggered &&
        eventTeamIds.some((teamId) => coachTeamIds.has(teamId))
      );
    })
    .flatMap((event) =>
      assignedPayTypes
        .filter((payType) => payTypeMatchesEvent(payType, event))
        .flatMap((payType) => buildSuggestedExpensesForPayType(event, payType)),
    )
    .filter((suggestion) => suggestion.amount > 0)
    .filter((suggestion) => !completedSuggestedExpenseIds.has(suggestion.id))
    .sort((left, right) =>
      `${left.event.startDate} ${left.event.title} ${left.description}`.localeCompare(
        `${right.event.startDate} ${right.event.title} ${right.description}`,
      ),
    );
}
