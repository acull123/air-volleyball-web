import type { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "parent" | "player" | "coach";
export type ScheduleType = "practice" | "season" | "tryout" | "camp";
export type ProgramType = "camp" | "training" | "tryout" | "privateLesson";
export type ClubEventType = "tournament" | "practice" | "camp" | "tryout";
export type RegisterableEventType = "camp" | "tryout";
export type RegistrationStatus = "submitted" | "confirmed" | "waitlisted" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type InvoiceStatus = "unpaid" | "paid" | "overdue" | "cancelled";
export type Provider = "stripe";
export type ProviderPaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type AnnouncementAudience = "public" | "players" | "parents" | "team";

export type FirestoreDate = Timestamp | null;
export type ServerDateInput = Timestamp | Date | null;

export interface BaseDocument {
  id: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
}

export interface UserDocument extends BaseDocument {
  authUid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  playerIds: string[];
}

export interface PlayerDocument extends BaseDocument {
  firstName: string;
  lastName: string;
  birthDate: string;
  position: string;
  jerseyNumber: number;
  teamId: string;
  bio: string;
  photoUrl: string;
  active: boolean;
}

export interface TeamDocument extends BaseDocument {
  name: string;
  season: string;
  ageGroup: string;
  level: string;
  practicesPerWeek: number;
  practiceDurationMinutes: number;
  coachIds: string[];
  playerIds: string[];
  scheduleId: string;
  photoUrl: string;
  description: string;
  active: boolean;
}

export interface CoachDocument extends BaseDocument {
  firstName: string;
  lastName: string;
  title: string;
  teamIds: string[];
  bio: string;
  photoUrl: string;
  email: string;
  phone: string;
  active: boolean;
}

export interface GymSpaceDocument extends BaseDocument {
  facilityName: string;
  courtCount: number;
  location: string;
  availableDays: string[];
  startTime: string;
  endTime: string;
  blockedDates: string;
  notes: string;
  active: boolean;
}

export interface EventDocument extends BaseDocument {
  type: ClubEventType;
  title: string;
  teamId: string;
  ageGroup: string;
  price: number;
  paymentUrl: string;
  startDate: string;
  endDate: string;
  startTime: string;
  location: string;
  notes: string;
  active: boolean;
}

export interface ScheduleItem {
  id: string;
  title: string;
  startDateTime: FirestoreDate;
  endDateTime: FirestoreDate;
  location: string;
  notes: string;
}

export interface ScheduleDocument extends BaseDocument {
  type: ScheduleType;
  title: string;
  teamId: string | null;
  season: string;
  items: ScheduleItem[];
}

export interface ProgramDocument extends BaseDocument {
  type: ProgramType;
  title: string;
  description: string;
  ageGroups: string[];
  dates: FirestoreDate[];
  location: string;
  price: number;
  registrationOpen: boolean;
  registrationDeadline: FirestoreDate;
  capacity: number;
  imageUrl: string;
  active: boolean;
}

export interface RegistrationDocument extends BaseDocument {
  eventId: string;
  eventTitle: string;
  eventType: RegisterableEventType;
  eventPrice: number;
  playerId: string;
  isNewPlayer: boolean;
  athleteFirstName: string;
  athleteLastName: string;
  birthDate: string;
  position: string;
  parentName: string;
  paymentProvider: "paypal" | "";
  paymentOrderId: string;
  paymentCaptureId: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
}

export interface InvoiceDocument extends BaseDocument {
  userId: string;
  playerId: string;
  teamId: string;
  title: string;
  description: string;
  amount: number;
  dueDate: FirestoreDate;
  status: InvoiceStatus;
  paymentUrl: string;
  paidAt: FirestoreDate;
}

export interface PaymentDocument {
  id: string;
  invoiceId: string;
  userId: string;
  playerId: string;
  amount: number;
  provider: Provider;
  providerPaymentId: string;
  status: ProviderPaymentStatus;
  paidAt: FirestoreDate;
  createdAt: FirestoreDate;
}

export interface AlumniDocument extends BaseDocument {
  firstName: string;
  lastName: string;
  gradYear: number;
  college: string;
  achievements: string;
  photoUrl: string;
  active: boolean;
}

export interface PageSection {
  heading: string;
  body: string;
  imageUrl: string;
  buttonText: string;
  buttonUrl: string;
}

export interface PageDocument {
  id: string;
  slug: "about-us" | "training" | "tryouts" | "private-lessons";
  title: string;
  content: string;
  heroImageUrl: string;
  sections: PageSection[];
  published: boolean;
  updatedAt: FirestoreDate;
}

export interface AnnouncementDocument extends BaseDocument {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  teamId: string | null;
  publishDate: FirestoreDate;
  expiresAt: FirestoreDate;
  active: boolean;
}

export interface FirestoreCollections {
  users: UserDocument;
  players: PlayerDocument;
  teams: TeamDocument;
  coaches: CoachDocument;
  gymSpaces: GymSpaceDocument;
  events: EventDocument;
  schedules: ScheduleDocument;
  programs: ProgramDocument;
  registrations: RegistrationDocument;
  invoices: InvoiceDocument;
  payments: PaymentDocument;
  alumni: AlumniDocument;
  pages: PageDocument;
  announcements: AnnouncementDocument;
}

export type CollectionName = keyof FirestoreCollections;

export type CreateFirestoreDocumentInput<T extends { id: string }> = Omit<
  T,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

export type UpdateDocumentInput<T extends { id: string }> = Partial<
  Omit<T, "id" | "createdAt" | "updatedAt">
>;
