import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { requireStorage } from "./client";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

function sanitizePathSegment(value: string, fallback: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-") || fallback;
}

export async function uploadPlayerPhoto(params: {
  file: File;
  playerId?: string | null;
  firstName: string;
  lastName: string;
}) {
  const safeFirstName = sanitizeFileName(params.firstName || "player");
  const safeLastName = sanitizeFileName(params.lastName || "photo");
  const safeFileName = sanitizeFileName(params.file.name || "photo");
  const pathPrefix = params.playerId ? `players/${params.playerId}` : "players/unassigned";
  const filePath = `${pathPrefix}/${safeFirstName}-${safeLastName}-${Date.now()}-${safeFileName}`;
  const storageRef = ref(requireStorage(), filePath);

  await uploadBytes(storageRef, params.file, {
    contentType: params.file.type || undefined,
  });

  return getDownloadURL(storageRef);
}

export async function uploadCoachPhoto(params: {
  file: File;
  coachId?: string | null;
  firstName: string;
  lastName: string;
}) {
  const safeFirstName = sanitizeFileName(params.firstName || "coach");
  const safeLastName = sanitizeFileName(params.lastName || "photo");
  const safeFileName = sanitizeFileName(params.file.name || "photo");
  const pathPrefix = params.coachId ? `coaches/${params.coachId}` : "coaches/unassigned";
  const filePath = `${pathPrefix}/${safeFirstName}-${safeLastName}-${Date.now()}-${safeFileName}`;
  const storageRef = ref(requireStorage(), filePath);

  await uploadBytes(storageRef, params.file, {
    contentType: params.file.type || undefined,
  });

  return getDownloadURL(storageRef);
}

export async function uploadExpenseReceipt(params: {
  file: File;
  userId: string;
  reportId?: string | null;
}) {
  const safeUserId = sanitizePathSegment(params.userId, "user");
  const safeFileName = sanitizeFileName(params.file.name || "receipt");
  const pathPrefix = params.reportId
    ? `expense-receipts/${safeUserId}/${params.reportId}`
    : `expense-receipts/${safeUserId}/unassigned`;
  const filePath = `${pathPrefix}/${Date.now()}-${safeFileName}`;
  const storageRef = ref(requireStorage(), filePath);

  await uploadBytes(storageRef, params.file, {
    contentType: params.file.type || undefined,
  });

  return getDownloadURL(storageRef);
}

export async function deletePhotoByUrl(photoUrl: string) {
  if (!photoUrl) {
    return;
  }

  try {
    await deleteObject(ref(requireStorage(), photoUrl));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "storage/object-not-found"
    ) {
      return;
    }

    throw error;
  }
}
