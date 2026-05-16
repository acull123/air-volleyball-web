"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ConflictDocument,
  EventDocument,
  EventTeamSchedule,
  GymSpaceDocument,
  TeamDocument,
} from "@/lib/firebase/schema";
import { getEventTeamSchedules } from "@/lib/event-teams";

type ClubCalendarProps = {
  events: EventDocument[];
  teams: TeamDocument[];
  conflicts: ConflictDocument[];
  gymSpaces?: GymSpaceDocument[];
  loading?: boolean;
  onEventTimeSave?: (eventId: string, startTime: string) => Promise<void>;
  onEventDateSave?: (eventId: string, startDate: string, endDate: string) => Promise<void>;
  onEventDelete?: (eventId: string) => Promise<void>;
  onEventDuplicate?: (event: EventDocument, startDate: string, startTime: string) => Promise<void>;
  onMonthDayClick?: (dateKey: string) => void;
  monthOnly?: boolean;
};

type CalendarEventEntry = {
  id: string;
  event: EventDocument;
  dateKey: string;
  teamLabel: string;
};

type CalendarConflictEntry = {
  id: string;
  conflict: ConflictDocument;
  dateKey: string;
};

type DayTimedItem =
  | {
      kind: "event";
      id: string;
      title: string;
      subtitle: string;
      startMinutes: number;
      endMinutes: number;
      colorClass: string;
      event: EventDocument;
    }
  | {
      kind: "conflict";
      id: string;
      title: string;
      subtitle: string;
      teamLabel: string;
      startMinutes: number;
      endMinutes: number;
      colorClass: string;
      conflict: ConflictDocument;
    };

type DayTimedLayoutItem = DayTimedItem & {
  columnIndex: number;
  columnCount: number;
};

const hourRowHeight = 58;
const visibleStartHour = 8;
const visibleEndHour = 24;
const visibleStartMinutes = visibleStartHour * 60;
const visibleEndMinutes = visibleEndHour * 60;
const visibleHourCount = visibleEndHour - visibleStartHour;
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const eventTypeLabels: Record<EventDocument["type"], string> = {
  tournament: "Tournament",
  twoDayTournament: "2 Day Tournament",
  practice: "Practice",
  camp: "Camp",
  tryout: "Tryout",
  areaCamp: "Area Camp",
  refScoringClinic: "Ref And Scoring Clinic",
};

const eventTypeFilterOptions: { label: string; types: EventDocument["type"][] }[] = [
  { label: "Tournament", types: ["tournament", "twoDayTournament"] },
  { label: eventTypeLabels.practice, types: ["practice"] },
  { label: eventTypeLabels.camp, types: ["camp"] },
  { label: eventTypeLabels.tryout, types: ["tryout"] },
  { label: eventTypeLabels.areaCamp, types: ["areaCamp"] },
  { label: eventTypeLabels.refScoringClinic, types: ["refScoringClinic"] },
];

const eventTypeClasses: Record<EventDocument["type"], string> = {
  tournament: "bg-[#1d67cd] text-white",
  twoDayTournament: "bg-[#1d67cd] text-white",
  practice: "bg-[#dbeafe] text-[#1e3a8a]",
  camp: "bg-[#b35d19] text-white",
  tryout: "bg-[#7c3aed] text-white",
  areaCamp: "bg-[#0f766e] text-white",
  refScoringClinic: "bg-[#be123c] text-white",
};

const eventTypeDayClasses: Record<EventDocument["type"], string> = {
  tournament: "border-[#1d67cd] bg-[#eaf2ff] text-[#103a75]",
  twoDayTournament: "border-[#1d67cd] bg-[#eaf2ff] text-[#103a75]",
  practice: "border-[#60a5fa] bg-[#dbeafe] text-[#1e3a8a]",
  camp: "border-[#b35d19] bg-[#fff0e3] text-[#73390e]",
  tryout: "border-[#7c3aed] bg-[#f2ecff] text-[#4c1d95]",
  areaCamp: "border-[#0f766e] bg-[#e7f7f5] text-[#115e59]",
  refScoringClinic: "border-[#be123c] bg-[#fff0f3] text-[#881337]",
};

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function parseDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDateSpanDays(startDate: string, endDate: string) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate || startDate) ?? start;

  if (!start || !end) {
    return 0;
  }

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function getDaysBetween(startDate: string, endDate: string) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate || startDate) ?? start;

  if (!start || !end) {
    return [];
  }

  const days: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    days.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return days;
}

function getConflictDays(conflict: ConflictDocument) {
  const start = parseDateTime(conflict.startAt);
  const end = parseDateTime(conflict.endAt) ?? start;

  if (!start || !end) {
    return [];
  }

  const days: string[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor <= last) {
    days.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return days;
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatDayTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string) {
  if (!time) {
    return "Time TBD";
  }

  const [rawHour, rawMinute = "00"] = time.split(":");
  const hour = Number(rawHour);

  if (Number.isNaN(hour)) {
    return time;
  }

  const meridiem = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;

  return `${normalizedHour}:${rawMinute} ${meridiem}`;
}

function formatHourLabel(hour: number) {
  if (hour === 0) {
    return "12 AM";
  }

  if (hour === 12) {
    return "12 PM";
  }

  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function timeToMinutes(time: string) {
  if (!time) {
    return null;
  }

  const [rawHour, rawMinute = "00"] = time.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return Math.max(0, Math.min(1439, hour * 60 + minute));
}

function getEventEndMinutes(event: EventDocument, startMinutes: number) {
  if (event.type === "practice") {
    return Math.min(1440, startMinutes + Math.max(15, event.durationMinutes || 60));
  }

  const endMinutes = timeToMinutes(event.endTime);

  if (endMinutes !== null && endMinutes > startMinutes) {
    return endMinutes;
  }

  return Math.min(1440, startMinutes + Math.max(15, event.durationMinutes || 60));
}

function formatEventTimeRange(event: EventDocument, startTime: string) {
  if (event.type === "practice") {
    const startMinutes = timeToMinutes(startTime);
    const endTime =
      startMinutes === null
        ? event.endTime
        : minutesToTime(startMinutes + Math.max(15, event.durationMinutes || 60));

    return endTime ? `${formatTime(startTime)}-${formatTime(endTime)}` : formatTime(startTime);
  }

  return formatTime(startTime);
}

function minutesToTime(minutes: number) {
  const normalizedMinutes = Math.max(0, Math.min(1439, minutes));
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dateToMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function getConflictRangeForDay(conflict: ConflictDocument, dateKey: string) {
  const start = parseDateTime(conflict.startAt);
  const end = parseDateTime(conflict.endAt) ?? start;
  const day = parseDateKey(dateKey);

  if (!start || !end || !day) {
    return null;
  }

  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const effectiveStart = start < dayStart ? dayStart : start;
  const effectiveEnd = end > dayEnd ? dayEnd : end;

  if (effectiveEnd <= effectiveStart) {
    return null;
  }

  return {
    startMinutes: dateToMinutes(effectiveStart),
    endMinutes: Math.max(dateToMinutes(effectiveEnd), dateToMinutes(effectiveStart) + 30),
  };
}

function layoutTimedItems(items: DayTimedItem[]): DayTimedLayoutItem[] {
  const sortedItems = [...items].sort((left, right) => {
    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes;
    }

    return right.endMinutes - left.endMinutes;
  });
  const layoutItems: DayTimedLayoutItem[] = [];
  let group: DayTimedItem[] = [];
  let groupEndMinutes = -1;

  function flushGroup() {
    if (group.length === 0) {
      return;
    }

    const columnEndMinutes: number[] = [];
    const assignedItems = group.map((item) => {
      const availableColumn = columnEndMinutes.findIndex((endMinutes) => endMinutes <= item.startMinutes);
      const columnIndex = availableColumn === -1 ? columnEndMinutes.length : availableColumn;

      columnEndMinutes[columnIndex] = item.endMinutes;

      return {
        item,
        columnIndex,
      };
    });
    const columnCount = Math.max(1, columnEndMinutes.length);

    assignedItems.forEach(({ item, columnIndex }) => {
      layoutItems.push({
        ...item,
        columnIndex,
        columnCount,
      });
    });
  }

  sortedItems.forEach((item) => {
    if (group.length > 0 && item.startMinutes >= groupEndMinutes) {
      flushGroup();
      group = [];
      groupEndMinutes = -1;
    }

    group.push(item);
    groupEndMinutes = Math.max(groupEndMinutes, item.endMinutes);
  });

  flushGroup();

  return layoutItems.sort((left, right) => left.startMinutes - right.startMinutes || left.columnIndex - right.columnIndex);
}

function getTeamLabel(teamSchedules: EventTeamSchedule[], teams: TeamDocument[]) {
  const teamIds = teamSchedules.map((entry) => entry.teamId).filter(Boolean);

  if (teamIds.length === 0) {
    return "All teams";
  }

  if (teamIds.length > 1) {
    return "Multiple teams";
  }

  return teams.find((team) => team.id === teamIds[0])?.name ?? "Team TBD";
}

function getTeamIds(teamSchedules: EventTeamSchedule[]) {
  return teamSchedules.map((entry) => entry.teamId).filter(Boolean);
}

function getConflictTeamLabel(conflict: ConflictDocument, teams: TeamDocument[]) {
  return teams.find((team) => (team.playerIds || []).includes(conflict.playerId))?.name ?? "Team TBD";
}

function getGymSpaceBlockedDateSet(gymSpace: GymSpaceDocument) {
  return new Set(
    (gymSpace.blockedDates || "")
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function isGymSpaceAvailableOnDate(gymSpace: GymSpaceDocument, dateKey: string) {
  const date = parseDateKey(dateKey);
  const availableDays = gymSpace.availableDays || [];

  if (gymSpace.active === false || !date || getGymSpaceBlockedDateSet(gymSpace).has(dateKey)) {
    return false;
  }

  return availableDays.length === 0 || availableDays.includes(dayNames[date.getDay()]);
}

function formatGymSpaceBandLabel(gymSpace: GymSpaceDocument) {
  const courtText = gymSpace.courtCount === 1 ? "1 court" : `${gymSpace.courtCount} courts`;
  return `${gymSpace.facilityName || "Gym space"} · ${courtText}`;
}

export default function ClubCalendar({
  events,
  teams,
  conflicts,
  gymSpaces = [],
  loading = false,
  onEventTimeSave,
  onEventDateSave,
  onEventDelete,
  onEventDuplicate,
  onMonthDayClick,
  monthOnly = false,
}: ClubCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [enabledEventTypes, setEnabledEventTypes] = useState<Set<EventDocument["type"]>>(
    () => new Set(Object.keys(eventTypeLabels) as EventDocument["type"][]),
  );
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(() => new Set(teams.map((team) => team.id)));
  const [showConflicts, setShowConflicts] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [timeDraft, setTimeDraft] = useState("");
  const [startDateDraft, setStartDateDraft] = useState("");
  const [endDateDraft, setEndDateDraft] = useState("");
  const [duplicateSourceEventId, setDuplicateSourceEventId] = useState<string | null>(null);
  const [duplicateDateDraft, setDuplicateDateDraft] = useState("");
  const [duplicateTimeDraft, setDuplicateTimeDraft] = useState("");
  const [pendingTimeChanges, setPendingTimeChanges] = useState<Record<string, string>>({});
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [draggingPracticeId, setDraggingPracticeId] = useState<string | null>(null);
  const [savingTime, setSavingTime] = useState(false);
  const [savingDuplicate, setSavingDuplicate] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const dragMovedRef = useRef(false);
  const teamFilterInitializedRef = useRef(false);

  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) ?? null : null;
  const duplicateSourceEvent = duplicateSourceEventId
    ? events.find((event) => event.id === duplicateSourceEventId) ?? null
    : null;
  const selectedDayDate = parseDateKey(selectedDayKey) ?? today;
  const visibleGymSpaceBands = useMemo(
    () =>
      gymSpaces
        .filter((gymSpace) => isGymSpaceAvailableOnDate(gymSpace, selectedDayKey))
        .map((gymSpace) => {
          const startMinutes = timeToMinutes(gymSpace.startTime);
          const endMinutes = timeToMinutes(gymSpace.endTime);

          if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
            return null;
          }

          const visibleStart = Math.max(startMinutes, visibleStartMinutes);
          const visibleEnd = Math.min(endMinutes, visibleEndMinutes);

          if (visibleStart >= visibleEnd) {
            return null;
          }

          return {
            gymSpace,
            startMinutes: visibleStart,
            endMinutes: visibleEnd,
          };
        })
        .filter((entry): entry is { gymSpace: GymSpaceDocument; startMinutes: number; endMinutes: number } =>
          Boolean(entry),
        )
        .sort((left, right) => left.startMinutes - right.startMinutes || left.gymSpace.facilityName.localeCompare(right.gymSpace.facilityName)),
    [gymSpaces, selectedDayKey],
  );

  useEffect(() => {
    if (teamFilterInitializedRef.current || teams.length === 0) {
      return;
    }

    setSelectedTeamIds(new Set(teams.map((team) => team.id)));
    teamFilterInitializedRef.current = true;
  }, [teams]);

  const activeEvents = useMemo(
    () =>
      events
        .filter((event) => event.active !== false)
        .filter((event) => enabledEventTypes.has(event.type))
        .filter((event) => {
          const teamIds = getTeamIds(getEventTeamSchedules(event));
          return teamIds.length === 0 || teamIds.some((teamId) => selectedTeamIds.has(teamId));
        }),
    [enabledEventTypes, events, selectedTeamIds],
  );
  const eventEntries = useMemo<CalendarEventEntry[]>(
    () =>
      activeEvents.flatMap((event) => {
        const teamSchedules = getEventTeamSchedules(event);
        const teamLabel = getTeamLabel(teamSchedules, teams);

        return getDaysBetween(event.startDate, event.endDate || event.startDate).map((dateKey) => ({
          id: `${event.id}:${dateKey}`,
          event,
          dateKey,
          teamLabel,
        }));
      }),
    [activeEvents, teams],
  );
  const conflictEntries = useMemo<CalendarConflictEntry[]>(
    () =>
      showConflicts
        ? conflicts.flatMap((conflict) =>
            getConflictDays(conflict).map((dateKey) => ({
              id: `${conflict.id}:${dateKey}`,
              conflict,
              dateKey,
            })),
          )
        : [],
    [conflicts, showConflicts],
  );
  const monthDays = useMemo(() => {
    const start = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const firstGridDate = addDays(start, -start.getDay());

    return Array.from({ length: 42 }, (_, index) => addDays(firstGridDate, index));
  }, [visibleMonth]);
  const teamOptions = useMemo(
    () =>
      [...teams].sort((left, right) => left.name.localeCompare(right.name)),
    [teams],
  );
  const visibleTeamCount = teamOptions.filter((team) => selectedTeamIds.has(team.id)).length;
  const dayEvents = useMemo(
    () =>
      eventEntries
        .filter((entry) => entry.dateKey === selectedDayKey)
        .sort((left, right) =>
          `${pendingTimeChanges[left.event.id] || left.event.startTime || "99:99"} ${left.event.title}`.localeCompare(
            `${pendingTimeChanges[right.event.id] || right.event.startTime || "99:99"} ${right.event.title}`,
          ),
        ),
    [eventEntries, pendingTimeChanges, selectedDayKey],
  );
  const pendingDayChanges = useMemo(
    () =>
      Object.entries(pendingTimeChanges).filter(([eventId]) =>
        dayEvents.some((entry) => entry.event.id === eventId),
      ),
    [dayEvents, pendingTimeChanges],
  );
  const dayConflicts = useMemo(
    () => conflictEntries.filter((entry) => entry.dateKey === selectedDayKey),
    [conflictEntries, selectedDayKey],
  );
  const allDayEvents = useMemo(
    () => dayEvents.filter((entry) => timeToMinutes(pendingTimeChanges[entry.event.id] || entry.event.startTime) === null),
    [dayEvents, pendingTimeChanges],
  );
  const timedDayItems = useMemo<DayTimedItem[]>(() => {
    const eventItems: DayTimedItem[] = dayEvents.flatMap((entry) => {
      const displayTime = pendingTimeChanges[entry.event.id] || entry.event.startTime;
      const startMinutes = timeToMinutes(displayTime);

      if (startMinutes === null) {
        return [];
      }

      return [
        {
          kind: "event" as const,
          id: entry.id,
          title: entry.event.title,
          subtitle: `${formatEventTimeRange(entry.event, displayTime)} · ${entry.teamLabel}`,
          startMinutes,
          endMinutes: getEventEndMinutes(entry.event, startMinutes),
          colorClass: eventTypeDayClasses[entry.event.type],
          event: entry.event,
        },
      ];
    });
    const conflictItems: DayTimedItem[] = dayConflicts.flatMap((entry) => {
      const range = getConflictRangeForDay(entry.conflict, selectedDayKey);

      if (!range) {
        return [];
      }

      return [
        {
          kind: "conflict" as const,
          id: entry.id,
          title: `Conflict: ${entry.conflict.playerName}`,
          subtitle: `${entry.conflict.status} · ${entry.conflict.reason || "No reason listed"}`,
          teamLabel: getConflictTeamLabel(entry.conflict, teams),
          startMinutes: range.startMinutes,
          endMinutes: range.endMinutes,
          colorClass: "border-[#dc2626] bg-[#fff1f2] text-[#8a1020]",
          conflict: entry.conflict,
        },
      ];
    });

    return [...eventItems, ...conflictItems]
      .filter((item) => item.startMinutes < visibleEndMinutes && item.endMinutes > visibleStartMinutes)
      .sort((left, right) => left.startMinutes - right.startMinutes);
  }, [dayConflicts, dayEvents, pendingTimeChanges, selectedDayKey, teams]);
  const timedDayLayoutItems = useMemo(() => layoutTimedItems(timedDayItems), [timedDayItems]);

  useEffect(() => {
    if (!draggingEventId) {
      return;
    }

    const activeDraggingEventId = draggingEventId;

    function updateDraggedTime(clientY: number) {
      const timeline = timelineRef.current;

      if (!timeline) {
        return;
      }

      const rect = timeline.getBoundingClientRect();
      const rawOffset = clientY - rect.top;
      const clampedOffset = Math.max(0, Math.min(rect.height, rawOffset));
      const rawMinutes = visibleStartMinutes + (clampedOffset / hourRowHeight) * 60;
      const roundedMinutes = Math.max(
        visibleStartMinutes,
        Math.min(visibleEndMinutes - 15, Math.round(rawMinutes / 15) * 15),
      );

      dragMovedRef.current = true;
      setPendingTimeChanges((current) => ({
        ...current,
        [activeDraggingEventId]: minutesToTime(roundedMinutes),
      }));
    }

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault();
      updateDraggedTime(event.clientY);
    }

    function handlePointerUp() {
      setDraggingEventId(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingEventId]);

  function toggleEventTypes(types: EventDocument["type"][], checked: boolean) {
    setEnabledEventTypes((current) => {
      const next = new Set(current);

      if (checked) {
        types.forEach((type) => next.add(type));
      } else {
        types.forEach((type) => next.delete(type));
      }

      return next;
    });
  }

  function toggleTeamVisibility(teamId: string, checked: boolean) {
    setSelectedTeamIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(teamId);
      } else {
        next.delete(teamId);
      }

      return next;
    });
  }

  function openDay(dateKey: string) {
    if (monthOnly) {
      onMonthDayClick?.(dateKey);
      return;
    }

    const date = parseDateKey(dateKey);

    if (date) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }

    setSelectedDayKey(dateKey);
    setViewMode("day");
  }

  function handleMonthDayClick(dateKey: string) {
    if (onMonthDayClick) {
      onMonthDayClick(dateKey);
      return;
    }

    openDay(dateKey);
  }

  function openEventDialog(event: EventDocument, dateKey = event.startDate) {
    setSelectedEventId(event.id);
    setTimeDraft(pendingTimeChanges[event.id] || event.startTime || "");
    setStartDateDraft(event.startDate || "");
    setEndDateDraft(event.endDate || event.startDate || "");
    setDuplicateDateDraft(dateKey || event.startDate || selectedDayKey);
    setDuplicateTimeDraft(pendingTimeChanges[event.id] || event.startTime || "");
    setStatus(null);
    setError(null);
  }

  function openDuplicateDialog(event: EventDocument) {
    setDuplicateSourceEventId(event.id);
    setDuplicateDateDraft(duplicateDateDraft || selectedDayKey || event.startDate || "");
    setDuplicateTimeDraft(duplicateTimeDraft || pendingTimeChanges[event.id] || event.startTime || "");
    setSelectedEventId(null);
    setStatus(null);
    setError(null);
  }

  async function saveDuplicateEvent(keepOpen: boolean) {
    if (!duplicateSourceEvent || !onEventDuplicate) {
      setDuplicateSourceEventId(null);
      return;
    }

    if (!duplicateDateDraft) {
      setError("Date is required for the duplicated event.");
      return;
    }

    if (!duplicateTimeDraft) {
      setError("Start time is required for the duplicated event.");
      return;
    }

    setSavingDuplicate(true);
    setStatus(null);
    setError(null);

    try {
      await onEventDuplicate(duplicateSourceEvent, duplicateDateDraft, duplicateTimeDraft);
      setStatus("Event duplicated.");

      if (!keepOpen) {
        setDuplicateSourceEventId(null);
      }
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate event.");
    } finally {
      setSavingDuplicate(false);
    }
  }

  async function saveEventDetails() {
    if (!selectedEvent) {
      setSelectedEventId(null);
      return;
    }

    if (!startDateDraft) {
      setError("Start date is required.");
      return;
    }

    const normalizedEndDate = endDateDraft || startDateDraft;

    if (normalizedEndDate < startDateDraft) {
      setError("End date must be the same as or after the start date.");
      return;
    }

    const timeChanged = timeDraft !== (selectedEvent.startTime || "");
    const dateChanged =
      startDateDraft !== selectedEvent.startDate || normalizedEndDate !== (selectedEvent.endDate || selectedEvent.startDate);

    if ((timeChanged && !onEventTimeSave) || (dateChanged && !onEventDateSave)) {
      setSelectedEventId(null);
      return;
    }

    setSavingTime(true);
    setStatus(null);
    setError(null);

    try {
      await Promise.all([
        timeChanged && onEventTimeSave ? onEventTimeSave(selectedEvent.id, timeDraft) : Promise.resolve(),
        dateChanged && onEventDateSave
          ? onEventDateSave(selectedEvent.id, startDateDraft, normalizedEndDate)
          : Promise.resolve(),
      ]);
      setPendingTimeChanges((current) => {
        const next = { ...current };
        delete next[selectedEvent.id];
        return next;
      });
      setStatus("Event updated.");
      setSelectedEventId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update event.");
    } finally {
      setSavingTime(false);
    }
  }

  async function deleteSelectedEvent() {
    if (!selectedEvent || !onEventDelete) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedEvent.title}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    setSavingTime(true);
    setStatus(null);
    setError(null);

    try {
      await onEventDelete(selectedEvent.id);
      setPendingTimeChanges((current) => {
        const next = { ...current };
        delete next[selectedEvent.id];
        return next;
      });
      setSelectedEventId(null);
      setStatus("Event deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete event.");
    } finally {
      setSavingTime(false);
    }
  }

  async function savePendingDayChanges() {
    if (!onEventTimeSave || pendingDayChanges.length === 0) {
      return;
    }

    setSavingTime(true);
    setStatus(null);
    setError(null);

    try {
      await Promise.all(pendingDayChanges.map(([eventId, startTime]) => onEventTimeSave(eventId, startTime)));
      const savedIds = new Set(pendingDayChanges.map(([eventId]) => eventId));

      setPendingTimeChanges((current) => {
        const next = { ...current };
        savedIds.forEach((eventId) => delete next[eventId]);
        return next;
      });
      setStatus(
        `${pendingDayChanges.length} event time${pendingDayChanges.length === 1 ? "" : "s"} updated.`,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update event times.");
    } finally {
      setSavingTime(false);
    }
  }

  async function movePracticeToDay(event: EventDocument, dateKey: string) {
    if (!onEventDateSave || event.type !== "practice" || event.startDate === dateKey) {
      return;
    }

    const startDate = parseDateKey(dateKey);

    if (!startDate) {
      return;
    }

    const daySpan = getDateSpanDays(event.startDate, event.endDate || event.startDate);
    const endDate = toDateKey(addDays(startDate, daySpan));

    setSavingTime(true);
    setStatus(null);
    setError(null);

    try {
      await onEventDateSave(event.id, dateKey, endDate);
      setStatus("Practice date updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update practice date.");
    } finally {
      setSavingTime(false);
      setDraggingPracticeId(null);
    }
  }

  function discardPendingDayChanges() {
    const visibleIds = new Set(pendingDayChanges.map(([eventId]) => eventId));

    setPendingTimeChanges((current) => {
      const next = { ...current };
      visibleIds.forEach((eventId) => delete next[eventId]);
      return next;
    });
  }

  function goToToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDayKey(todayKey);
    setViewMode("month");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-white shadow-[0_12px_30px_rgba(18,38,63,0.05)]">
        <button
          type="button"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((current) => !current)}
          className="flex w-full flex-col gap-2 px-4 py-4 text-left transition hover:bg-[#f3f8ff] sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Filters
            </span>
            <span className="mt-1 block text-sm font-semibold text-[color:var(--ink)]">
              {visibleTeamCount} of {teamOptions.length} teams visible
              {showConflicts ? " · conflicts shown" : " · conflicts hidden"}
            </span>
          </span>
          <span className="inline-flex w-fit rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-bold text-[#1d4f91]">
            {filtersOpen ? "Hide filters" : "Show filters"}
          </span>
        </button>

        {filtersOpen && (
          <div className="grid gap-5 border-t border-[color:var(--line)] px-4 py-4 md:grid-cols-[minmax(14rem,18rem)_1fr]">
            <div className="space-y-2">
              <p className="text-sm font-bold text-[color:var(--ink)]">Event types</p>
              {eventTypeFilterOptions.map((option) => {
                const checked = option.types.every((type) => enabledEventTypes.has(type));
                const swatchType = option.types[0];

                return (
                  <label key={option.label} className="flex items-center gap-3 text-sm text-[color:var(--ink)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleEventTypes(option.types, event.target.checked)}
                    />
                    <span className={`h-3 w-3 rounded-full ${eventTypeClasses[swatchType]}`} />
                    <span>{option.label}</span>
                  </label>
                );
              })}
              <label className="flex items-center gap-3 text-sm text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  checked={showConflicts}
                  onChange={(event) => setShowConflicts(event.target.checked)}
                />
                <span className="h-3 w-3 rounded-full bg-[#dc2626]" />
                <span>Conflicts</span>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-[color:var(--ink)]">Teams</p>
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {teamOptions.length === 0 ? (
                  <p className="text-sm text-[color:var(--muted)]">No teams yet.</p>
                ) : (
                  teamOptions.map((team) => (
                    <label key={team.id} className="flex items-start gap-3 text-sm text-[color:var(--ink)]">
                      <input
                        type="checkbox"
                        checked={selectedTeamIds.has(team.id)}
                        onChange={(changeEvent) => toggleTeamVisibility(team.id, changeEvent.target.checked)}
                        className="mt-1"
                      />
                      <span className="font-semibold">{team.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="rounded-[1.25rem] border border-[color:var(--line)] bg-white p-3 shadow-[0_14px_35px_rgba(18,38,63,0.06)] md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">Calendar</p>
              <h2 className="mt-1 text-3xl font-bold text-[color:var(--ink)]">
                {viewMode === "day" ? formatDayTitle(selectedDayDate) : formatMonthTitle(visibleMonth)}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    viewMode === "month" ? "bg-white text-[color:var(--ink)] shadow-sm" : "text-[color:var(--muted)]"
                  }`}
                >
                  Month
                </button>
                {!monthOnly && (
                  <button
                    type="button"
                    onClick={() => setViewMode("day")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      viewMode === "day" ? "bg-white text-[color:var(--ink)] shadow-sm" : "text-[color:var(--muted)]"
                    }`}
                  >
                    Day
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (viewMode === "day") {
                    openDay(toDateKey(addDays(selectedDayDate, -1)));
                  } else {
                    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
                  }
                }}
                className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  if (viewMode === "day") {
                    openDay(toDateKey(addDays(selectedDayDate, 1)));
                  } else {
                    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
                  }
                }}
                className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-12 text-center text-sm text-[color:var(--muted)]">
              Loading calendar...
            </div>
          ) : viewMode === "month" ? (
            <>
              <div className="mt-5 overflow-hidden rounded-[1rem] border border-[color:var(--line)]">
                <div className="grid grid-cols-7 border-b border-[color:var(--line)] bg-[#f7f9fc] text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="border-r border-[color:var(--line)] px-2 py-2 text-center last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((day) => {
                    const dateKey = toDateKey(day);
                    const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                    const isToday = dateKey === todayKey;
                    const isSelected = dateKey === selectedDayKey;
                    const dayEvents = eventEntries
                      .filter((entry) => entry.dateKey === dateKey)
                      .sort((left, right) =>
                        `${left.event.startTime || "99:99"} ${left.event.title}`.localeCompare(
                          `${right.event.startTime || "99:99"} ${right.event.title}`,
                        ),
                      );
                    const dayConflicts = conflictEntries.filter((entry) => entry.dateKey === dateKey);
                    const visibleDayEvents = dayEvents.slice(0, 3);
                    const visibleDayConflicts = dayConflicts.slice(0, Math.max(0, 3 - visibleDayEvents.length));
                    const hiddenItemCount = dayEvents.length + dayConflicts.length - visibleDayEvents.length - visibleDayConflicts.length;
                    const isPracticeDropTarget = Boolean(draggingPracticeId);

                    return (
                      <div
                        key={dateKey}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleMonthDayClick(dateKey)}
                        onDragOver={(event) => {
                          if (draggingPracticeId && onEventDateSave) {
                            event.preventDefault();
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const eventId = event.dataTransfer.getData("text/plain") || draggingPracticeId;
                          const draggedEvent = events.find((calendarEvent) => calendarEvent.id === eventId);

                          if (draggedEvent) {
                            void movePracticeToDay(draggedEvent, dateKey);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleMonthDayClick(dateKey);
                          }
                        }}
                        className={`min-h-28 cursor-pointer border-b border-r border-[color:var(--line)] px-1.5 py-2 outline-none transition hover:bg-[#f3f8ff] focus:bg-[#f3f8ff] md:min-h-36 md:px-2 ${
                          isCurrentMonth ? "bg-white" : "bg-[#f7f9fc]"
                        } ${isPracticeDropTarget ? "ring-1 ring-inset ring-[#60a5fa]" : ""}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-1">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                              isToday
                                ? "bg-[#1d67cd] text-white"
                                : isSelected
                                  ? "bg-[#eaf2ff] text-[#1d67cd]"
                                  : isCurrentMonth
                                    ? "text-[color:var(--ink)]"
                                    : "text-[color:var(--muted)]"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                        </div>

                        <div className="space-y-1">
                          {visibleDayEvents.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              draggable={entry.event.type === "practice" && Boolean(onEventDateSave)}
                              onDragStart={(event) => {
                                if (entry.event.type !== "practice") {
                                  return;
                                }

                                setDraggingPracticeId(entry.event.id);
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", entry.event.id);
                              }}
                              onDragEnd={() => setDraggingPracticeId(null)}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (onMonthDayClick) {
                                  onMonthDayClick(dateKey);
                                  return;
                                }

                                openEventDialog(entry.event, dateKey);
                              }}
                              className={`w-full rounded-md px-2 py-1 text-left text-[0.68rem] font-semibold leading-4 shadow-sm transition hover:brightness-95 md:text-xs ${
                                entry.event.type === "practice" && onEventDateSave ? "cursor-grab active:cursor-grabbing" : ""
                              } ${eventTypeClasses[entry.event.type]}`}
                            >
                              <span className="block truncate">{entry.event.title}</span>
                              <span className="block truncate opacity-85">
                                {formatEventTimeRange(entry.event, entry.event.startTime)} · {entry.teamLabel}
                              </span>
                              {entry.event.type === "practice" && entry.event.practicePublished === false && (
                                <span className="mt-1 inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[0.62rem] font-bold text-[#1d4f91]">
                                  Unpublished
                                </span>
                              )}
                              {entry.event.type === "practice" && entry.event.notes && (
                                <span className="mt-1 inline-flex rounded-full bg-[#fff2f2] px-2 py-0.5 text-[0.62rem] font-bold text-[#8a2d2d]">
                                  Conflict
                                </span>
                              )}
                            </button>
                          ))}
                          {visibleDayConflicts.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-md border border-[#e7b8b8] bg-[#fff2f2] px-2 py-1 text-[0.68rem] font-semibold leading-4 text-[#8a2d2d] md:text-xs"
                            >
                              <span className="block truncate">Conflict: {entry.conflict.playerName}</span>
                              <span className="block truncate text-[0.6rem] font-bold opacity-75 md:text-[0.65rem]">
                                {getConflictTeamLabel(entry.conflict, teams)}
                              </span>
                            </div>
                          ))}
                          {hiddenItemCount > 0 && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMonthDayClick(dateKey);
                              }}
                              className="w-full rounded-md border border-dashed border-[#bfd5f2] bg-[#f3f8ff] px-2 py-1 text-left text-[0.7rem] font-bold text-[#1d4f91] transition hover:bg-[#eaf2ff]"
                            >
                              ... {hiddenItemCount} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-3 text-sm text-[color:var(--muted)]">Click any day to open the hourly day view.</p>
            </>
          ) : (
            <div className="mt-5 overflow-hidden rounded-[1rem] border border-[color:var(--line)] bg-white">
              <div className="flex flex-col gap-3 border-b border-[color:var(--line)] bg-[#f7f9fc] px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold ${
                      selectedDayKey === todayKey ? "bg-[#1d67cd] text-white" : "bg-white text-[color:var(--ink)]"
                    }`}
                  >
                    {selectedDayDate.getDate()}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[color:var(--ink)]">
                      {selectedDayDate.toLocaleDateString(undefined, { weekday: "long" })}
                    </p>
                    <p className="text-xs font-semibold text-[color:var(--muted)]">
                      {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                      {showConflicts ? ` · ${dayConflicts.length} conflict${dayConflicts.length === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {pendingDayChanges.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#d7e6fb] bg-[#f3f8ff] px-3 py-2">
                      <span className="text-xs font-bold text-[#1d4f91]">
                        {pendingDayChanges.length} unsaved time change
                        {pendingDayChanges.length === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        disabled={savingTime || !onEventTimeSave}
                        onClick={() => void savePendingDayChanges()}
                        className="rounded-full bg-[#1d67cd] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingTime ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        type="button"
                        disabled={savingTime}
                        onClick={discardPendingDayChanges}
                        className="rounded-full border border-[#bfd5f2] bg-white px-4 py-2 text-xs font-bold text-[#1d4f91] transition hover:bg-[#eaf2ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Discard
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewMode("month")}
                    className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                  >
                    Back to month
                  </button>
                </div>
              </div>

              {allDayEvents.length > 0 && (
                <div className="grid grid-cols-[4.5rem_1fr] border-b border-[color:var(--line)]">
                  <div className="border-r border-[color:var(--line)] px-3 py-3 text-right text-xs font-semibold text-[color:var(--muted)]">
                    all-day
                  </div>
                  <div className="flex flex-wrap gap-2 px-3 py-3">
                    {allDayEvents.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => openEventDialog(entry.event, selectedDayKey)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${eventTypeClasses[entry.event.type]}`}
                      >
                        {entry.event.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-h-[72vh] overflow-y-auto">
                <div ref={timelineRef} className="relative" style={{ height: hourRowHeight * visibleHourCount }}>
                  <div className="grid grid-cols-[4.5rem_1fr]">
                    {Array.from({ length: visibleHourCount }, (_, index) => visibleStartHour + index).map((hour) => (
                      <div key={hour} className="contents">
                        <div
                          className="border-r border-t border-[color:var(--line)] px-2 pt-1 text-right text-[0.7rem] font-semibold text-[color:var(--muted)]"
                          style={{ height: hourRowHeight }}
                        >
                          {formatHourLabel(hour)}
                        </div>
                        <div className="border-t border-[color:var(--line)]" style={{ height: hourRowHeight }} />
                      </div>
                    ))}
                  </div>

                  {visibleGymSpaceBands.length > 0 && (
                    <div className="pointer-events-none absolute bottom-0 right-0 top-0" style={{ left: "4.5rem" }}>
                      {visibleGymSpaceBands.map((band, index) => {
                        const top = ((band.startMinutes - visibleStartMinutes) / 60) * hourRowHeight;
                        const height = ((band.endMinutes - band.startMinutes) / 60) * hourRowHeight;
                        const columnWidth = 100 / visibleGymSpaceBands.length;
                        const left = index * columnWidth;

                        return (
                          <div
                            key={band.gymSpace.id}
                            className="absolute rounded-xl border border-[#86efac] bg-[#dcfce7]/55 px-3 py-2 text-[0.65rem] font-bold text-[#166534]"
                            style={{
                              top,
                              height,
                              left: `calc(${left}% + 0.35rem)`,
                              width: `calc(${columnWidth}% - 0.7rem)`,
                            }}
                          >
                            <span className="block truncate">{formatGymSpaceBandLabel(band.gymSpace)}</span>
                            <span className="block truncate font-semibold opacity-80">
                              {formatTime(band.gymSpace.startTime)} - {formatTime(band.gymSpace.endTime)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="absolute bottom-0 right-0 top-0" style={{ left: "4.5rem" }}>
                    {timedDayLayoutItems.map((item) => {
                      const visibleStart = Math.max(item.startMinutes, visibleStartMinutes);
                      const visibleEnd = Math.min(item.endMinutes, visibleEndMinutes);
                      const top = ((visibleStart - visibleStartMinutes) / 60) * hourRowHeight;
                      const height = Math.max(42, ((visibleEnd - visibleStart) / 60) * hourRowHeight);
                      const leftOffset = (item.columnIndex / item.columnCount) * 100;
                      const rightOffset = ((item.columnCount - item.columnIndex - 1) / item.columnCount) * 100;
                      const hasPendingTime = item.kind === "event" && Boolean(pendingTimeChanges[item.event.id]);

                      return item.kind === "event" ? (
                        <button
                          key={item.id}
                          type="button"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            dragMovedRef.current = false;
                            setStatus(null);
                            setError(null);
                            setDraggingEventId(item.event.id);

                            try {
                              event.currentTarget.setPointerCapture(event.pointerId);
                            } catch {
                              // Some browsers can reject capture if the pointer is already released.
                            }
                          }}
                          onClick={(event) => {
                            if (dragMovedRef.current) {
                              event.preventDefault();
                              dragMovedRef.current = false;
                              return;
                            }

                            openEventDialog(item.event, selectedDayKey);
                          }}
                          className={`absolute touch-none cursor-grab rounded-xl border-l-4 px-3 py-2 text-left text-xs font-semibold shadow-sm transition hover:brightness-95 active:cursor-grabbing ${
                            hasPendingTime ? "ring-2 ring-[#1d67cd]/30" : ""
                          } ${item.colorClass}`}
                          style={{
                            top,
                            height,
                            left: `calc(${leftOffset}% + 0.4rem)`,
                            right: `calc(${rightOffset}% + 0.4rem)`,
                          }}
                        >
                          <span className="block truncate">{item.title}</span>
                          <span className="block truncate opacity-80">{item.subtitle}</span>
                          {item.event.type === "practice" && item.event.practicePublished === false && (
                            <span className="mt-1 inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[0.65rem] font-bold text-[#1d4f91]">
                              Unpublished
                            </span>
                          )}
                          {item.event.type === "practice" && item.event.notes && (
                            <span className="mt-1 inline-flex rounded-full bg-[#fff2f2] px-2 py-0.5 text-[0.65rem] font-bold text-[#8a2d2d]">
                              Conflict
                            </span>
                          )}
                          {hasPendingTime && (
                            <span className="mt-1 inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[0.65rem] font-bold text-[#1d4f91]">
                              Unsaved
                            </span>
                          )}
                        </button>
                      ) : (
                        <div
                          key={item.id}
                          className={`absolute rounded-xl border-l-4 px-3 py-2 text-left text-xs font-semibold shadow-sm ${item.colorClass}`}
                          style={{
                            top,
                            height,
                            left: `calc(${leftOffset}% + 0.4rem)`,
                            right: `calc(${rightOffset}% + 0.4rem)`,
                          }}
                        >
                          <span className="block truncate">{item.title}</span>
                          <span className="block truncate opacity-80">{item.subtitle}</span>
                          <span className="block truncate text-[0.65rem] font-bold opacity-70">{item.teamLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {timedDayItems.length === 0 && allDayEvents.length === 0 && (
                <div className="border-t border-[color:var(--line)] px-4 py-5 text-sm text-[color:var(--muted)]">
                  Nothing scheduled for this day.
                </div>
              )}
            </div>
          )}
        </section>
      {status && <p className="text-sm text-[color:var(--muted)]">{status}</p>}
      {error && (
        <div className="rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
          {error}
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1f33]/60 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-event-dialog-title"
            className="w-full max-w-xl rounded-[1.5rem] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {eventTypeLabels[selectedEvent.type]}
                </p>
                <h2 id="calendar-event-dialog-title" className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close event dialog"
                onClick={() => setSelectedEventId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line)] text-xl font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                x
              </button>
            </div>

            <div className="mt-5 grid gap-4 text-sm text-[color:var(--muted)]">
              <p>
                <span className="font-semibold text-[color:var(--ink)]">Teams:</span>{" "}
                {getTeamLabel(getEventTeamSchedules(selectedEvent), teams)}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 font-semibold text-[color:var(--ink)]">
                  Start date
                  <input
                    type="date"
                    value={startDateDraft}
                    onChange={(event) => {
                      setStartDateDraft(event.target.value);
                      if (!endDateDraft || endDateDraft < event.target.value) {
                        setEndDateDraft(event.target.value);
                      }
                    }}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="flex flex-col gap-2 font-semibold text-[color:var(--ink)]">
                  End date
                  <input
                    type="date"
                    value={endDateDraft}
                    min={startDateDraft}
                    onChange={(event) => setEndDateDraft(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 font-semibold text-[color:var(--ink)]">
                Event time
                <input
                  type="time"
                  value={timeDraft}
                  onChange={(event) => setTimeDraft(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                />
              </label>
              {selectedEvent.location && (
                <p>
                  <span className="font-semibold text-[color:var(--ink)]">Location:</span> {selectedEvent.location}
                </p>
              )}
              {selectedEvent.notes && <p className="leading-7">{selectedEvent.notes}</p>}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={savingTime}
                onClick={() => void saveEventDetails()}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTime ? "Saving..." : "Save Event"}
              </button>
              <button
                type="button"
                disabled={savingTime}
                onClick={() => setSelectedEventId(null)}
                className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              {onEventDelete && (
                <button
                  type="button"
                  disabled={savingTime}
                  onClick={() => void deleteSelectedEvent()}
                  className="rounded-full border border-[#e7b8b8] px-5 py-3 text-sm font-semibold text-[#8a2d2d] transition hover:bg-[#fff2f2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete Event
                </button>
              )}
              {onEventDuplicate && selectedEvent.type === "practice" && (
                <button
                  type="button"
                  disabled={savingTime}
                  onClick={() => openDuplicateDialog(selectedEvent)}
                  className="rounded-full border border-[#bfd5f2] px-5 py-3 text-sm font-semibold text-[#1d4f91] transition hover:bg-[#eaf2ff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Duplicate Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {duplicateSourceEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1f33]/60 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-duplicate-dialog-title"
            className="w-full max-w-xl rounded-[1.5rem] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  Duplicate {eventTypeLabels[duplicateSourceEvent.type]}
                </p>
                <h2 id="calendar-duplicate-dialog-title" className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
                  {duplicateSourceEvent.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close duplicate dialog"
                onClick={() => setDuplicateSourceEventId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line)] text-xl font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
              >
                x
              </button>
            </div>

            <div className="mt-5 grid gap-4 text-sm text-[color:var(--muted)]">
              <p>
                <span className="font-semibold text-[color:var(--ink)]">Teams:</span>{" "}
                {getTeamLabel(getEventTeamSchedules(duplicateSourceEvent), teams)}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 font-semibold text-[color:var(--ink)]">
                  Date
                  <input
                    type="date"
                    value={duplicateDateDraft}
                    onChange={(event) => setDuplicateDateDraft(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
                <label className="flex flex-col gap-2 font-semibold text-[color:var(--ink)]">
                  Start time
                  <input
                    type="time"
                    value={duplicateTimeDraft}
                    onChange={(event) => setDuplicateTimeDraft(event.target.value)}
                    className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  />
                </label>
              </div>
              <p className="text-xs font-semibold text-[color:var(--muted)]">
                The duplicated event keeps the same team, name, duration, location, and notes. It will be created only
                for the selected date.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={savingDuplicate}
                onClick={() => void saveDuplicateEvent(false)}
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingDuplicate ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                disabled={savingDuplicate}
                onClick={() => void saveDuplicateEvent(true)}
                className="rounded-full border border-[#bfd5f2] px-5 py-3 text-sm font-semibold text-[#1d4f91] transition hover:bg-[#eaf2ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingDuplicate ? "Saving..." : "Save And Create Another"}
              </button>
              <button
                type="button"
                disabled={savingDuplicate}
                onClick={() => setDuplicateSourceEventId(null)}
                className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
