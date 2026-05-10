# Firestore Setup

This project is scaffolded to use the Firebase Web SDK directly from the Next.js app for real-time reads and writes.

## Project config

The Air Firebase web config is already wired into `lib/firebase/client.ts`:

```ts
projectId: "air-volleyball"
authDomain: "air-volleyball.firebaseapp.com"
measurementId: "G-PFD6PTMB76"
```

## Optional environment overrides

If you want to override the embedded config per environment, add these values locally:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

## Payment setup

PayPal checkout on the registration page expects these environment values:

```bash
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=sandbox
```

Use `PAYPAL_ENV=live` when you are ready to switch out of sandbox.

## Firestore structure

The Firestore data layer lives in `lib/firebase/`:

- `client.ts`: Firebase app, auth, analytics, and Firestore initialization.
- `storage.ts`: player photo upload helper for Cloud Storage.
- `schema.ts`: TypeScript schema matching the Air collections.
- `collections.ts`: typed collection and document refs.
- `live.ts`: generic `onSnapshot` listeners for real-time subscriptions.
- `api.ts`: collection-specific data access helpers.
- `hooks.ts`: React hooks for direct client usage.

## Main collections

The schema currently includes:

- `users`
- `players`
- `teams`
- `coaches`
- `gymSpaces`
- `events`
- `schedules`
- `programs`
- `registrations`
- `invoices`
- `payments`
- `alumni`
- `pages`
- `announcements`

## Example usage

```ts
import { firestoreApi } from "@/lib/firebase";

const activeTeams = await firestoreApi.teams.listActive();

const unsubscribe = firestoreApi.programs.subscribe((programs) => {
  console.log(programs);
});
```

## Rules

The repo now includes a starter rules file at `firestore.rules`.

Current access model:

- public read: `players`, `teams`, `coaches`, `events`, `pages`, `alumni`, `announcements`
- staff read/write: `gymSpaces`
- staff write: `players`, `teams`, `coaches`, `events`, `schedules`
- admin-only write: `users`, `programs`, `pages`, `alumni`, `announcements`, `invoices`, `payments`

To use it, paste the contents of `firestore.rules` into the Firestore Rules editor in the console and publish it.

Player photo uploads also require Cloud Storage rules that let staff write player images. The repo now includes `storage.rules` for that. Paste it into the Storage Rules editor in the console and publish it if uploads fail with a permission error.

## Migration note

The site still uses `app/mock/data.ts` for display content today. The new Firestore layer is intended to replace those imports page by page.
