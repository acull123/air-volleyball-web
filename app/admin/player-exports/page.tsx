import { Suspense } from "react";
import StaffAccessGate from "../scheduling/StaffAccessGate";
import PlayerExportsClient from "./PlayerExportsClient";

export default function PlayerExportsPage() {
  return (
    <StaffAccessGate
      eyebrow="Player Exports"
      title="Player Exports"
      description="Select camp and tryout events, then download spreadsheet-ready player registration lists."
      deniedMessage="You do not have access to export player lists."
    >
      <Suspense fallback={null}>
        <PlayerExportsClient />
      </Suspense>
    </StaffAccessGate>
  );
}
