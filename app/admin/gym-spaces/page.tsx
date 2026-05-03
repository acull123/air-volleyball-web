import GymSpaceManagerClient from "./GymSpaceManagerClient";
import StaffAccessGate from "../scheduling/StaffAccessGate";

export default function AdminGymSpacesPage() {
  return (
    <StaffAccessGate
      eyebrow="Gym Space Manager"
      title="Gym Space Manager"
      description="Manage facilities, courts, and available practice windows."
      deniedMessage="You do not have access to manage gym spaces."
    >
      <GymSpaceManagerClient />
    </StaffAccessGate>
  );
}
