const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

exports.sendChatMessageNotification = onDocumentCreated("chatMessages/{messageId}", async (event) => {
  const snapshot = event.data;

  if (!snapshot) {
    return;
  }

  const message = snapshot.data();

  if (!message || message.notificationSent === true || !message.roomId || !message.senderId) {
    return;
  }

  const roomSnapshot = await db.collection("chatRooms").doc(message.roomId).get();

  if (!roomSnapshot.exists) {
    await snapshot.ref.update({
      notificationSent: true,
      notificationError: "Chat room not found.",
      notificationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const room = roomSnapshot.data();
  const recipientUserIds = await getRecipientUserIds(room, message.senderId);

  if (recipientUserIds.length === 0) {
    await snapshot.ref.update({
      notificationSent: true,
      notificationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const tokenSnapshots = await Promise.all(
    recipientUserIds.map((userId) =>
      db.collection("pushTokens").where("userId", "==", userId).where("active", "==", true).get(),
    ),
  );
  const tokens = Array.from(
    new Set(
      tokenSnapshots
        .flatMap((tokenSnapshot) => tokenSnapshot.docs.map((tokenDoc) => tokenDoc.data().token))
        .filter((token) => typeof token === "string" && token.length > 0),
    ),
  );

  if (tokens.length === 0) {
    await snapshot.ref.update({
      notificationSent: true,
      notificationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const title = room.type === "team" ? room.title || "Team message" : message.senderName || "New message";
  const body = String(message.text || "New message").slice(0, 180);
  const responses = [];

  try {
    for (const tokenChunk of chunk(tokens, 500)) {
      const response = await messaging.sendEachForMulticast({
        tokens: tokenChunk,
        notification: {
          title,
          body,
        },
        data: {
          roomId: message.roomId,
          messageId: snapshot.id,
          type: "chatMessage",
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
            },
          },
        },
        android: {
          notification: {
            sound: "default",
          },
        },
      });

      responses.push(response);
      await deactivateInvalidTokens(tokenChunk, response.responses);
    }
  } catch (error) {
    const notificationErrors = getNotificationErrorCodesFromError(error);
    const notificationDiagnostic = getPushFailureDiagnostic(notificationErrors);
    await snapshot.ref.update({
      notificationSent: true,
      notificationSuccessCount: responses.reduce((sum, response) => sum + response.successCount, 0),
      notificationFailureCount: tokens.length,
      notificationError: getErrorMessage(error),
      ...(notificationErrors.length > 0 ? { notificationErrors } : {}),
      ...(notificationDiagnostic ? { notificationDiagnostic } : {}),
      notificationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const successCount = responses.reduce((sum, response) => sum + response.successCount, 0);
  const failureCount = responses.reduce((sum, response) => sum + response.failureCount, 0);
  const notificationErrors = getNotificationErrors(responses);
  const notificationDiagnostic = getPushFailureDiagnostic(notificationErrors);

  await snapshot.ref.update({
    notificationSent: true,
    notificationSuccessCount: successCount,
    notificationFailureCount: failureCount,
    ...(notificationErrors.length > 0 ? { notificationErrors } : {}),
    ...(notificationDiagnostic ? { notificationDiagnostic } : {}),
    notificationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

exports.syncTeamChatRoom = onDocumentWritten("teams/{teamId}", async (event) => {
  const afterSnapshot = event.data && event.data.after;
  const beforeSnapshot = event.data && event.data.before;
  const teamId = event.params.teamId;
  const roomRef = db.collection("chatRooms").doc(`team_${teamId}`);

  if (!afterSnapshot || !afterSnapshot.exists) {
    await roomRef.update({
      active: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => undefined);
    return;
  }

  const team = afterSnapshot.data();

  await syncTeamRoom(teamId, team, !beforeSnapshot || !beforeSnapshot.exists);
});

exports.backfillTeamChatRooms = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to backfill team chat rooms.");
  }

  const userSnapshot = await db.collection("users").doc(request.auth.uid).get();
  const user = userSnapshot.exists ? userSnapshot.data() : null;

  if (!user || user.role !== "admin" || user.active === false) {
    throw new HttpsError("permission-denied", "Only active admins can backfill team chat rooms.");
  }

  const teamsSnapshot = await db.collection("teams").get();
  let syncedCount = 0;

  for (const teamDoc of teamsSnapshot.docs) {
    const roomRef = db.collection("chatRooms").doc(`team_${teamDoc.id}`);
    const roomSnapshot = await roomRef.get();

    await syncTeamRoom(teamDoc.id, teamDoc.data(), !roomSnapshot.exists);
    syncedCount += 1;
  }

  return { syncedCount };
});

exports.sendTestPushNotification = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to send a test notification.");
  }

  const tokenSnapshot = await db
    .collection("pushTokens")
    .where("userId", "==", request.auth.uid)
    .where("active", "==", true)
    .get();
  const tokens = Array.from(
    new Set(
      tokenSnapshot.docs
        .map((tokenDoc) => tokenDoc.data().token)
        .filter((token) => typeof token === "string" && token.length > 0),
    ),
  );

  if (tokens.length === 0) {
    throw new HttpsError("failed-precondition", "No active push notification tokens are saved for this account.");
  }

  const responses = [];

  try {
    for (const tokenChunk of chunk(tokens, 500)) {
      const response = await messaging.sendEachForMulticast({
        tokens: tokenChunk,
        notification: {
          title: "Air Volleyball",
          body: "Test message notification received.",
        },
        data: {
          type: "chatMessage",
          roomId: "",
          messageId: "",
          test: "true",
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
            },
          },
        },
        android: {
          notification: {
            sound: "default",
          },
        },
      });

      responses.push(response);
      await deactivateInvalidTokens(tokenChunk, response.responses);
    }
  } catch (error) {
    const errors = getNotificationErrorCodesFromError(error);

    throw new HttpsError("failed-precondition", getPushFailureMessage(errors, getErrorMessage(error)), {
      errors,
      diagnostic: getPushFailureDiagnostic(errors),
    });
  }

  const successCount = responses.reduce((sum, response) => sum + response.successCount, 0);
  const failureCount = responses.reduce((sum, response) => sum + response.failureCount, 0);
  const errors = getNotificationErrors(responses);

  if (successCount === 0) {
    throw new HttpsError(
      "failed-precondition",
      getPushFailureMessage(errors, "Test notification failed."),
      {
        errors,
        diagnostic: getPushFailureDiagnostic(errors),
      },
    );
  }

  return {
    activeTokenCount: tokens.length,
    successCount,
    failureCount,
    errors,
  };
});

async function getRecipientUserIds(room, senderId) {
  const recipientIds = new Set((Array.isArray(room.participantUserIds) ? room.participantUserIds : []).filter(Boolean));

  if (room.type === "team") {
    const playerIds = Array.isArray(room.participantPlayerIds) ? room.participantPlayerIds.filter(Boolean) : [];

    for (const playerId of playerIds) {
      const userSnapshot = await db.collection("users").where("playerIds", "array-contains", playerId).get();
      userSnapshot.docs.forEach((userDoc) => recipientIds.add(userDoc.id));
    }
  }

  recipientIds.delete(senderId);
  return Array.from(recipientIds);
}

async function deactivateInvalidTokens(tokens, sendResponses) {
  const invalidTokenCodes = new Set([
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
  ]);
  const updates = [];

  sendResponses.forEach((response, index) => {
    if (!response.success && response.error && invalidTokenCodes.has(response.error.code)) {
      updates.push(deactivateToken(tokens[index]));
    }
  });

  await Promise.all(updates);
}

async function deactivateToken(token) {
  const snapshot = await db.collection("pushTokens").where("token", "==", token).get();
  const batch = db.batch();

  snapshot.docs.forEach((tokenDoc) => {
    batch.update(tokenDoc.ref, {
      active: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}

async function syncTeamRoom(teamId, team, includeCreateDefaults) {
  const roomRef = db.collection("chatRooms").doc(`team_${teamId}`);

  await roomRef.set(
    {
      id: `team_${teamId}`,
      type: "team",
      title: team.name || "Team Chat",
      teamId,
      participantUserIds: [],
      participantPlayerIds: Array.isArray(team.playerIds) ? team.playerIds.filter(Boolean) : [],
      active: team.active !== false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(includeCreateDefaults
        ? {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageText: "",
            lastMessageSenderId: "",
            lastMessageAt: null,
          }
        : {}),
    },
    { merge: true },
  );
}

function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getNotificationErrors(responses) {
  return getNotificationErrorCodes(responses).slice(0, 10);
}

function getNotificationErrorCodes(responses) {
  return Array.from(
    new Set(
      responses.flatMap((response) =>
        response.responses
          .filter((sendResponse) => !sendResponse.success && sendResponse.error)
          .map((sendResponse) => sendResponse.error.code || sendResponse.error.message || "unknown-error"),
      ),
    ),
  );
}

function getNotificationErrorCodesFromError(error) {
  const codes = [
    error && error.code,
    error && error.errorInfo && error.errorInfo.code,
    error && error.details && error.details.errorCode,
  ].filter((code) => typeof code === "string" && code.length > 0);
  const message = getErrorMessage(error);

  if (/THIRD_PARTY_AUTH_ERROR|third-party-auth|APNS_AUTH_ERROR/i.test(message)) {
    codes.push("messaging/third-party-auth-error");
  }

  return Array.from(new Set(codes)).slice(0, 10);
}

function getPushFailureMessage(errors, fallback) {
  const diagnostic = getPushFailureDiagnostic(errors);
  const errorList = errors.length > 0 ? ` (${errors.join(", ")})` : "";

  return diagnostic ? `${diagnostic}${errorList}` : `${fallback}${errorList}`;
}

function getPushFailureDiagnostic(errors) {
  if (
    errors.some((error) =>
      [
        "messaging/third-party-auth-error",
        "THIRD_PARTY_AUTH_ERROR",
        "APNS_AUTH_ERROR",
      ].includes(error),
    )
  ) {
    return "Firebase could not deliver this iOS notification because the APNs authentication key or certificate is missing, invalid, or not linked to this app in Firebase.";
  }

  if (errors.some((error) => error === "messaging/mismatched-credential" || error === "messaging/sender-id-mismatch")) {
    return "Firebase rejected this token because it belongs to a different Firebase project or sender ID.";
  }

  if (errors.some((error) => error === "messaging/invalid-registration-token")) {
    return "Firebase rejected the saved push token as invalid. Retry push setup on the device.";
  }

  if (errors.some((error) => error === "messaging/registration-token-not-registered")) {
    return "Firebase says this device token is no longer registered. Retry push setup on the device.";
  }

  return "";
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error || "Unknown notification error.");
}
