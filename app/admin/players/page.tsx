import { Suspense } from "react";
import PlayerManagerGate from "./PlayerManagerGate";

export default function AdminPlayersPage() {
  return (
    <Suspense fallback={null}>
      <PlayerManagerGate />
    </Suspense>
  );
}
