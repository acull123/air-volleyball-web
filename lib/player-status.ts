import type { PlayerDocument } from "@/lib/firebase/schema";

export function isCurrentPlayer(player: PlayerDocument) {
  return player.active !== false && player.isAlumni !== true;
}

export function isAlumniPlayer(player: PlayerDocument) {
  return player.isAlumni === true;
}
