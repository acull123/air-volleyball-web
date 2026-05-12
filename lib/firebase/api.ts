import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type QueryDocumentSnapshot,
  updateDoc,
  where,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";
import { collectionRef, documentRef } from "./collections";
import { subscribeToCollection, subscribeToDocument } from "./live";
import type {
  CollectionName,
  CreateFirestoreDocumentInput,
  FirestoreCollections,
  UpdateDocumentInput,
} from "./schema";

function applyTimestamps<T extends { createdAt?: unknown; updatedAt?: unknown }>(
  data: T,
  mode: "create" | "update",
) {
  return {
    ...data,
    ...(mode === "create" ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  };
}

function withDocumentId<K extends CollectionName>(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): FirestoreCollections[K] {
  const data = snapshot.data() as FirestoreCollections[K];
  return {
    ...data,
    id: data.id || snapshot.id,
  };
}

async function listDocuments<K extends CollectionName>(
  name: K,
  constraints: QueryConstraint[] = [],
): Promise<FirestoreCollections[K][]> {
  const ref = collectionRef(name);
  const snapshot = constraints.length > 0 ? await getDocs(query(ref, ...constraints)) : await getDocs(ref);
  return snapshot.docs.map((item) => withDocumentId<K>(item));
}

async function getDocument<K extends CollectionName>(
  name: K,
  id: string,
): Promise<FirestoreCollections[K] | null> {
  const snapshot = await getDoc(documentRef(name, id));
  return snapshot.exists()
    ? ({
        ...(snapshot.data() as FirestoreCollections[K]),
        id: (snapshot.data() as FirestoreCollections[K]).id || snapshot.id,
      } as FirestoreCollections[K])
    : null;
}

async function createDocument<K extends CollectionName>(
  name: K,
  input: CreateFirestoreDocumentInput<FirestoreCollections[K]>,
) {
  const { id, ...rest } = input;

  if (id) {
    const ref = documentRef(name, id);
    await setDoc(ref, applyTimestamps({ id, ...rest }, "create") as FirestoreCollections[K]);
    return id;
  }

  const ref = await addDoc(collectionRef(name), applyTimestamps(rest, "create") as FirestoreCollections[K]);
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

async function updateDocument<K extends CollectionName>(
  name: K,
  id: string,
  input: UpdateDocumentInput<FirestoreCollections[K]>,
) {
  await updateDoc(documentRef(name, id), applyTimestamps(input, "update"));
}

async function removeDocument<K extends CollectionName>(name: K, id: string) {
  await deleteDoc(documentRef(name, id));
}

function buildCollectionStore<K extends CollectionName>(name: K) {
  return {
    getById: (id: string) => getDocument(name, id),
    list: (constraints?: QueryConstraint[]) => listDocuments(name, constraints ?? []),
    subscribeById: (
      id: string,
      onData: (value: FirestoreCollections[K] | null) => void,
      onError?: (error: Error) => void,
    ) => subscribeToDocument(name, id, onData, onError),
    subscribe: (
      onData: (value: FirestoreCollections[K][]) => void,
      constraints?: QueryConstraint[],
      onError?: (error: Error) => void,
    ) => subscribeToCollection(name, onData, { constraints, onError }),
    create: (input: CreateFirestoreDocumentInput<FirestoreCollections[K]>) =>
      createDocument(name, input),
    update: (id: string, input: UpdateDocumentInput<FirestoreCollections[K]>) =>
      updateDocument(name, id, input),
    remove: (id: string) => removeDocument(name, id),
  };
}

export const firestoreApi = {
  users: {
    ...buildCollectionStore("users"),
    listParents: () => listDocuments("users", [where("role", "==", "parent")]),
  },
  players: {
    ...buildCollectionStore("players"),
    listActive: () => listDocuments("players", [where("active", "==", true), orderBy("lastName")]),
    listByTeam: (teamId: string) =>
      listDocuments("players", [where("teamId", "==", teamId), where("active", "==", true)]),
  },
  teams: {
    ...buildCollectionStore("teams"),
    listActive: () => listDocuments("teams", [where("active", "==", true), orderBy("ageGroup")]),
    listBySeason: (season: string) =>
      listDocuments("teams", [where("season", "==", season), where("active", "==", true)]),
  },
  coaches: {
    ...buildCollectionStore("coaches"),
    listActive: () => listDocuments("coaches", [where("active", "==", true), orderBy("lastName")]),
  },
  gymSpaces: {
    ...buildCollectionStore("gymSpaces"),
    listActive: () => listDocuments("gymSpaces", [where("active", "==", true), orderBy("facilityName")]),
  },
  events: {
    ...buildCollectionStore("events"),
    listActive: () => listDocuments("events", [where("active", "==", true), orderBy("startDate")]),
    listByType: (type: FirestoreCollections["events"]["type"]) =>
      listDocuments("events", [where("type", "==", type), orderBy("startDate")]),
    listByTeam: async (teamId: string) =>
      (await listDocuments("events", [orderBy("startDate")])).filter((event) =>
        event.teamSchedules.some((entry) => entry.teamId === teamId),
      ),
  },
  schedules: {
    ...buildCollectionStore("schedules"),
    listByType: (type: FirestoreCollections["schedules"]["type"]) =>
      listDocuments("schedules", [where("type", "==", type), orderBy("updatedAt", "desc")]),
    listByTeam: (teamId: string) => listDocuments("schedules", [where("teamId", "==", teamId)]),
  },
  programs: {
    ...buildCollectionStore("programs"),
    listActive: () => listDocuments("programs", [where("active", "==", true), orderBy("title")]),
    listOpen: () =>
      listDocuments("programs", [
        where("active", "==", true),
        where("registrationOpen", "==", true),
        orderBy("registrationDeadline"),
      ]),
    listByType: (type: FirestoreCollections["programs"]["type"]) =>
      listDocuments("programs", [where("type", "==", type), where("active", "==", true)]),
  },
  registrations: {
    ...buildCollectionStore("registrations"),
    listByEvent: (eventId: string) =>
      listDocuments("registrations", [where("eventId", "==", eventId), orderBy("createdAt", "desc")]),
  },
  invoices: {
    ...buildCollectionStore("invoices"),
    listByUser: (userId: string) =>
      listDocuments("invoices", [where("userId", "==", userId), orderBy("dueDate")]),
    listByPlayer: (playerId: string) =>
      listDocuments("invoices", [where("playerId", "==", playerId), orderBy("dueDate")]),
  },
  expenseReports: {
    ...buildCollectionStore("expenseReports"),
    listByCoach: (coachUserId: string) =>
      listDocuments("expenseReports", [where("coachUserId", "==", coachUserId), orderBy("createdAt", "desc")]),
    listByStatus: (status: FirestoreCollections["expenseReports"]["status"]) =>
      listDocuments("expenseReports", [where("status", "==", status), orderBy("createdAt", "desc")]),
  },
  payCategories: {
    ...buildCollectionStore("payCategories"),
  },
  payTypes: {
    ...buildCollectionStore("payTypes"),
    listByCategory: (categoryId: string) =>
      listDocuments("payTypes", [where("categoryId", "==", categoryId)]),
  },
  conflicts: {
    ...buildCollectionStore("conflicts"),
    listByUser: (userId: string) =>
      listDocuments("conflicts", [where("userId", "==", userId), orderBy("startAt")]),
    listByPlayer: (playerId: string) =>
      listDocuments("conflicts", [where("playerId", "==", playerId), orderBy("startAt")]),
  },
  payments: {
    ...buildCollectionStore("payments"),
    listByInvoice: (invoiceId: string) =>
      listDocuments("payments", [where("invoiceId", "==", invoiceId), orderBy("createdAt", "desc")]),
  },
  alumni: {
    ...buildCollectionStore("alumni"),
    listActive: () => listDocuments("alumni", [where("active", "==", true), orderBy("gradYear", "desc")]),
  },
  pages: {
    ...buildCollectionStore("pages"),
    listPublished: () => listDocuments("pages", [where("published", "==", true)]),
    getBySlug: async (slug: FirestoreCollections["pages"]["slug"]) => {
      const items = await listDocuments("pages", [where("slug", "==", slug)]);
      return items[0] ?? null;
    },
  },
  announcements: {
    ...buildCollectionStore("announcements"),
    listActive: () =>
      listDocuments("announcements", [where("active", "==", true), orderBy("publishDate", "desc")]),
    listPublic: () =>
      listDocuments("announcements", [
        where("active", "==", true),
        where("audience", "==", "public"),
        orderBy("publishDate", "desc"),
      ]),
  },
};
