import { httpsCallable } from "firebase/functions";
import { requireFunctions } from "./client";

type BackfillTeamChatRoomsResult = {
  syncedCount: number;
};

export async function backfillTeamChatRooms() {
  const callable = httpsCallable<undefined, BackfillTeamChatRoomsResult>(
    requireFunctions(),
    "backfillTeamChatRooms",
  );
  const result = await callable(undefined);

  return result.data;
}
