export type Gender = "female" | "male" | "coed" | "other";
export type EventType = "practice" | "tournament" | "camp" | "tryouts" | "lesson";

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO YYYY-MM-DD
  gender: Gender;
  jerseyNumber: number;
  position: string;
  gradYear: number;
  hometown: string;
  teamId: string;
}

export interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  specialties: string[];
}

export interface Team {
  id: string;
  teamName: string;      // e.g. "15U Blue"
  ageGroup: string;
  season: string;
  playerIds: string[];
  coachIds: string[];
  practiceSummary: string;
  homeFacility: string;
}

export interface Event {
  id: string;
  eventName: string;
  eventType: EventType;
  description?: string;
  startsAt: string;      // ISO datetime
  endsAt: string;        // ISO datetime
  teamIds: string[];
  coachIds: string[];
  playerIds: string[];
  location?: string;
}

export interface Camp {
  id: string;
  title: string;
  season: string;
  dateLabel: string;
  ageRange: string;
  location: string;
  price: string;
  focus: string;
  spotsLeft: number;
}

export interface TryoutSession {
  id: string;
  ageGroup: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  fee: string;
  notes: string;
}

export interface AlumniProfile {
  id: string;
  name: string;
  college: string;
  position: string;
  gradYear: number;
}

export interface Invoice {
  id: string;
  label: string;
  amount: string;
  dueDate: string;
  status: "due" | "scheduled" | "paid";
}

export interface PrivateLessonPackage {
  id: string;
  title: string;
  format: string;
  duration: string;
  price: string;
  focus: string;
  coachId: string;
}

export interface TrainingProgram {
  id: string;
  title: string;
  audience: string;
  cadence: string;
  summary: string;
}

export interface AdminTask {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
}

export interface NavLink {
  href: string;
  label: string;
}
