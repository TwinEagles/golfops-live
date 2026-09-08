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

type TvTeeSheetSlot = {
  id: number | string;
  tee_time: string;
  course: string;
  starting_hole: number;
  starting_position: string | null;
  slot_position: number;
  player_name: string | null;
  cart_number: string | null;
  check_in: string | null;
};

type PaceCartStatus = {
  cart_number: string;
  course_name: string | null;
  hole_name: string | null;
  hole_short_name: string | null;
  hole_sequence: number | null;
  current_pace: unknown;
  pace_minutes: number | null;
  estimated_finish_at: string | null;
  is_in_play: boolean | null;
  last_seen_at: string | null;
};

type NextFinishGroup = {
  course: "Eagle" | "Talon";
  teeTime: string;
  players: string[];
  carts: string[];
  hole: string;
  paceMinutes: number | null;
  estimatedFinishMinutes: number;
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

function normalizeCartNumber(
  value: string | number | null
) {
  if (value == null) return null;

  const match =
    String(value).match(/\d+/);

  return match
    ? String(Number(match[0]))
    : null;
}

function teeTimeMinutes(
  value: string
) {
  const match =
    value.match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!match) return null;

  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );
}

function timestampMinutes(
  value: string | null
) {
  if (!value) return null;

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    ).formatToParts(date);

  const hour = Number(
    parts.find(
      (part) =>
        part.type === "hour"
    )?.value ?? 0
  );

  const minute = Number(
    parts.find(
      (part) =>
        part.type === "minute"
    )?.value ?? 0
  );

  return hour * 60 + minute;
}

function parsePaceMinutes(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return null;

    const numeric =
      trimmed.match(
        /^([+-]?\d+(?:\.\d+)?)\s*(?:min(?:ute)?s?)?$/i
      );

    if (numeric) {
      return Math.round(
        Number(numeric[1])
      );
    }

    const clock =
      trimmed.match(
        /^([+-])?(\d+):(\d{2})(?::(\d{2}))?$/
      );

    if (clock) {
      const sign =
        clock[1] === "-"
          ? -1
          : 1;

      const first =
        Number(clock[2]);

      const second =
        Number(clock[3]);

      const third =
        clock[4] == null
          ? null
          : Number(clock[4]);

      const minutes =
        third == null
          ? first + second / 60
          : first * 60 +
            second +
            third / 60;

      return Math.round(
        sign * minutes
      );
    }
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record =
      value as Record<
        string,
        unknown
      >;

    for (const key of [
      "paceMinutes",
      "PaceMinutes",
      "minutes",
      "Minutes",
      "behindMinutes",
      "BehindMinutes",
      "value",
      "Value",
    ]) {
      const parsed =
        parsePaceMinutes(
          record[key]
        );

      if (parsed != null) {
        return parsed;
      }
    }
  }

  return null;
}

function isFreshPaceStatus(
  value: string | null
) {
  if (!value) return false;

  const timestamp =
    new Date(value).getTime();

  return (
    Number.isFinite(timestamp) &&
    Date.now() - timestamp <=
      3 * 60 * 1000
  );
}

function courseBucket(
  value: string
): "Eagle" | "Talon" | null {
  const normalized =
    value.toLowerCase();

  if (
    normalized.includes("eagle")
  ) {
    return "Eagle";
  }

  if (
    normalized.includes("talon")
  ) {
    return "Talon";
  }

  return null;
}

function formatFinishTime(
  totalMinutes: number
) {
  const normalized =
    ((Math.round(totalMinutes) %
      1440) +
      1440) %
    1440;

  const hour24 =
    Math.floor(
      normalized / 60
    );

  const minute =
    normalized % 60;

  const suffix =
    hour24 >= 12
      ? "PM"
      : "AM";

  const hour =
    hour24 % 12 || 12;

  return `${hour}:${String(
    minute
  ).padStart(2, "0")} ${suffix}`;
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
    paceResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "tee_sheet_slots"
        )
        .select(
          "id, tee_time, course, starting_hole, starting_position, slot_position, player_name, cart_number, check_in"
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

      supabase
        .from(
          "pace_cart_status"
        )
        .select(`
          cart_number,
          course_name,
          hole_name,
          hole_short_name,
          hole_sequence,
          current_pace,
          pace_minutes,
          estimated_finish_at,
          is_in_play,
          last_seen_at
        `)
        .eq(
          "club_id",
          profile.club_id
        ),
    ]);

  const slots =
    (
      slotsResult.data ?? []
    ) as TvTeeSheetSlot[];

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

  if (paceResult.error) {
    console.error(
      "TV PACE load error:",
      paceResult.error
    );
  }

  const paceStatuses =
    (
      paceResult.data ?? []
    ) as PaceCartStatus[];

  const paceByCart =
    new Map<
      string,
      PaceCartStatus
    >();

  for (
    const status of paceStatuses
  ) {
    const cartNumber =
      normalizeCartNumber(
        status.cart_number
      );

    if (cartNumber) {
      paceByCart.set(
        cartNumber,
        status
      );
    }
  }

  const groupedSlots =
    new Map<
      string,
      TvTeeSheetSlot[]
    >();

  for (const slot of slots) {
    const key = [
      slot.tee_time,
      slot.course,
      slot.starting_position ??
        slot.starting_hole,
    ].join("|");

    const group =
      groupedSlots.get(key) ?? [];

    group.push(slot);
    groupedSlots.set(key, group);
  }

  const finishCandidates:
    NextFinishGroup[] = [];

  if (selectedDate === today) {
    for (
      const group of
        groupedSlots.values()
    ) {
      const first = group[0];
      const course =
        courseBucket(
          first.course
        );

      if (!course) continue;

      const carts = Array.from(
        new Set(
          group
            .map((slot) =>
              normalizeCartNumber(
                slot.cart_number
              )
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        )
      );

      const activeStatuses =
        carts
          .map((cart) =>
            paceByCart.get(cart)
          )
          .filter(
            (
              status
            ): status is PaceCartStatus =>
              Boolean(
                status?.is_in_play &&
                  isFreshPaceStatus(
                    status.last_seen_at
                  )
              )
          );

      if (
        activeStatuses.length === 0
      ) {
        continue;
      }

      const paceValues =
        activeStatuses
          .map((status) =>
            status.pace_minutes ??
            parsePaceMinutes(
              status.current_pace
            )
          )
          .filter(
            (
              value
            ): value is number =>
              value != null &&
              Number.isFinite(value)
          );

      const groupPace =
        paceValues.length > 0
          ? Math.max(
              ...paceValues
            )
          : null;

      const statusFinishTimes =
        activeStatuses
          .map((status) =>
            timestampMinutes(
              status.estimated_finish_at
            )
          )
          .filter(
            (
              value
            ): value is number =>
              value != null
          );

      const scheduledStart =
        teeTimeMinutes(
          first.tee_time
        );

      if (
        scheduledStart == null
      ) {
        continue;
      }

      const targetMinutes =
        course === "Eagle"
          ? 245
          : 240;

      const estimatedFinish =
        statusFinishTimes.length > 0
          ? Math.max(
              ...statusFinishTimes
            )
          : scheduledStart +
            targetMinutes +
            (groupPace ?? 0);

      const slowestStatus =
        [...activeStatuses].sort(
          (a, b) =>
            (a.hole_sequence ?? 99) -
            (b.hole_sequence ?? 99)
        )[0];

      const hole =
        slowestStatus
          .hole_short_name ||
        slowestStatus.hole_name ||
        (slowestStatus
          .hole_sequence
          ? `Hole ${slowestStatus.hole_sequence}`
          : "On course");

      finishCandidates.push({
        course,
        teeTime:
          first.tee_time,
        players: group
          .sort(
            (a, b) =>
              a.slot_position -
              b.slot_position
          )
          .map(
            (slot) =>
              slot.player_name
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          ),
        carts,
        hole,
        paceMinutes:
          groupPace,
        estimatedFinishMinutes:
          estimatedFinish,
      });
    }
  }

  function nextFinishFor(
    course: "Eagle" | "Talon"
  ) {
    return (
      finishCandidates
        .filter(
          (group) =>
            group.course === course
        )
        .sort(
          (a, b) =>
            a.estimatedFinishMinutes -
            b.estimatedFinishMinutes
        )[0] ?? null
    );
  }

  const nextEagleFinish =
    nextFinishFor("Eagle");

  const nextTalonFinish =
    nextFinishFor("Talon");

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

      <main className="mx-auto max-w-[1800px] px-6 py-5">
        <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] px-6 py-4 shadow-[var(--golfops-shadow)]">
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

                <h1 className="mt-1 text-3xl font-bold tracking-tight">
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

            <div className="mt-3 flex flex-wrap items-center gap-3">
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

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_1fr]">

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
              <div className="flex h-[360px] flex-col items-center justify-center px-6 text-center">
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
              <div className="flex h-[360px] flex-col items-center justify-center px-7 text-center">
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
              <div className="flex h-[360px] flex-col items-center justify-center px-7 text-center">
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

        <section className="mt-4 overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
          <header className="flex items-center justify-between border-b border-[var(--golfops-border)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-6 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--golfops-accent-text)]">
                Live Pace
              </div>

              <h2 className="mt-0.5 text-xl font-bold">
                Next Groups to Finish
              </h2>
            </div>

            <div className="text-xs font-semibold text-[var(--golfops-text-dim)]">
              Estimated from current cart pace
            </div>
          </header>

          <div className="grid divide-y divide-[var(--golfops-border)] md:grid-cols-2 md:divide-x md:divide-y-0">
            <NextFinishCard
              course="Eagle"
              group={nextEagleFinish}
            />

            <NextFinishCard
              course="Talon"
              group={nextTalonFinish}
            />
          </div>
        </section>

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

function NextFinishCard({
  course,
  group,
}: {
  course: "Eagle" | "Talon";
  group: NextFinishGroup | null;
}) {
  if (!group) {
    return (
      <div className="flex min-h-[112px] items-center gap-5 px-6 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--golfops-surface-soft)] text-xl font-black text-[var(--golfops-accent-text)]">
          {course.slice(0, 1)}
        </div>

        <div>
          <div className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--golfops-text-muted)]">
            {course}
          </div>

          <div className="mt-1 text-lg font-bold">
            No active group on course
          </div>
        </div>
      </div>
    );
  }

  const pace =
    group.paceMinutes;

  const paceDot =
    pace == null
      ? "bg-slate-400"
      : pace <= 0
        ? "bg-green-500"
        : pace <= 9
          ? "bg-amber-400"
          : "bg-red-500";

  const paceLabel =
    pace == null
      ? "Pace unavailable"
      : pace < 0
        ? `${Math.abs(
            pace
          )} min ahead`
        : pace === 0
          ? "On pace"
          : `${pace} min behind`;

  return (
    <div className="grid min-h-[112px] items-center gap-4 px-6 py-4 sm:grid-cols-[90px_minmax(0,1fr)_150px]">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--golfops-accent-text)]">
          {course}
        </div>

        <div className="mt-1 text-lg font-black">
          {displayTime(
            group.teeTime
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-lg font-bold">
          {group.players.join(" • ") ||
            "Foursome"}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-[var(--golfops-text-muted)]">
          <span>
            Cart{group.carts.length === 1
              ? ""
              : "s"}{" "}
            {group.carts.join(" / ")}
          </span>

          <span>•</span>
          <span>{group.hole}</span>

          <span>•</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${paceDot}`}
            />
            {paceLabel}
          </span>
        </div>
      </div>

      <div className="text-left sm:text-right">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--golfops-text-dim)]">
          Estimated Finish
        </div>

        <div className="mt-1 text-2xl font-black text-[var(--golfops-accent-text)]">
          {formatFinishTime(
            group.estimatedFinishMinutes
          )}
        </div>
      </div>
    </div>
  );
}
