import StaffAccessGate from "../../scheduling/StaffAccessGate";
import PaySetupManagerClient from "./PaySetupManagerClient";

export default function AdminPaySetupPage() {
  return (
    <StaffAccessGate
      eyebrow="Finances"
      title="Pay Setup"
      description="Manage coach pay types and event type matching."
      deniedMessage="You do not have access to pay setup."
    >
      <PaySetupManagerClient />
    </StaffAccessGate>
  );
}
