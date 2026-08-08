import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyAVpTSbKsShvB4So6D1VfjVKq9qgHT1_WQ",
  authDomain: "air-volleyball.firebaseapp.com",
  projectId: "air-volleyball",
  storageBucket: "air-volleyball.firebasestorage.app",
  messagingSenderId: "356242498094",
  appId: "1:356242498094:web:4dc5c2fad5cdbdcc11f5bf",
  measurementId: "G-PFD6PTMB76",
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? defaultFirebaseConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? defaultFirebaseConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? defaultFirebaseConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? defaultFirebaseConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? defaultFirebaseConfig.appId,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? defaultFirebaseConfig.measurementId,
};

function missingConfigKeys() {
  return Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function getFirebaseApp() {
  const missing = missingConfigKeys();

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase configuration values: ${missing.join(", ")}. ` +
        "Provide them in lib/firebase/client.ts or as NEXT_PUBLIC_FIREBASE_* environment variables.",
    );
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export const firebaseApp = (() => {
  try {
    return getFirebaseApp();
  } catch {
    return null;
  }
})();

export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;
export const functions = firebaseApp ? getFunctions(firebaseApp) : null;

export function requireDb() {
  if (!db) {
    throw new Error(
      "Firestore has not been initialized. Check lib/firebase/client.ts or your NEXT_PUBLIC_FIREBASE_* env vars.",
    );
  }

  return db;
}

export function requireStorage() {
  if (!storage) {
    throw new Error(
      "Storage has not been initialized. Check lib/firebase/client.ts or your NEXT_PUBLIC_FIREBASE_* env vars.",
    );
  }

  return storage;
}

export function requireFunctions() {
  if (!functions) {
    throw new Error(
      "Firebase Functions has not been initialized. Check lib/firebase/client.ts or your NEXT_PUBLIC_FIREBASE_* env vars.",
    );
  }

  return functions;
}

let analyticsPromise: Promise<import("firebase/analytics").Analytics | null> | null = null;

export async function getFirebaseAnalytics() {
  if (typeof window === "undefined" || !firebaseApp) {
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      const { getAnalytics, isSupported } = await import("firebase/analytics");
      return (await isSupported()) ? getAnalytics(firebaseApp) : null;
    })();
  }

  return analyticsPromise;
}
