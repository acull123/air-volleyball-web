import ConflictManagerClient from "./ConflictManagerClient";
import StaffAccessGate from "../scheduling/StaffAccessGate";

export default function AdminConflictsPage() {
  return (
    <StaffAccessGate
      eyebrow="Conflict Manager"
      title="Conflict Manager"
      description="Review family scheduling conflicts before practice times are finalized."
      deniedMessage="You do not have access to review scheduling conflicts."
    >
      <ConflictManagerClient />
    </StaffAccessGate>
  );
}
