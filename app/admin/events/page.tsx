import EventManagerClient from "./EventManagerClient";
import StaffAccessGate from "../scheduling/StaffAccessGate";

export default function AdminEventsPage() {
  return (
    <StaffAccessGate
      eyebrow="Event Manager"
      title="Event Manager"
      description="Manage tournaments, camps, tryouts, and published team events."
      deniedMessage="You do not have access to manage events."
    >
      <EventManagerClient />
    </StaffAccessGate>
  );
}
