import { getApp, getApps, initializeApp } from "firebase/app";
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from "firebase/firestore";
import type { EventDocument, RegistrationDocument } from "./schema";

const defaultFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAVpTSbKsShvB4So6D1VfjVKq9qgHT1_WQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "air-volleyball.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "air-volleyball",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "air-volleyball.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "356242498094",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:356242498094:web:4dc5c2fad5cdbdcc11f5bf",
};

function getServerFirebaseApp() {
  return getApps().length > 0 ? getApp() : initializeApp(defaultFirebaseConfig);
}

function getServerDb() {
  return getFirestore(getServerFirebaseApp());
}

export async function getEventByIdServer(eventId: string) {
  const snapshot = await getDoc(doc(getServerDb(), "events", eventId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    ...(snapshot.data() as EventDocument),
    id: snapshot.id,
  } as EventDocument;
}

export async function createRegistrationServer(
  input: Omit<RegistrationDocument, "id" | "createdAt" | "updatedAt">,
) {
  const ref = await addDoc(collection(getServerDb(), "registrations"), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}
