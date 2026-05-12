import {
  onSnapshot,
  query,
  type Query,
  type QueryDocumentSnapshot,
  type DocumentData,
  type FirestoreError,
  type QueryConstraint,
} from "firebase/firestore";
import { collectionRef, documentRef } from "./collections";
import type { CollectionName, FirestoreCollections } from "./schema";

type ErrorHandler = (error: FirestoreError) => void;

function withDocumentId<K extends CollectionName>(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): FirestoreCollections[K] {
  const data = snapshot.data() as FirestoreCollections[K];
  return {
    ...data,
    id: data.id || snapshot.id,
  };
}

export function subscribeToDocument<K extends CollectionName>(
  name: K,
  id: string,
  onData: (value: FirestoreCollections[K] | null) => void,
  onError?: ErrorHandler,
) {
  return onSnapshot(
    documentRef(name, id),
    (snapshot) => {
      onData(
        snapshot.exists()
          ? ({
              ...(snapshot.data() as FirestoreCollections[K]),
              id: (snapshot.data() as FirestoreCollections[K]).id || snapshot.id,
            } as FirestoreCollections[K])
          : null,
      );
    },
    onError,
  );
}

export function subscribeToCollection<K extends CollectionName>(
  name: K,
  onData: (value: FirestoreCollections[K][]) => void,
  options?: {
    constraints?: QueryConstraint[];
    onError?: ErrorHandler;
  },
) {
  const baseRef = collectionRef(name);
  const targetQuery: Query<DocumentData> =
    options?.constraints && options.constraints.length > 0 ? query(baseRef, ...options.constraints) : baseRef;

  return onSnapshot(
    targetQuery,
    (snapshot) => {
      onData(snapshot.docs.map((docItem) => withDocumentId<K>(docItem)));
    },
    options?.onError,
  );
}
