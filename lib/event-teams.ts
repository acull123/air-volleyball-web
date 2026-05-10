import type { EventDocument, EventTeamSchedule, TeamDocument } from "@/lib/firebase/schema";

export function getEventTeamSchedules(event: EventDocument): EventTeamSchedule[] {
  return (Array.isArray(event.teamSchedules) ? event.teamSchedules : [])
    .map((entry) => ({
      teamId: typeof entry.teamId === "string" ? entry.teamId.trim() : "",
      scheduleUrl: typeof entry.scheduleUrl === "string" ? entry.scheduleUrl.trim() : "",
    }))
    .filter((entry) => entry.teamId);
}

export function getEventTeamIds(event: EventDocument) {
  return getEventTeamSchedules(event).map((entry) => entry.teamId);
}

export function getEventTeamLabel(event: EventDocument, teams: TeamDocument[]) {
  const teamNames = getEventTeamIds(event)
    .map((teamId) => teams.find((team) => team.id === teamId)?.name)
    .filter((name): name is string => Boolean(name));

  return teamNames.length > 0 ? teamNames.join(", ") : "All players";
}

export function getEventTeamScheduleUrl(event: EventDocument, teamId: string) {
  return getEventTeamSchedules(event).find((entry) => entry.teamId === teamId)?.scheduleUrl ?? "";
}
