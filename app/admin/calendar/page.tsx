import StaffAccessGate from "../scheduling/StaffAccessGate";
import CalendarManagerClient from "./CalendarManagerClient";

export default function AdminCalendarPage() {
  return (
    <StaffAccessGate
      eyebrow="Scheduling"
      title="Club Calendar"
      description="Review team events and family conflicts in a large monthly scheduling view."
      deniedMessage="You do not have access to the club calendar."
    >
      <CalendarManagerClient />
    </StaffAccessGate>
  );
}
