"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type ReciprocalClub = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  contact_person: string | null;
  advance_days: number | null;
  member_fee_summary: string | null;
  guest_fee_summary: string | null;
  payment_methods: string | null;
  notes: string | null;
  courses: string[] | null;
  closures: unknown;
};

type GroupMember = {
  group?: number;
  players?: string[];
};

type ReciprocalRequest = {
  id: number;
  member_id: number | null;
  member_name: string;
  member_number: string | null;
  member_email: string | null;
  member_phone: string | null;
  reciprocal_club_id: number | null;
  course_choice_text: string | null;
  course_alternates: string[] | null;
  preferred_date: string | null;
  preferred_time: string | null;
  time_range: string | null;
  number_of_players: number | null;
  group_members: GroupMember[] | null;
  status: string;
  call_due_at: string | null;
  call_notes: string | null;
  confirmation_number: string | null;
  confirmed_tee_time: string | null;
  decline_reason: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  course_pick: string | null;
  staff_initials: string | null;
  reciprocal_club:
    | ReciprocalClub
    | ReciprocalClub[]
    | null;
};

type Filter =
  | "all"
  | "today"
  | "unmatched"
  | "booked"
  | "declined";

function easternToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${value.year}-${value.month}-${value.day}`;
}

function formatDate(value: string | null) {
  if (!value) return "Date not set";

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function clubFor(request: ReciprocalRequest) {
  const relation = request.reciprocal_club;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function requestClubName(request: ReciprocalRequest) {
  return clubFor(request)?.name || request.course_choice_text || "Club not matched";
}

function dueCategory(request: ReciprocalRequest, today: string) {
  if (request.status !== "PENDING_CALL") return "other";
  if (!request.call_due_at) return "upcoming";

  const dueDate = request.call_due_at.slice(0, 10);
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

function statusPill(request: ReciprocalRequest, today: string) {
  const category = dueCategory(request, today);

  if (category === "overdue") {
    return {
      label: "OVERDUE",
      classes: "bg-red-500/10 text-red-500 border-red-500/30",
    };
  }

  if (category === "today") {
    return {
      label: "CALL TODAY",
      classes: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    };
  }

  if (request.status === "PENDING_CALL") {
    return {
      label: "UPCOMING",
      classes: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    };
  }

  if (request.status === "BOOKED") {
    return {
      label: "BOOKED",
      classes: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    };
  }

  if (request.status === "DECLINED") {
    return {
      label: "DECLINED",
      classes: "bg-red-500/10 text-red-500 border-red-500/30",
    };
  }

  return {
    label: request.status,
    classes:
      "bg-[var(--golfops-surface-soft)] text-[var(--golfops-text-muted)] border-[var(--golfops-border)]",
  };
}

function StaffActions({
  request,
}: {
  request: ReciprocalRequest;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"BOOKED" | "DECLINED" | "CANCELLED" | null>(null);
  const [confirmedTeeTime, setConfirmedTeeTime] = useState(request.confirmed_tee_time ?? "");
  const [confirmationNumber, setConfirmationNumber] = useState(request.confirmation_number ?? "");
  const [staffInitials, setStaffInitials] = useState(request.staff_initials ?? "");
  const [notes, setNotes] = useState(request.call_notes ?? "");
  const [declineReason, setDeclineReason] = useState(request.decline_reason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(status: "BOOKED" | "DECLINED" | "CANCELLED") {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/reciprocals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: request.id,
          status,
          confirmed_tee_time: confirmedTeeTime.trim() || null,
          confirmation_number: confirmationNumber.trim() || null,
          staff_initials: staffInitials.trim() || null,
          call_notes: notes.trim() || null,
          decline_reason: declineReason.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Unable to update reciprocal request.");
      }

      router.refresh();
      setMode(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update reciprocal request."
      );
    } finally {
      setSaving(false);
    }
  }

  if (request.status !== "PENDING_CALL") {
    return (
      <div className="md:col-span-2 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--golfops-text-dim)]">
          Staff Result
        </div>

        <div className="mt-2 grid gap-2 text-xs text-[var(--golfops-text-muted)] md:grid-cols-2">
          <div>
            Status: <strong className="text-[var(--golfops-text)]">{request.status}</strong>
          </div>

          {request.confirmed_tee_time && (
            <div>
              Confirmed tee time:{" "}
              <strong className="text-[var(--golfops-text)]">
                {request.confirmed_tee_time}
              </strong>
            </div>
          )}

          {request.confirmation_number && (
            <div>
              Confirmation #:{" "}
              <strong className="text-[var(--golfops-text)]">
                {request.confirmation_number}
              </strong>
            </div>
          )}

          {request.staff_initials && (
            <div>
              Staff:{" "}
              <strong className="text-[var(--golfops-text)]">
                {request.staff_initials}
              </strong>
            </div>
          )}

          {request.call_notes && (
            <div className="md:col-span-2">Notes: {request.call_notes}</div>
          )}

          {request.decline_reason && (
            <div className="md:col-span-2">Reason: {request.decline_reason}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="md:col-span-2 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("BOOKED")}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
        >
          Mark Booked
        </button>

        <button
          type="button"
          onClick={() => setMode("DECLINED")}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"
        >
          Mark Declined
        </button>

        <button
          type="button"
          onClick={() => setMode("CANCELLED")}
          className="rounded-lg border border-[var(--golfops-border)] px-3 py-2 text-xs font-semibold"
        >
          Cancel Request
        </button>
      </div>

      {mode && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {mode === "BOOKED" && (
            <>
              <input
                value={confirmedTeeTime}
                onChange={(e) => setConfirmedTeeTime(e.target.value)}
                placeholder="Confirmed tee time"
                className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2 text-sm"
              />

              <input
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                placeholder="Confirmation number"
                className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2 text-sm"
              />
            </>
          )}

          {mode === "DECLINED" && (
            <input
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Decline reason"
              className="md:col-span-2 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2 text-sm"
            />
          )}

          <input
            value={staffInitials}
            onChange={(e) => setStaffInitials(e.target.value)}
            placeholder="Staff initials"
            className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2 text-sm"
          />

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2 text-sm"
          />

          {error && (
            <div className="md:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode(null)}
              className="rounded-lg border border-[var(--golfops-border)] px-3 py-2 text-xs font-semibold"
            >
              Back
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => save(mode)}
              className="rounded-lg bg-[var(--golfops-accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save ${mode}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReciprocalsManager({
  initialRequests,
}: {
  initialRequests: ReciprocalRequest[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const today = easternToday();

  const counts = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let upcoming = 0;
    let unmatched = 0;
    let booked = 0;
    let declined = 0;

    for (const request of initialRequests) {
      const category = dueCategory(request, today);

      if (category === "overdue") overdue += 1;
      else if (category === "today") dueToday += 1;
      else if (category === "upcoming" && request.status === "PENDING_CALL")
        upcoming += 1;

      if (request.status === "PENDING_CALL" && !request.reciprocal_club_id)
        unmatched += 1;

      if (request.status === "BOOKED") booked += 1;
      if (request.status === "DECLINED" || request.status === "CANCELLED")
        declined += 1;
    }

    return {
      overdue,
      today: dueToday,
      upcoming,
      unmatched,
      booked,
      declined,
    };
  }, [initialRequests, today]);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return initialRequests.filter((request) => request.status === "PENDING_CALL");
    }

    if (filter === "today") {
      return initialRequests.filter((request) => {
        const category = dueCategory(request, today);
        return category === "overdue" || category === "today";
      });
    }

    if (filter === "unmatched") {
      return initialRequests.filter(
        (request) =>
          request.status === "PENDING_CALL" && !request.reciprocal_club_id
      );
    }

    if (filter === "booked") {
      return initialRequests.filter((request) => request.status === "BOOKED");
    }

    return initialRequests.filter(
      (request) =>
        request.status === "DECLINED" || request.status === "CANCELLED"
    );
  }, [filter, initialRequests, today]);

  const sections = useMemo(() => {
    if (filter !== "all" && filter !== "today") {
      return [
        {
          key: filter,
          label:
            filter === "unmatched"
              ? "NEEDS CLUB MATCH"
              : filter === "booked"
              ? "BOOKED"
              : "DECLINED / CANCELLED",
          rows: filtered,
          accent:
            filter === "unmatched"
              ? "text-amber-500"
              : filter === "booked"
              ? "text-emerald-500"
              : "text-red-500",
        },
      ];
    }

    const overdue = filtered.filter(
      (request) => dueCategory(request, today) === "overdue"
    );

    const dueToday = filtered.filter(
      (request) => dueCategory(request, today) === "today"
    );

    const upcoming = filtered.filter(
      (request) => dueCategory(request, today) === "upcoming"
    );

    return [
      {
        key: "overdue",
        label: "OVERDUE — CALL NOW",
        rows: overdue,
        accent: "text-red-500",
      },
      {
        key: "today",
        label: "CALL TODAY",
        rows: dueToday,
        accent: "text-amber-500",
      },
      {
        key: "upcoming",
        label: "UPCOMING",
        rows: upcoming,
        accent: "text-emerald-500",
      },
    ].filter((section) => section.rows.length > 0);
  }, [filter, filtered, today]);

  const pendingTotal = counts.overdue + counts.today + counts.upcoming;

  const tabs: { value: Filter; label: string }[] = [
    { value: "all", label: `All (${pendingTotal})` },
    { value: "today", label: `Today (${counts.overdue + counts.today})` },
    { value: "unmatched", label: `Unmatched (${counts.unmatched})` },
    { value: "booked", label: `Booked (${counts.booked})` },
    { value: "declined", label: `Declined (${counts.declined})` },
  ];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reciprocals</h1>
          <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
            Pending calls and recent activity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/settings/reciprocal-clubs"
            className="text-sm font-medium text-[var(--golfops-text-muted)] hover:text-[var(--golfops-text)]"
          >
            Manage clubs
          </Link>

          <Link
            href="/reciprocals/book"
            className="rounded-lg bg-[var(--golfops-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            + Book Reciprocal
          </Link>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface-muted)] p-1">
        {tabs.map((tab) => {
          const selected = filter === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                selected
                  ? "bg-[var(--golfops-accent)] text-white shadow-sm"
                  : "text-[var(--golfops-text-muted)] hover:bg-[var(--golfops-surface-soft)] hover:text-[var(--golfops-text)]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {sections.length === 0 || filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] px-6 py-14 text-center">
          <h2 className="font-semibold">
            {filter === "today"
              ? "Nothing due today"
              : filter === "unmatched"
              ? "No unmatched requests"
              : filter === "booked"
              ? "No booked reciprocals"
              : filter === "declined"
              ? "Nothing declined"
              : "No reciprocal requests"}
          </h2>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <section
              key={section.key}
              className="overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)]"
            >
              <header className="flex items-center gap-2 border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-muted)] px-4 py-2.5">
                <span
                  className={[
                    "text-xs font-bold uppercase tracking-wider",
                    section.accent,
                  ].join(" ")}
                >
                  {section.label}
                </span>

                <span className="ml-auto text-xs text-[var(--golfops-text-dim)]">
                  {section.rows.length}
                </span>
              </header>

              <div className="divide-y divide-[var(--golfops-border)]">
                {section.rows.map((request) => {
                  const club = clubFor(request);
                  const pill = statusPill(request, today);
                  const players = (request.group_members ?? []).flatMap(
                    (group) => group.players ?? []
                  );

                  return (
                    <details key={request.id} className="group">
                      <summary className="cursor-pointer list-none px-4 py-4 transition hover:bg-[var(--golfops-surface-soft)]">
                        <div className="flex items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{request.member_name}</span>
                              <span className="text-[var(--golfops-text-dim)]">→</span>
                              <span className="font-semibold text-[var(--golfops-accent-text)]">
                                {requestClubName(request)}
                              </span>
                              <span
                                className={[
                                  "rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide",
                                  pill.classes,
                                ].join(" ")}
                              >
                                {pill.label}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--golfops-text-muted)]">
                              <span>
                                Play:{" "}
                                <strong className="font-medium text-[var(--golfops-text-secondary)]">
                                  {formatDate(request.preferred_date)}
                                </strong>
                              </span>

                              {(request.preferred_time || request.time_range) && (
                                <span>
                                  Time:{" "}
                                  <strong className="font-medium text-[var(--golfops-text-secondary)]">
                                    {request.time_range || request.preferred_time}
                                  </strong>
                                </span>
                              )}

                              <span>
                                {request.number_of_players ?? players.length} player
                                {(request.number_of_players ?? players.length) === 1
                                  ? ""
                                  : "s"}
                              </span>

                              {request.status === "PENDING_CALL" &&
                                request.call_due_at && (
                                  <span>
                                    Call due:{" "}
                                    <strong className="font-medium">
                                      {formatDate(request.call_due_at)}
                                    </strong>
                                  </span>
                                )}
                            </div>
                          </div>

                          <span className="mt-1 text-lg text-[var(--golfops-text-dim)] transition group-open:rotate-180">
                            ⌄
                          </span>
                        </div>
                      </summary>

                      <div className="grid gap-5 border-t border-[var(--golfops-border)] bg-[var(--golfops-surface-muted)] px-5 py-4 text-sm md:grid-cols-2">
                        <div>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                            Request
                          </div>

                          <div className="space-y-1.5 text-[var(--golfops-text-muted)]">
                            {request.member_number && (
                              <div>
                                Member #:{" "}
                                <span className="text-[var(--golfops-text)]">
                                  {request.member_number}
                                </span>
                              </div>
                            )}

                            {request.course_pick && (
                              <div>
                                Course:{" "}
                                <span className="text-[var(--golfops-text)]">
                                  {request.course_pick}
                                </span>
                              </div>
                            )}

                            {request.course_alternates &&
                              request.course_alternates.length > 0 && (
                                <div>
                                  Alternates:{" "}
                                  <span className="text-[var(--golfops-text)]">
                                    {request.course_alternates.join(", ")}
                                  </span>
                                </div>
                              )}

                            <div>
                              Source:{" "}
                              <span className="text-[var(--golfops-text)]">
                                {request.source || "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                            Players
                          </div>

                          {players.length > 0 ? (
                            <div className="space-y-1 text-[var(--golfops-text)]">
                              {players.map((player, index) => (
                                <div key={`${request.id}-${index}`}>{player}</div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[var(--golfops-text-muted)]">
                              No player list supplied.
                            </div>
                          )}
                        </div>

                        {club && (
                          <div className="md:col-span-2 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4">
                            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                              {club.name}
                            </div>

                            <div className="grid gap-2 text-xs text-[var(--golfops-text-muted)] md:grid-cols-2">
                              {club.member_fee_summary && (
                                <div>
                                  Member:{" "}
                                  <span className="text-[var(--golfops-text)]">
                                    {club.member_fee_summary}
                                  </span>
                                </div>
                              )}

                              {club.guest_fee_summary && (
                                <div>
                                  Guest:{" "}
                                  <span className="text-[var(--golfops-text)]">
                                    {club.guest_fee_summary}
                                  </span>
                                </div>
                              )}

                              {club.payment_methods && (
                                <div>
                                  Payment:{" "}
                                  <span className="text-[var(--golfops-text)]">
                                    {club.payment_methods}
                                  </span>
                                </div>
                              )}

                              {club.advance_days != null && (
                                <div>
                                  Book:{" "}
                                  <span className="text-[var(--golfops-text)]">
                                    {club.advance_days} day
                                    {club.advance_days === 1 ? "" : "s"} in advance
                                  </span>
                                </div>
                              )}

                              {club.notes && (
                                <div className="md:col-span-2 mt-1">{club.notes}</div>
                              )}
                            </div>
                          </div>
                        )}

                        <StaffActions request={request} />
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
