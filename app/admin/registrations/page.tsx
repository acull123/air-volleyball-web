import { Suspense } from "react";
import RegistrationManagerClient from "./RegistrationManagerClient";
import StaffAccessGate from "../scheduling/StaffAccessGate";

export default function AdminRegistrationsPage() {
  return (
    <StaffAccessGate
      eyebrow="Registration Manager"
      title="Registration Manager"
      description="Manage camp and tryout registrations for players."
      deniedMessage="You do not have access to manage registrations."
    >
      <Suspense fallback={null}>
        <RegistrationManagerClient />
      </Suspense>
    </StaffAccessGate>
  );
}
