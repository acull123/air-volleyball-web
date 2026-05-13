"use client";

import { useMemo, useState, type FormEvent } from "react";
import PageHero from "@/app/components/PageHero";
import SectionCard from "@/app/components/SectionCard";
import { firestoreApi, useFirestoreCollection } from "@/lib/firebase";
import { useAuthSession } from "@/lib/firebase/auth";
import type { ClubEventType, CoachDocument, PayTypeDocument } from "@/lib/firebase/schema";

type PayTypeDraft = {
  eventType: ClubEventType;
  description: string;
  value: string;
  defaulted: boolean;
};

const emptyPayTypeDraft: PayTypeDraft = {
  eventType: "tournament",
  description: "",
  value: "",
  defaulted: false,
};

const eventTypeOptions: { value: ClubEventType; label: string }[] = [
  { value: "tournament", label: "Tournament" },
  { value: "twoDayTournament", label: "2 Day Tournament" },
  { value: "practice", label: "Practice" },
  { value: "camp", label: "Camp" },
  { value: "tryout", label: "Tryout" },
  { value: "areaCamp", label: "Area Camp" },
  { value: "refScoringClinic", label: "Ref And Scoring Clinic" },
];

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

function formatEventType(type: ClubEventType) {
  return eventTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function getCoachPayTypeIds(coach: CoachDocument) {
  return Array.isArray(coach.payTypeIds) ? coach.payTypeIds : [];
}

export default function PaySetupManagerClient() {
  const access = useAuthSession();
  const payTypes = useFirestoreCollection("payTypes");
  const coaches = useFirestoreCollection("coaches");
  const [selectedPayTypeId, setSelectedPayTypeId] = useState<string | null>(null);
  const [payTypeDraft, setPayTypeDraft] = useState<PayTypeDraft>(emptyPayTypeDraft);
  const [savingPayType, setSavingPayType] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = access.authUser?.profile?.role === "admin";

  const sortedPayTypes = useMemo(
    () =>
      [...payTypes.data].sort((left, right) =>
        `${left.eventType ?? ""} ${left.description}`.localeCompare(
          `${right.eventType ?? ""} ${right.description}`,
        ),
      ),
    [payTypes.data],
  );
  const sortedCoaches = useMemo(
    () =>
      [...coaches.data].sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`),
      ),
    [coaches.data],
  );

  function beginEditPayType(payType: PayTypeDocument) {
    setSelectedPayTypeId(payType.id);
    setPayTypeDraft({
      eventType: payType.eventType ?? "tournament",
      description: payType.description,
      value: String(payType.value ?? 0),
      defaulted: payType.defaulted,
    });
    setStatus(null);
    setError(null);
  }

  function resetPayTypeForm() {
    setSelectedPayTypeId(null);
    setPayTypeDraft(emptyPayTypeDraft);
  }

  async function handlePayTypeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAdmin) {
      setError("Only admins can manage pay types.");
      return;
    }

    const value = payTypeDraft.value.trim() ? Number(payTypeDraft.value) : 0;
    const payload = {
      eventType: payTypeDraft.eventType,
      description: payTypeDraft.description.trim(),
      value,
      defaulted: payTypeDraft.defaulted,
    };

    if (!payload.eventType || !payload.description) {
      setError("Event type and description are required.");
      return;
    }

    if (Number.isNaN(payload.value) || payload.value < 0) {
      setError("Value must be a valid amount.");
      return;
    }

    setSavingPayType(true);
    setStatus(null);
    setError(null);

    try {
      if (selectedPayTypeId) {
        await firestoreApi.payTypes.update(selectedPayTypeId, payload);
        setStatus("Pay type updated.");
      } else {
        await firestoreApi.payTypes.create(payload);
        setStatus("Pay type created.");
      }

      resetPayTypeForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save pay type.");
    } finally {
      setSavingPayType(false);
    }
  }

  async function deletePayType(payTypeId: string, description: string) {
    if (!isAdmin) {
      setError("Only admins can delete pay types.");
      return;
    }

    const confirmed = window.confirm(`Delete the ${description} pay type?`);

    if (!confirmed) {
      return;
    }

    setStatus(null);
    setError(null);

    try {
      await firestoreApi.payTypes.remove(payTypeId);
      if (selectedPayTypeId === payTypeId) {
        resetPayTypeForm();
      }
      setStatus("Pay type deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete pay type.");
    }
  }

  async function toggleCoachPayType(coach: CoachDocument, payTypeId: string, checked: boolean) {
    if (!isAdmin) {
      setError("Only admins can assign coach pay types.");
      return;
    }

    const currentPayTypeIds = getCoachPayTypeIds(coach);
    const nextPayTypeIds = checked
      ? [...new Set([...currentPayTypeIds, payTypeId])]
      : currentPayTypeIds.filter((entry) => entry !== payTypeId);

    setStatus(null);
    setError(null);

    try {
      await firestoreApi.coaches.update(coach.id, {
        payTypeIds: nextPayTypeIds,
      });
      setStatus("Coach pay types updated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update coach pay types.");
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Finances"
        title="Pay Setup"
        description="Manage coach pay types, default coach assignments, and event type matching for payroll planning."
        actions={[{ href: "/admin/dashboard", label: "Admin Dashboard" }]}
      />

      {access.loading ? (
        <SectionCard title="Loading" kicker="Pay Setup">
          <p className="text-sm leading-7 text-[color:var(--muted)]">Checking your admin access...</p>
        </SectionCard>
      ) : !isAdmin ? (
        <SectionCard title="Admin Required" kicker="Pay Setup">
          <p className="text-sm leading-7 text-[color:var(--muted)]">
            Pay setup is only available to admin accounts.
          </p>
        </SectionCard>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionCard title={selectedPayTypeId ? "Edit Pay Type" : "Add Pay Type"} kicker="Coach Pay">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handlePayTypeSubmit}>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <span>
                  Event type <span className="text-[#b42318]">*</span>
                </span>
                <select
                  value={payTypeDraft.eventType}
                  onChange={(event) =>
                    setPayTypeDraft((current) => ({
                      ...current,
                      eventType: event.target.value as ClubEventType,
                    }))
                  }
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                >
                  {eventTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <span>
                  Value <span className="text-[#b42318]">*</span>
                </span>
                <input
                  value={payTypeDraft.value}
                  onChange={(event) => setPayTypeDraft((current) => ({ ...current, value: event.target.value }))}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  inputMode="decimal"
                  placeholder="30.00"
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <span>
                  Description <span className="text-[#b42318]">*</span>
                </span>
                <input
                  value={payTypeDraft.description}
                  onChange={(event) =>
                    setPayTypeDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="Example: 2 day tournament meal stipend"
                />
              </label>
              <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-[color:var(--paper)] px-4 py-4 text-sm text-[color:var(--muted)]">
                <input
                  type="checkbox"
                  checked={payTypeDraft.defaulted}
                  onChange={(event) =>
                    setPayTypeDraft((current) => ({ ...current, defaulted: event.target.checked }))
                  }
                />
                Assign to new coaches by default
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={savingPayType}
                  className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPayType ? "Saving..." : selectedPayTypeId ? "Save Pay Type" : "Add Pay Type"}
                </button>
                {selectedPayTypeId && (
                  <button
                    type="button"
                    onClick={resetPayTypeForm}
                    className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Current Pay Types" kicker="Coach Assignments">
            <div className="space-y-3">
              {payTypes.loading ? (
                <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                  Loading pay types...
                </div>
              ) : sortedPayTypes.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                  No pay types have been added yet.
                </div>
              ) : (
                sortedPayTypes.map((payType) => (
                  <div
                    key={payType.id}
                    className="rounded-[1.25rem] border border-[color:var(--line)] bg-white px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-semibold text-[color:var(--ink)]">{payType.description}</p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {formatEventType(payType.eventType ?? "tournament")} · {formatMoney(payType.value)}
                          {payType.defaulted ? " · default" : ""}
                        </p>
                        <div className="mt-4 grid gap-2">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                            Coach assignments
                          </p>
                          {coaches.loading ? (
                            <p className="text-sm text-[color:var(--muted)]">Loading coaches...</p>
                          ) : sortedCoaches.length === 0 ? (
                            <p className="text-sm text-[color:var(--muted)]">No coaches have been added yet.</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {sortedCoaches.map((coach) => (
                                <label
                                  key={coach.id}
                                  className="flex items-center gap-2 text-sm font-medium text-[color:var(--ink)]"
                                >
                                  <input
                                    type="checkbox"
                                    checked={getCoachPayTypeIds(coach).includes(payType.id)}
                                    onChange={(event) =>
                                      void toggleCoachPayType(coach, payType.id, event.target.checked)
                                    }
                                  />
                                  <span>
                                    {coach.firstName} {coach.lastName}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => beginEditPayType(payType)}
                          className="rounded-full border border-[color:var(--line)] px-3 py-2 text-xs font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePayType(payType.id, payType.description)}
                          className="rounded-full border border-[#e7b8b8] px-3 py-2 text-xs font-semibold text-[#8a2d2d] transition hover:bg-[#fff2f2]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {status && <p className="mt-4 text-sm text-[color:var(--muted)]">{status}</p>}
      {error && (
        <div className="mt-4 rounded-2xl border border-[#e7b8b8] bg-[#fff2f2] px-4 py-4 text-sm text-[#8a2d2d]">
          {error}
        </div>
      )}
    </>
  );
}
