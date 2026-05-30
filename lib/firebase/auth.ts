"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, requireDb } from "./client";
import { getFriendlyFirebaseError } from "./errors";
import type { UserDocument, UserRole } from "./schema";

export type AuthenticatedRoleUser = {
  firebaseUser: User;
  profile: UserDocument | null;
};

export function requireAuth() {
  if (!auth) {
    throw new Error("Firebase Auth has not been initialized.");
  }

  return auth;
}

export async function signInUser(email: string, password: string) {
  return signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(requireAuth(), email);
}

export async function createPortalAccount(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: "parent" | "player" | "unverifiedCoach";
  playerIds: string[];
}) {
  const credential = await createUserWithEmailAndPassword(
    requireAuth(),
    params.email,
    params.password,
  );

  try {
    await upsertUserProfile({
      uid: credential.user.uid,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone ?? "",
      role: params.role,
      playerIds: params.playerIds,
    });

    return credential;
  } catch (error) {
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  }
}

export async function signOutUser() {
  return signOut(requireAuth());
}

export function subscribeToAuthUser(
  onChange: (value: AuthenticatedRoleUser | null) => void,
  onError?: (error: Error) => void,
) {
  return onAuthStateChanged(
    requireAuth(),
    async (firebaseUser) => {
      if (!firebaseUser) {
        onChange(null);
        return;
      }

      try {
        const profile = await getUserProfile(firebaseUser.uid);
        onChange({ firebaseUser, profile });
      } catch (error) {
        onError?.(error as Error);
      }
    },
    onError,
  );
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(doc(requireDb(), "users", uid));
  return snapshot.exists() ? (snapshot.data() as UserDocument) : null;
}

export async function upsertUserProfile(params: {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  playerIds?: string[];
  coachId?: string;
  active?: boolean;
}) {
  const db = requireDb();
  const ref = doc(db, "users", params.uid);

  await setDoc(
    ref,
    {
      id: params.uid,
      authUid: params.uid,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone ?? "",
      role: params.role,
      playerIds: params.playerIds ?? [],
      coachId: params.coachId ?? "",
      active: params.active ?? true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateUserProfileFields(params: {
  uid: string;
  email?: string;
  firstName: string;
  lastName: string;
  phone?: string;
}) {
  const db = requireDb();
  const ref = doc(db, "users", params.uid);

  await setDoc(
    ref,
    {
      id: params.uid,
      authUid: params.uid,
      ...(params.email ? { email: params.email } : {}),
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone ?? "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function isRole(profile: UserDocument | null, role: UserRole) {
  return profile?.active !== false && profile?.role === role;
}

export function hasAnyRole(profile: UserDocument | null, roles: UserRole[]) {
  return profile && profile.active !== false ? roles.includes(profile.role) : false;
}

export function useAuthSession() {
  const [state, setState] = useState<{
    authUser: AuthenticatedRoleUser | null;
    loading: boolean;
    error: string | null;
  }>({
    authUser: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    return subscribeToAuthUser(
      (authUser) => {
        setState({
          authUser,
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState({
          authUser: null,
          loading: false,
          error: getFriendlyFirebaseError(error, "Unable to check sign-in status."),
        });
      },
    );
  }, []);

  return state;
}
