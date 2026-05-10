import StaffAccessGate from "../../scheduling/StaffAccessGate";
import ExpenseReportManagerClient from "./ExpenseReportManagerClient";

export default function AdminExpenseReportsPage() {
  return (
    <StaffAccessGate
      eyebrow="Finances"
      title="Expense Reports"
      description="Submit and review coach expense reports."
      deniedMessage="You do not have access to expense reports."
    >
      <ExpenseReportManagerClient />
    </StaffAccessGate>
  );
}
