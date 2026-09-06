import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import TvClock from "../../components/TvClock";
import TvChangesAutoScroll from "../../components/TvChangesAutoScroll";
import TvDisplayRefresh from "@/components/TvDisplayRefresh";

type SearchParams = Promise<{
  date?: string;
}>;

type ChangeRow = {
  id: number | string;
  change_type: string | null;
  player_name: string | null;
  bag_number: string | null;
  tee_time: string | null;
  starting_hole: number | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  detail: string | null;
};

type ProShopRequestRow = {
  id: number | string;
  request_type:
    | "PRACTICE"
    | "TAKEAWAY"
    | "LESSON";
  member_name_snapshot: string;
  bag_number_snapshot: string | null;
  details: string | null;
  created_at: string;
};

type ForeTeesLessonRow = {
  id: number | string;
  lesson_time: string;
  instructor_name: string;
  member_name: string;
  lesson_type: string | null;
};

function easternDateString(
  date = new Date()
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

function shiftDate(
  dateString: string,
  days: number
) {
  const [year, month, day] =
    dateString
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function displayDate(
  dateString: string
) {
  const [year, month, day] =
    dateString
      .split("-")
      .map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
    }
  );
}

function displayTime(
  value: string | null
) {
  if (!value) return "";

  const match =
    value.match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!match) {
    return value;
  }

  let hour =
    Number(match[1]);

  const minute =
    match[2];

  const suffix =
    hour >= 12
      ? "PM"
      : "AM";

  hour =
    hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

function changeLabel(
  type: string | null
) {
  switch (type) {
    case "ADDED":
      return "Added";

    case "REMOVED":
      return "Removed";

    case "TIME_CHANGED":
      return "Time";

    case "HOLE_CHANGED":
      return "Hole";

    case "REPLACED":
      return "Replaced";

    default:
      return type ?? "Change";
  }
}

function changeDetail(
  change: ChangeRow
) {
  if (change.detail) {
    return change.detail;
  }

  const oldValue =
    change.old_value ?? {};

  const newValue =
    change.new_value ?? {};

  if (
    change.change_type ===
    "TIME_CHANGED"
  ) {
    const oldTime =
      typeof oldValue
        .tee_time === "string"
        ? displayTime(
            oldValue.tee_time
          )
        : "";

    const newTime =
      typeof newValue
        .tee_time === "string"
        ? displayTime(
            newValue.tee_time
          )
        : displayTime(
            change.tee_time
          );

    if (
      oldTime ||
      newTime
    ) {
      return `${
        oldTime || "—"
      } → ${
        newTime || "—"
      }`;
    }
  }

  if (
    change.change_type ===
    "HOLE_CHANGED"
  ) {
    const oldHole =
      oldValue
        .starting_position ??
      oldValue
        .starting_hole;

    const newHole =
      newValue
        .starting_position ??
      newValue
        .starting_hole ??
      change.starting_hole;

    return `Start ${String(
      oldHole ?? "—"
    )} → ${String(
      newHole ?? "—"
    )}`;
  }

  return [
    change.tee_time
      ? displayTime(
          change.tee_time
        )
      : null,

    change.starting_hole
      ? `Hole ${change.starting_hole}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

function requestLabel(
  type:
    ProShopRequestRow[
      "request_type"
    ]
) {
  switch (type) {
    case "PRACTICE":
      return "Practice";

    case "TAKEAWAY":
      return "Takeaway";

    case "LESSON":
      return "Lesson";
  }
}

function requestBadgeStyle(
  type:
    ProShopRequestRow[
      "request_type"
    ]
) {
  switch (type) {
    case "PRACTICE":
      return {
        background:
          "rgba(37, 99, 235, 0.15)",
        color:
          "#60a5fa",
      };

    case "TAKEAWAY":
      return {
        background:
          "rgba(234, 88, 12, 0.15)",
        color:
          "#fb923c",
      };

    case "LESSON":
      return {
        background:
          "rgba(129, 11, 208, 0.15)",
        color:
          "#c084fc",
      };
  }
}

function requestTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleTimeString(
    "en-US",
    {
      timeZone:
        "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

export default async function TvPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params =
    await searchParams;

  const today =
    easternDateString();

  const selectedDate =
    params.date &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      params.date
    )
      ? params.date
      : today;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase
      .auth
      .getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select("club_id")
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (
    !profile?.club_id
  ) {
    return (
      <main className="p-10">
        Unable to load club
        profile.
      </main>
    );
  }

  const [
    slotsResult,
    changesResult,
    importResult,
    requestsResult,
    lessonsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "tee_sheet_slots"
        )
        .select(
          "id, player_name, check_in"
        )
        .eq(
          "club_id",
          profile.club_id
        )
        .eq(
          "sheet_date",
          selectedDate
        ),

      supabase
        .from(
          "tee_sheet_changes"
        )
        .select(`
          id,
          change_type,
          player_name,
          bag_number,
          tee_time,
          starting_hole,
          old_value,
          new_value,
          detail
        `)
        .eq(
          "club_id",
          profile.club_id
        )
        .eq(
          "sheet_date",
          selectedDate
        )
        .eq(
          "status",
          "OPEN"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        ),

      supabase
        .from(
          "tee_sheet_imports"
        )
        .select(
          "created_at, source"
        )
        .eq(
          "club_id",
          profile.club_id
        )
        .eq(
          "sheet_date",
          selectedDate
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle(),

      supabase
        .from(
          "pro_shop_requests"
        )
        .select(`
          id,
          request_type,
          member_name_snapshot,
          bag_number_snapshot,
          details,
          created_at
        `)
        .eq(
          "club_id",
          profile.club_id
        )
        .eq(
          "status",
          "ACTIVE"
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        ),

      /*
        Lessons follow the selected TV date
        so the displayed schedule matches
        the date shown in the header.
      */

      supabase
        .from(
          "foretees_lessons"
        )
        .select(`
          id,
          lesson_time,
          instructor_name,
          member_name,
          lesson_type
        `)
        .eq(
          "club_id",
          profile.club_id
        )
        .eq(
          "lesson_date",
          selectedDate
        )
        .eq(
          "source",
          "FORETEES"
        )
        .order(
          "lesson_time",
          {
            ascending: true,
          }
        ),
    ]);

  const slots =
    slotsResult.data ?? [];

  if (
    changesResult.error
  ) {
    console.error(
      "TV changes load error:",
      changesResult.error
    );
  }

  const changes =
    (
      changesResult.data ??
      []
    ) as ChangeRow[];

  if (
    requestsResult.error
  ) {
    console.error(
      "TV Pro Shop requests load error:",
      requestsResult.error
    );
  }

  const proShopRequests =
    (
      requestsResult.data ??
      []
    ) as ProShopRequestRow[];

  if (
    lessonsResult.error
  ) {
    console.error(
      "TV lessons load error:",
      lessonsResult.error
    );
  }

  const lessons =
    (
      lessonsResult.data ??
      []
    ) as ForeTeesLessonRow[];

  const playerCount =
    slots.filter(
      (slot) =>
        Boolean(
          slot.player_name
        )
    ).length;

  const checkedInCount =
    slots.filter(
      (slot) =>
        Boolean(
          slot.player_name
        ) &&
        slot.check_in === "X"
    ).length;

  const lastImport =
    importResult.data;

  const previousDate =
    shiftDate(
      selectedDate,
      -1
    );

  const nextDate =
    shiftDate(
      selectedDate,
      1
    );

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <TvDisplayRefresh selectedDate={selectedDate} />

      <AppNav
        active="tv"
        selectedDate={
          selectedDate
        }
      />

      <main className="mx-auto max-w-[1800px] px-6 py-7">
        <section className="mb-6 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] px-7 py-6 shadow-[var(--golfops-shadow)]">
          <div>
            <div className="flex items-center gap-4">
              <Link
                href={`/tv?date=${previousDate}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--golfops-border)] text-xl text-[var(--golfops-text-muted)] transition hover:bg-[var(--golfops-surface-soft)] hover:text-[var(--golfops-text)]"
                aria-label="Previous day"
              >
                ‹
              </Link>

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--golfops-accent-text)]">
                  Golf Operations
                </div>

                <h1 className="mt-1 text-4xl font-bold tracking-tight">
                  {displayDate(
                    selectedDate
                  )}
                </h1>
              </div>

              <Link
                href={`/tv?date=${nextDate}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--golfops-border)] text-xl text-[var(--golfops-text-muted)] transition hover:bg-[var(--golfops-surface-soft)] hover:text-[var(--golfops-text)]"
                aria-label="Next day"
              >
                ›
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-4 py-2">
                <span className="text-2xl font-bold">
                  {playerCount}
                </span>

                <span className="ml-2 text-sm font-semibold text-[var(--golfops-text-muted)]">
                  Players
                </span>
              </div>

              <div className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-4 py-2">
                <span className="text-2xl font-bold text-[var(--golfops-accent-text)]">
                  {checkedInCount}
                </span>

                <span className="ml-2 text-sm font-semibold text-[var(--golfops-text-muted)]">
                  Checked In
                </span>
              </div>

              <div className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-4 py-2">
                <span className="text-2xl font-bold text-[#c084fc]">
                  {lessons.length}
                </span>

                <span className="ml-2 text-sm font-semibold text-[var(--golfops-text-muted)]">
                  Lessons Today
                </span>
              </div>
            </div>
          </div>

          <TvClock />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr_1fr]">

          {/* CHANGES */}

          <section className="overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
            <header className="flex items-center justify-between border-b border-[var(--golfops-border)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-6 py-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--golfops-text-muted)]">
                  Live Operations
                </div>

                <h2 className="mt-1 text-2xl font-bold">
                  Changes
                </h2>
              </div>

              <div className="flex h-10 min-w-10 items-center justify-center rounded-full bg-[var(--golfops-accent)] px-3 text-sm font-bold text-white">
                {changes.length}
              </div>
            </header>

            {changes.length > 0 ? (
              <TvChangesAutoScroll>
                <div className="divide-y divide-[var(--golfops-border)]">
                  {changes.map(
                    (change) => (
                      <div
                        key={
                          change.id
                        }
                        className="min-h-[78px] px-6 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="inline-flex w-fit rounded-md bg-[var(--golfops-accent-soft)] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[var(--golfops-accent-text)]">
                              {changeLabel(
                                change.change_type
                              )}
                            </span>

                            <div className="mt-2 text-lg font-bold">
                              {change.player_name ??
                                "Open Position"}
                            </div>

                            <div className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                              {changeDetail(
                                change
                              )}
                            </div>
                          </div>

                          {change.bag_number && (
                            <div className="golfops-bag-gold shrink-0 text-lg font-bold">
                              #
                              {
                                change.bag_number
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </TvChangesAutoScroll>
            ) : (
              <div className="flex h-[470px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--golfops-surface-soft)] text-2xl text-[var(--golfops-accent-text)]">
                  ✓
                </div>

                <h3 className="mt-4 text-xl font-bold">
                  No open changes
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--golfops-text-muted)]">
                  New tee sheet changes will appear here automatically.
                </p>
              </div>
            )}

            <footer className="border-t border-[var(--golfops-border)] px-6 py-3 text-right">
              <Link
                href={`/changes?date=${selectedDate}`}
                className="text-sm font-bold text-[var(--golfops-accent-text)] hover:text-[var(--golfops-accent)]"
              >
                Open Changes →
              </Link>
            </footer>
          </section>

          {/* PRO SHOP REQUESTS */}

          <section className="overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
            <header className="flex items-center justify-between border-b border-[var(--golfops-border)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-6 py-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--golfops-text-muted)]">
                  Golf Shop
                </div>

                <h2 className="mt-1 text-2xl font-bold">
                  Requests
                </h2>
              </div>

              <div className="flex h-10 min-w-10 items-center justify-center rounded-full bg-[var(--golfops-accent)] px-3 text-sm font-bold text-white">
                {
                  proShopRequests.length
                }
              </div>
            </header>

            {proShopRequests.length >
            0 ? (
              <TvChangesAutoScroll>
                <div className="divide-y divide-[var(--golfops-border)]">
                  {proShopRequests.map(
                    (request) => {
                      const badgeStyle =
                        requestBadgeStyle(
                          request.request_type
                        );

                      return (
                        <div
                          key={
                            request.id
                          }
                          className="min-h-[78px] px-6 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="inline-flex rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
                                  style={
                                    badgeStyle
                                  }
                                >
                                  {requestLabel(
                                    request.request_type
                                  )}
                                </span>

                                <span className="text-xs font-semibold text-[var(--golfops-text-dim)]">
                                  {requestTime(
                                    request.created_at
                                  )}
                                </span>
                              </div>

                              <div className="mt-2 text-lg font-bold">
                                {
                                  request.member_name_snapshot
                                }
                              </div>

                              {request.details && (
                                <div className="mt-1 text-sm leading-5 text-[var(--golfops-text-muted)]">
                                  {
                                    request.details
                                  }
                                </div>
                              )}
                            </div>

                            {request.bag_number_snapshot && (
                              <div className="golfops-bag-gold shrink-0 text-lg font-bold">
                                #
                                {
                                  request.bag_number_snapshot
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </TvChangesAutoScroll>
            ) : (
              <div className="flex h-[470px] flex-col items-center justify-center px-7 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--golfops-surface-soft)] text-2xl">
                  ⛳
                </div>

                <h3 className="mt-4 text-xl font-bold">
                  No active requests
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--golfops-text-muted)]">
                  Practice, takeaway, and lesson requests will appear here automatically.
                </p>
              </div>
            )}

            <footer className="border-t border-[var(--golfops-border)] px-6 py-3 text-right">
              <Link
                href="/proshop"
                className="text-sm font-bold text-[var(--golfops-accent-text)] hover:text-[var(--golfops-accent)]"
              >
                Open Pro Shop →
              </Link>
            </footer>
          </section>

          {/* TODAY'S LESSONS */}

          <section className="overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
            <header className="flex items-center justify-between border-b border-[var(--golfops-border)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-6 py-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#c084fc]">
                  Player Development
                </div>

                <h2 className="mt-1 text-2xl font-bold">
                  Today&apos;s Lessons
                </h2>
              </div>

              <div
                className="flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-bold text-white"
                style={{
                  background:
                    "#810bd0",
                }}
              >
                {lessons.length}
              </div>
            </header>

            {lessons.length > 0 ? (
              <TvChangesAutoScroll>
                <div className="divide-y divide-[var(--golfops-border)]">
                  {lessons.map(
                    (lesson) => (
                      <div
                        key={
                          lesson.id
                        }
                        className="min-h-[78px] px-6 py-4"
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className="shrink-0 rounded-md px-2.5 py-1 text-sm font-bold"
                            style={{
                              background:
                                "rgba(129, 11, 208, 0.15)",
                              color:
                                "#c084fc",
                            }}
                          >
                            {displayTime(
                              lesson.lesson_time
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-lg font-bold">
                              {
                                lesson.member_name
                              }
                            </div>

                            <div className="mt-1 text-sm font-semibold text-[var(--golfops-text-muted)]">
                              {
                                lesson.instructor_name
                              }
                            </div>

                            {lesson.lesson_type && (
                              <div className="mt-1 text-xs leading-5 text-[var(--golfops-text-dim)]">
                                {
                                  lesson.lesson_type
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </TvChangesAutoScroll>
            ) : (
              <div className="flex h-[470px] flex-col items-center justify-center px-7 text-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                  style={{
                    background:
                      "rgba(129, 11, 208, 0.12)",
                    color:
                      "#c084fc",
                  }}
                >
                  ⛳
                </div>

                <h3 className="mt-4 text-xl font-bold">
                  No lessons today
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--golfops-text-muted)]">
                  Booked ForeTees lessons will appear here after the tee sheet sync.
                </p>
              </div>
            )}

            <footer className="border-t border-[var(--golfops-border)] px-6 py-3 text-right text-sm font-semibold text-[var(--golfops-text-dim)]">
              ForeTees Lesson Book
            </footer>
          </section>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--golfops-text-dim)]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span>
              Connected
            </span>
          </div>

          <div>
            {lastImport?.created_at
              ? `Last tee sheet update ${new Date(
                  lastImport.created_at
                ).toLocaleTimeString(
                  "en-US",
                  {
                    timeZone:
                      "America/New_York",
                    hour:
                      "numeric",
                    minute:
                      "2-digit",
                  }
                )}${
                  lastImport.source
                    ? ` • ${lastImport.source}`
                    : ""
                }`
              : "No tee sheet import recorded for this date"}
          </div>
        </div>
      </main>
    </div>
  );
}
