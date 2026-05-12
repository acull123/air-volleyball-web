"use client";

import { useEffect, useState } from "react";
import type { QueryConstraint } from "firebase/firestore";
import { firestoreApi } from "./api";
import type { CollectionName, FirestoreCollections } from "./schema";

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

type CollectionState<K extends CollectionName> = {
  key: string | null;
  data: FirestoreCollections[K][];
  error: string | null;
};

type DocumentState<K extends CollectionName> = {
  key: string | null;
  data: FirestoreCollections[K] | null;
  error: string | null;
};

export function useFirestoreCollection<K extends CollectionName>(
  name: K,
  options?: { constraints?: QueryConstraint[]; enabled?: boolean },
): LoadState<FirestoreCollections[K][]> {
  const isEnabled = options?.enabled !== false;
  const subscriptionKey = JSON.stringify([
    name,
    isEnabled,
    options?.constraints?.map((constraint) => constraint.type),
  ]);
  const [state, setState] = useState<CollectionState<K>>({
    key: null,
    data: [],
    error: null,
  });

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const unsubscribe = firestoreApi[name].subscribe(
      (data) =>
        setState({
          key: subscriptionKey,
          data: data as FirestoreCollections[K][],
          error: null,
        }),
      options?.constraints,
      (error) => setState({ key: subscriptionKey, data: [], error: error.message }),
    );

    return unsubscribe;
  }, [isEnabled, name, options?.constraints, subscriptionKey]);

  if (!isEnabled) {
    return { data: [], loading: false, error: null };
  }

  return {
    data: state.key === subscriptionKey ? state.data : [],
    loading: state.key !== subscriptionKey && state.error === null,
    error: state.key === subscriptionKey ? state.error : null,
  };
}

export function useFirestoreDocument<K extends CollectionName>(
  name: K,
  id: string | null,
  options?: { enabled?: boolean },
): LoadState<FirestoreCollections[K] | null> {
  const isEnabled = Boolean(id) && options?.enabled !== false;
  const subscriptionKey = JSON.stringify([name, id, isEnabled]);
  const [state, setState] = useState<DocumentState<K>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!id || !isEnabled) {
      return;
    }

    const unsubscribe = firestoreApi[name].subscribeById(
      id,
      (data) =>
        setState({
          key: subscriptionKey,
          data: data as FirestoreCollections[K] | null,
          error: null,
        }),
      (error) => setState({ key: subscriptionKey, data: null, error: error.message }),
    );

    return unsubscribe;
  }, [id, isEnabled, name, subscriptionKey]);

  if (!isEnabled) {
    return { data: null, loading: false, error: null };
  }

  return {
    data: state.key === subscriptionKey ? state.data : null,
    loading: state.key !== subscriptionKey && state.error === null,
    error: state.key === subscriptionKey ? state.error : null,
  };
}
