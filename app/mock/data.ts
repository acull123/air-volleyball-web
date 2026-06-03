import type {
  AdminTask,
  AlumniProfile,
  Camp,
  Coach,
  Event,
  Invoice,
  NavLink,
  Player,
  PrivateLessonPackage,
  Team,
  TrainingProgram,
  TryoutSession,
} from "../types/models";

export const siteNav: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/teams", label: "Teams" },
  { href: "/training", label: "Training" },
  { href: "/register", label: "Register" },
  { href: "/forms", label: "Forms" },
  { href: "/login", label: "Player Portal" },
  { href: "/admin", label: "Admin" },
];

export const players: Player[] = [
  {
    id: "p1",
    firstName: "Ava",
    lastName: "Johnson",
    dateOfBirth: "2010-05-17",
    gender: "female",
    jerseyNumber: 2,
    position: "Setter",
    gradYear: 2028,
    hometown: "Eau Claire",
    teamId: "t1",
  },
  {
    id: "p2",
    firstName: "Emma",
    lastName: "Lee",
    dateOfBirth: "2011-01-09",
    gender: "female",
    jerseyNumber: 8,
    position: "Outside Hitter",
    gradYear: 2029,
    hometown: "Chippewa Falls",
    teamId: "t1",
  },
  {
    id: "p3",
    firstName: "Sophia",
    lastName: "Brown",
    dateOfBirth: "2009-10-03",
    gender: "female",
    jerseyNumber: 11,
    position: "Libero",
    gradYear: 2027,
    hometown: "Altoona",
    teamId: "t2",
  },
  {
    id: "p4",
    firstName: "Mia",
    lastName: "Davis",
    dateOfBirth: "2008-07-22",
    gender: "female",
    jerseyNumber: 14,
    position: "Middle Blocker",
    gradYear: 2026,
    hometown: "Menomonie",
    teamId: "t2",
  },
  {
    id: "p5",
    firstName: "Harper",
    lastName: "Nelson",
    dateOfBirth: "2012-03-14",
    gender: "female",
    jerseyNumber: 5,
    position: "Defensive Specialist",
    gradYear: 2030,
    hometown: "Lake Hallie",
    teamId: "t3",
  },
  {
    id: "p6",
    firstName: "Ella",
    lastName: "Martinez",
    dateOfBirth: "2012-08-11",
    gender: "female",
    jerseyNumber: 9,
    position: "Right Side",
    gradYear: 2030,
    hometown: "Eau Claire",
    teamId: "t3",
  },
];

export const coaches: Coach[] = [
  {
    id: "c1",
    firstName: "Ryan",
    lastName: "K.",
    title: "Club Director",
    specialties: ["setter development", "match systems", "leadership"],
  },
  {
    id: "c2",
    firstName: "Taylor",
    lastName: "S.",
    title: "Head Coach",
    specialties: ["serve receive", "defense", "competitive prep"],
  },
  {
    id: "c3",
    firstName: "Jordan",
    lastName: "P.",
    title: "Skills Trainer",
    specialties: ["arm swing", "jump mechanics", "position-specific reps"],
  },
];

export const teams: Team[] = [
  {
    id: "t1",
    teamName: "14U Elite",
    ageGroup: "14U",
    season: "2026 Club Season",
    playerIds: ["p1", "p2"],
    coachIds: ["c1"],
    practiceSummary: "Mondays and Wednesdays, 5:30 PM to 7:30 PM",
    homeFacility: "Chippewa Valley Sports Center",
  },
  {
    id: "t2",
    teamName: "15U Blue",
    ageGroup: "15U",
    season: "2026 Club Season",
    playerIds: ["p3", "p4"],
    coachIds: ["c2"],
    practiceSummary: "Tuesdays and Thursdays, 6:00 PM to 8:00 PM",
    homeFacility: "Memorial High Main Gym",
  },
  {
    id: "t3",
    teamName: "12U Futures",
    ageGroup: "12U",
    season: "2026 Development Season",
    playerIds: ["p5", "p6"],
    coachIds: ["c3"],
    practiceSummary: "Sundays, 3:00 PM to 5:00 PM",
    homeFacility: "Altoona Family Center",
  },
];

const now = new Date();
const isoAt = (daysFromNow: number, hour24: number) =>
  new Date(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromNow, hour24, 0, 0),
  ).toISOString();

export const events: Event[] = [
  {
    id: "e1",
    eventName: "14U Elite Practice",
    eventType: "practice",
    description: "Skill work, offensive tempo, and final-set serving pressure.",
    startsAt: isoAt(2, 17),
    endsAt: isoAt(2, 19),
    teamIds: ["t1"],
    coachIds: ["c1"],
    playerIds: ["p1", "p2"],
    location: "Chippewa Valley Sports Center",
  },
  {
    id: "e2",
    eventName: "15U Blue Practice",
    eventType: "practice",
    description: "Serve receive and defensive transition emphasis.",
    startsAt: isoAt(3, 18),
    endsAt: isoAt(3, 20),
    teamIds: ["t2"],
    coachIds: ["c2"],
    playerIds: ["p3", "p4"],
    location: "Memorial High Main Gym",
  },
  {
    id: "e3",
    eventName: "Private Lesson Openings",
    eventType: "lesson",
    description: "One-on-one and small group openings focused on serving and setting.",
    startsAt: isoAt(4, 16),
    endsAt: isoAt(4, 19),
    teamIds: [],
    coachIds: ["c3"],
    playerIds: [],
    location: "Altoona Family Center",
  },
  {
    id: "e4",
    eventName: "Summer Skills Camp",
    eventType: "camp",
    description: "Three-hour training block covering passing platform work and attack timing.",
    startsAt: isoAt(10, 13),
    endsAt: isoAt(10, 16),
    teamIds: [],
    coachIds: ["c1", "c3"],
    playerIds: [],
    location: "UW-Eau Claire McPhee Center",
  },
  {
    id: "e5",
    eventName: "14U and 15U Club Tryouts",
    eventType: "tryouts",
    description: "Check in 30 minutes early with athlete profile and emergency contact form.",
    startsAt: isoAt(16, 9),
    endsAt: isoAt(16, 12),
    teamIds: ["t1", "t2"],
    coachIds: ["c1", "c2"],
    playerIds: [],
    location: "North High Auxiliary Gym",
  },
  {
    id: "e6",
    eventName: "Chippewa Valley Invitational",
    eventType: "tournament",
    description: "Regional event with morning pool play and afternoon bracket rounds.",
    startsAt: isoAt(21, 8),
    endsAt: isoAt(21, 17),
    teamIds: ["t1", "t2"],
    coachIds: ["c1", "c2"],
    playerIds: ["p1", "p2", "p3", "p4"],
    location: "Chippewa Valley Expo Center",
  },
];

export const camps: Camp[] = [
  {
    id: "camp-1",
    title: "Summer Skills Lab",
    season: "Summer 2026",
    dateLabel: "June 10 to June 12",
    ageRange: "12U to 16U",
    location: "UW-Eau Claire McPhee Center",
    price: "$195",
    focus: "Ball control, transition footwork, and live wash drills.",
    spotsLeft: 14,
  },
  {
    id: "camp-2",
    title: "Position Clinics",
    season: "Summer 2026",
    dateLabel: "July 8 and July 9",
    ageRange: "13U to 17U",
    location: "Chippewa Valley Sports Center",
    price: "$95",
    focus: "Setter and attacker-specific reps with video feedback.",
    spotsLeft: 9,
  },
  {
    id: "camp-3",
    title: "Pre-Tryout Tune-Up",
    season: "Fall 2026",
    dateLabel: "August 17",
    ageRange: "12U to 15U",
    location: "North High Auxiliary Gym",
    price: "$55",
    focus: "First-contact consistency, movement, and tryout readiness.",
    spotsLeft: 22,
  },
];

export const tryoutSessions: TryoutSession[] = [
  {
    id: "tryout-1",
    ageGroup: "12U and 13U",
    dateLabel: "August 24, 2026",
    timeLabel: "5:00 PM to 6:30 PM",
    location: "North High Auxiliary Gym",
    fee: "$25",
    notes: "Designed for development and first-club athletes.",
  },
  {
    id: "tryout-2",
    ageGroup: "14U and 15U",
    dateLabel: "August 24, 2026",
    timeLabel: "7:00 PM to 9:00 PM",
    location: "North High Auxiliary Gym",
    fee: "$30",
    notes: "Evaluation covers movement, first touch, and competitive play.",
  },
  {
    id: "tryout-3",
    ageGroup: "16U and 17U",
    dateLabel: "August 25, 2026",
    timeLabel: "6:00 PM to 8:30 PM",
    location: "Chippewa Valley Sports Center",
    fee: "$30",
    notes: "Intended for returning club athletes and high-level newcomers.",
  },
];

export const alumni: AlumniProfile[] = [
  { id: "a1", name: "Kendall Moore", college: "Winona State", position: "Outside Hitter", gradYear: 2024 },
  { id: "a2", name: "Brooke Larson", college: "UW-Stout", position: "Libero", gradYear: 2023 },
  { id: "a3", name: "Sydney Patel", college: "St. Cloud State", position: "Setter", gradYear: 2022 },
  { id: "a4", name: "Morgan Reed", college: "Gustavus Adolphus", position: "Middle", gradYear: 2021 },
];

export const invoices: Invoice[] = [
  { id: "inv-1", label: "Club Season Deposit", amount: "$350", dueDate: "May 15, 2026", status: "due" },
  { id: "inv-2", label: "June Training Installment", amount: "$180", dueDate: "June 1, 2026", status: "scheduled" },
  { id: "inv-3", label: "Uniform Package", amount: "$125", dueDate: "April 10, 2026", status: "paid" },
];

export const trainingPrograms: TrainingProgram[] = [
  {
    id: "tp1",
    title: "Camps",
    audience: "Players building all-around skill sets",
    cadence: "Seasonal sessions",
    summary: "High-volume reps, competition blocks, and coach feedback for broad development.",
  },
  {
    id: "tp2",
    title: "Team Intensives",
    audience: "Existing club teams",
    cadence: "Weekly or monthly",
    summary: "System-based training around side-out efficiency, transition, and serving runs.",
  },
  {
    id: "tp3",
    title: "Tryout Prep",
    audience: "Athletes entering club evaluations",
    cadence: "Short-form clinics",
    summary: "Movement, first touch, communication, and confidence-building under pressure.",
  },
];

export const privateLessonPackages: PrivateLessonPackage[] = [
  {
    id: "lp1",
    title: "Single Athlete Session",
    format: "1 athlete / 1 coach",
    duration: "60 minutes",
    price: "$85",
    focus: "Technical reps built around one primary skill objective.",
    coachId: "c3",
  },
  {
    id: "lp2",
    title: "Partner Lesson",
    format: "2 athletes / 1 coach",
    duration: "75 minutes",
    price: "$120",
    focus: "More contacts with competition built into every drill.",
    coachId: "c2",
  },
  {
    id: "lp3",
    title: "Small Group Accelerator",
    format: "3 to 4 athletes / 1 coach",
    duration: "90 minutes",
    price: "$160",
    focus: "Position-specific reps plus game-speed reads and communication.",
    coachId: "c1",
  },
];

export const adminTasks: AdminTask[] = [
  {
    id: "ad3",
    title: "Manage registrations",
    detail: "Choose a camp or tryout and register players directly from the roster.",
    actionLabel: "Open registration manager",
  },
];

export const homepageStats = [
  { label: "Club Teams", value: "3" },
  { label: "Upcoming Events", value: String(events.length) },
  { label: "College Alumni", value: String(alumni.length) },
  { label: "Open Camps", value: String(camps.length) },
];

export const portalHighlights = [
  "Pay season invoices in one place.",
  "View practice and tournament schedule by team.",
  "Track camp and tryout registrations for your athlete.",
];

export const registrationTracks = [
  {
    title: "Camp Registration",
    summary: "Reserve spots for seasonal camps, clinics, and training labs.",
  },
  {
    title: "Tryout Registration",
    summary: "Complete athlete information, emergency contacts, and age-group selection.",
  },
];
