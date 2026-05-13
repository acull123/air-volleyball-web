import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type WithFieldValue,
} from "firebase/firestore";
import { requireDb } from "./client";
import type { CollectionName, FirestoreCollections } from "./schema";

export const collectionNames: CollectionName[] = [
  "users",
  "players",
  "teams",
  "coaches",
  "gymSpaces",
  "events",
  "schedules",
  "programs",
  "registrations",
  "invoices",
  "expenseReports",
  "payTypes",
  "conflicts",
  "payments",
  "alumni",
  "pages",
  "announcements",
];

export function collectionRef<K extends CollectionName>(
  name: K,
): CollectionReference<WithFieldValue<FirestoreCollections[K]>> {
  return collection(requireDb(), name) as CollectionReference<WithFieldValue<FirestoreCollections[K]>>;
}

export function documentRef<K extends CollectionName>(
  name: K,
  id: string,
): DocumentReference<WithFieldValue<FirestoreCollections[K]>> {
  return doc(requireDb(), name, id) as DocumentReference<WithFieldValue<FirestoreCollections[K]>>;
}
