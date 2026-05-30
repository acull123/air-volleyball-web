export function getFriendlyFirebaseError(error: unknown, fallback: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "The email or password you entered is incorrect.";
  }

  if (code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (code === "auth/email-already-in-use") {
    return "An account already exists for that email address.";
  }

  if (code === "auth/weak-password") {
    return "Choose a stronger password with at least 6 characters.";
  }

  if (code === "auth/too-many-requests") {
    return "Too many attempts. Wait a bit and try again.";
  }

  if (code === "auth/network-request-failed" || code === "unavailable") {
    return "Network error. Check your connection and try again.";
  }

  if (code === "permission-denied") {
    return "You do not have permission to do that.";
  }

  if (code === "unauthenticated") {
    return "Sign in before continuing.";
  }

  if (code === "not-found") {
    return "That record could not be found.";
  }

  return fallback;
}
