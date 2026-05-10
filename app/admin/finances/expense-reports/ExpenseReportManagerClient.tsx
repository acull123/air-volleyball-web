"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Timestamp, where, type QueryConstraint } from "firebase/firestore";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { useAuthSession } from "@/lib/firebase/auth";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import type { ExpenseReportDocument } from "@/lib/firebase/schema";
import { uploadExpenseReceipt } from "@/lib/firebase/storage";
import { toExternalHref } from "@/lib/url";

type ExpenseDraft = {
  title: string;
  amount: string;
  expenseDate: string;
  notes: string;
};

type ExpenseStatusFilter = ExpenseReportDocument["status"] | "all";

const emptyDraft: ExpenseDraft = {
  title: "",
  amount: "",
  expenseDate: "",
  notes: "",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

function formatDate(value: string) {
  if (!value) {
    return "Date not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getReportSortTime(report: ExpenseReportDocument) {
  const createdAtTime = report.createdAt?.toMillis?.() ?? 0;
  const expenseDateTime = report.expenseDate ? new Date(report.expenseDate).getTime() : 0;

  return createdAtTime || (Number.isNaN(expenseDateTime) ? 0 : expenseDateTime);
}

function statusClassName(status: ExpenseReportDocument["status"]) {
  if (status === "paid") {
    return "bg-sky-50 text-sky-700";
  }

  if (status === "accepted") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-800";
}

export default function ExpenseReportManagerClient() {
  const access = useAuthSession();
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const role = access.authUser?.profile?.role ?? null;
  const uid = access.authUser?.firebaseUser.uid ?? "";
  const isAdmin = role === "admin";
  const isCoach = role === "coach";
  const expenseReportConstraints = useMemo<QueryConstraint[] | undefined>(() => {
    if (isAdmin) {
      return undefined;
    }

    return uid ? [where("coachUserId", "==", uid)] : undefined;
  }, [isAdmin, uid]);
  const expenseReports = useFirestoreCollection("expenseReports", {
    enabled: isAdmin || Boolean(uid),
    constraints: expenseReportConstraints,
  });
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileName, setReceiptFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatusFilter>("all");
  const [coachFilter, setCoachFilter] = useState("all");

  const sortedExpenseReports = useMemo(
    () =>
      [...expenseReports.data].sort((left, right) => getReportSortTime(right) - getReportSortTime(left)),
    [expenseReports.data],
  );
  const coachFilterOptions = useMemo(() => {
    const coachMap = new Map<string, string>();

    sortedExpenseReports.forEach((report) => {
      coachMap.set(report.coachUserId, report.coachName || report.coachEmail || "Coach");
    });

    return [...coachMap.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [sortedExpenseReports]);
  const coachFilteredExpenseReports = useMemo(
    () =>
      sortedExpenseReports.filter((report) => {
        return coachFilter === "all" || report.coachUserId === coachFilter;
      }),
    [coachFilter, sortedExpenseReports],
  );
  const visibleExpenseReports = useMemo(
    () =>
      coachFilteredExpenseReports.filter((report) => {
        return statusFilter === "all" || report.status === statusFilter;
      }),
    [coachFilteredExpenseReports, statusFilter],
  );
  const expenseSummary = useMemo(() => {
    return coachFilteredExpenseReports.reduce(
      (summary, report) => {
        summary.total += report.amount || 0;
        summary[report.status] += report.amount || 0;
        summary.counts[report.status] += 1;
        return summary;
      },
      {
        total: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
        paid: 0,
        counts: {
          pending: 0,
          accepted: 0,
          rejected: 0,
          paid: 0,
        },
      },
    );
  }, [coachFilteredExpenseReports]);
  const bulkNextStatus =
    statusFilter === "pending" ? "accepted" : statusFilter === "accepted" ? "paid" : null;
  const canBulkTransition =
    isAdmin && coachFilter !== "all" && bulkNextStatus !== null && visibleExpenseReports.length > 0;
  const selectedCoachName =
    coachFilter === "all"
      ? ""
      : coachFilterOptions.find(([coachUserId]) => coachUserId === coachFilter)?.[1] ?? "selected coach";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!access.authUser?.firebaseUser.uid || !access.authUser.profile) {
      setError("You must be signed in to submit an expense report.");
      return;
    }

    const amount = draft.amount.trim() ? Number(draft.amount) : 0;

    if (!draft.title.trim() || !draft.expenseDate || amount <= 0 || Number.isNaN(amount)) {
      setError("Title, expense date, and a valid amount are required.");
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const reportId = crypto.randomUUID();

      await firestoreApi.expenseReports.create({
        id: reportId,
        coachUserId: access.authUser.firebaseUser.uid,
        coachName: `${access.authUser.profile.firstName} ${access.authUser.profile.lastName}`.trim(),
        coachEmail: access.authUser.profile.email || access.authUser.firebaseUser.email || "",
        title: draft.title.trim(),
        amount,
        expenseDate: draft.expenseDate,
        notes: draft.notes.trim(),
        receiptUrl: "",
        receiptFileName: "",
        status: "pending",
        reviewedAt: null,
        reviewedBy: "",
        paidAt: null,
        paidBy: "",
      });

      let receiptUploadFailed = false;

      if (receiptFile) {
        try {
          const receiptUrl = await uploadExpenseReceipt({
            file: receiptFile,
            userId: access.authUser.firebaseUser.uid,
            reportId,
          });

          await firestoreApi.expenseReports.update(reportId, {
            receiptUrl,
            receiptFileName,
          });
        } catch (receiptError) {
          receiptUploadFailed = true;
          setError(
            receiptError instanceof Error
              ? `Expense report submitted, but the receipt did not upload: ${receiptError.message}`
              : "Expense report submitted, but the receipt did not upload.",
          );
        }
      }

      setDraft(emptyDraft);
      setReceiptFile(null);
      setReceiptFileName("");
      if (receiptInputRef.current) {
        receiptInputRef.current.value = "";
      }
      setStatus(receiptUploadFailed ? null : "Expense report submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit expense report.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewExpenseReport(reportId: string, nextStatus: "accepted" | "rejected" | "paid") {
    if (!access.authUser?.firebaseUser.uid) {
      setError("You must be signed in to review expense reports.");
      return;
    }

    setReviewingId(reportId);
    setStatus(null);
    setError(null);

    try {
      await firestoreApi.expenseReports.update(reportId, {
        status: nextStatus,
        ...(nextStatus === "paid"
          ? {
              paidAt: Timestamp.now(),
              paidBy: access.authUser.firebaseUser.uid,
            }
          : {
              reviewedAt: Timestamp.now(),
              reviewedBy: access.authUser.firebaseUser.uid,
            }),
      });
      setStatus(`Expense report ${nextStatus}.`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to update expense report.");
    } finally {
      setReviewingId(null);
    }
  }

  async function bulkTransitionVisibleReports() {
    if (!access.authUser?.firebaseUser.uid || !bulkNextStatus) {
      setError("Choose a coach and a pending or accepted status before running a bulk update.");
      return;
    }

    const confirmed = window.confirm(
      `Move ${visibleExpenseReports.length} ${statusFilter} expense reports for ${selectedCoachName} to ${bulkNextStatus}?`,
    );

    if (!confirmed) {
      return;
    }

    setBulkUpdating(true);
    setStatus(null);
    setError(null);

    try {
      await Promise.all(
        visibleExpenseReports.map((report) =>
          firestoreApi.expenseReports.update(report.id, {
            status: bulkNextStatus,
            ...(bulkNextStatus === "paid"
              ? {
                  paidAt: Timestamp.now(),
                  paidBy: access.authUser!.firebaseUser.uid,
                }
              : {
                  reviewedAt: Timestamp.now(),
                  reviewedBy: access.authUser!.firebaseUser.uid,
                }),
          }),
        ),
      );
      setStatus(`${visibleExpenseReports.length} expense reports moved to ${bulkNextStatus}.`);
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Unable to update expense reports.");
    } finally {
      setBulkUpdating(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Finances"
        title="Expense Reports"
        description="Coaches can submit expenses, while admins can review every report and accept or reject pending items."
        actions={[
          isAdmin
            ? { href: "/admin/dashboard", label: "Admin Dashboard" }
            : { href: "/admin/players", label: "Player Manager" },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        {(isCoach || isAdmin) && (
          <SectionCard title="Submit Expense Report" kicker="Coach Entry">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Expense title
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="Example: Tournament hotel"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Amount
                <input
                  value={draft.amount}
                  onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Expense date
                <input
                  value={draft.expenseDate}
                  onChange={(event) => setDraft((current) => ({ ...current, expenseDate: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  type="date"
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Notes
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-28 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="Add context for the expense."
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Receipt photo (optional)
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setReceiptFile(file);
                    setReceiptFileName(file?.name ?? "");
                  }}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                />
                <span className="text-xs font-medium text-[color:var(--muted)]">
                  {receiptFileName ? `Selected: ${receiptFileName}` : "Upload a receipt image or PDF."}
                </span>
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Submitting..." : "Submit Expense"}
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        <SectionCard
          title={isAdmin ? "All Expense Reports" : "My Expense Reports"}
          kicker={isAdmin ? "Admin Review" : "Submission History"}
        >
          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
              Status filter
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ExpenseStatusFilter)}
                className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            {isAdmin && (
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Coach filter
                <select
                  value={coachFilter}
                  onChange={(event) => setCoachFilter(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  <option value="all">All coaches</option>
                  {coachFilterOptions.map(([coachUserId, coachName]) => (
                    <option key={coachUserId} value={coachUserId}>
                      {coachName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {isAdmin && coachFilter !== "all" && statusFilter !== "all" && (
            <div className="mb-5 rounded-2xl border border-[color:var(--line)] bg-white px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-[color:var(--ink)]">
                    Bulk update: {selectedCoachName}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {bulkNextStatus
                      ? `${visibleExpenseReports.length} ${statusFilter} reports can move to ${bulkNextStatus}.`
                      : "Bulk transitions are available for pending and accepted reports."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canBulkTransition || bulkUpdating}
                  onClick={() => void bulkTransitionVisibleReports()}
                  className="w-fit rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkUpdating
                    ? "Updating..."
                    : bulkNextStatus
                      ? `Move all to ${bulkNextStatus}`
                      : "No bulk action"}
                </button>
              </div>
            </div>
          )}

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Pending", "pending", expenseSummary.counts.pending, expenseSummary.pending],
              ["Accepted", "accepted", expenseSummary.counts.accepted, expenseSummary.accepted],
              ["Paid", "paid", expenseSummary.counts.paid, expenseSummary.paid],
              ["Rejected", "rejected", expenseSummary.counts.rejected, expenseSummary.rejected],
            ].map(([label, filterValue, count, amount]) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setStatusFilter((current) =>
                    current === filterValue ? "all" : (filterValue as ExpenseStatusFilter),
                  )
                }
                className={`rounded-2xl px-4 py-4 text-left transition ${
                  statusFilter === filterValue
                    ? "bg-[color:var(--ink)] text-white"
                    : "bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-white"
                }`}
              >
                <p className={`text-xs font-bold uppercase tracking-[0.18em] ${statusFilter === filterValue ? "text-white/70" : "text-[color:var(--muted)]"}`}>
                  {label}
                </p>
                <p className={`mt-2 text-2xl font-bold ${statusFilter === filterValue ? "text-white" : "text-[color:var(--ink)]"}`}>
                  {formatMoney(Number(amount))}
                </p>
                <p className={`mt-1 text-sm ${statusFilter === filterValue ? "text-white/70" : "text-[color:var(--muted)]"}`}>
                  {count} reports
                </p>
              </button>
            ))}
          </div>

          {expenseReports.loading ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Loading expense reports...
            </div>
          ) : expenseReports.error ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Expense reports are unavailable right now.
            </div>
          ) : visibleExpenseReports.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              No expense reports have been submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleExpenseReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-[1.5rem] border border-[color:var(--line)] bg-white px-5 py-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-[color:var(--ink)]">{report.title}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${statusClassName(report.status)}`}>
                          {report.status}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                        <p>{formatMoney(report.amount)} · {formatDate(report.expenseDate)}</p>
                        <p>{report.coachName || report.coachEmail || "Coach"}</p>
                        {report.receiptUrl && (
                          <p>
                            <a
                              href={toExternalHref(report.receiptUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-[color:var(--ink)] underline decoration-[color:var(--line)] underline-offset-4"
                            >
                              Open receipt
                            </a>
                            {report.receiptFileName ? ` · ${report.receiptFileName}` : ""}
                          </p>
                        )}
                      </div>
                      {report.notes && (
                        <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{report.notes}</p>
                      )}
                    </div>
                    {isAdmin && report.status === "pending" && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={reviewingId === report.id}
                          onClick={() => void reviewExpenseReport(report.id, "accepted")}
                          className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === report.id}
                          onClick={() => void reviewExpenseReport(report.id, "rejected")}
                          className="rounded-full border border-[#e7b8b8] px-4 py-2 text-sm font-semibold text-[#8a2d2d] transition hover:bg-[#fff2f2] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {isAdmin && report.status === "accepted" && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={reviewingId === report.id}
                          onClick={() => void reviewExpenseReport(report.id, "paid")}
                          className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Mark paid
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {status && <p className="mt-4 text-sm text-[color:var(--muted)]">{status}</p>}
          {error && (
            <div className="mt-4 rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
              {error}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
