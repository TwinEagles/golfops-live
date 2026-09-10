import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChangeSelectionList from "@/components/ChangeSelectionList";
import ChangesPrintMenu from "@/components/ChangesPrintMenu";
import AppNav from "@/components/AppNav";

type ChangeRecord = {
  id: string;

  change_type:
    | "ADDED"
    | "REMOVED"
    | "TIME_CHANGED"
    | "HOLE_CHANGED"
    | "REPLACED"
    | "CART_ASSIGNED";

  player_name: string | null;
  bag_number: string | null;
  cart_number: string | null;
  tee_time: string | null;
  starting_hole: number | null;
  detail: string | null;

  status:
    | "OPEN"
    | "CLEARED";

  created_at: string;
  cleared_at: string | null;

  old_value:
    | Record<string, unknown>
    | null;

  new_value:
    | Record<string, unknown>
    | null;
};

type ChangesPageProps = {
  searchParams: Promise<{
    date?: string;
    view?: string;
    type?: string;
    showCleared?: string;
  }>;
};

function addDays(
  value: string,
  days: number
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  date.setDate(
    date.getDate() +
      days
  );

  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function formatDisplayDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "numeric",
      day: "numeric",
      year: "numeric",
    }
  );
}

function formatTime(
  value: string | null
) {
  if (!value) {
    return "Unknown Time";
  }

  const [
    hourText,
    minute,
  ] =
    value.split(":");

  let hour =
    Number(
      hourText
    );

  const meridiem =
    hour >= 12
      ? "PM"
      : "AM";

  if (
    hour === 0
  ) {
    hour = 12;
  } else if (
    hour > 12
  ) {
    hour -= 12;
  }

  return `${hour}:${minute} ${meridiem}`;
}

function changeLabel(
  type:
    ChangeRecord["change_type"]
) {
  switch (type) {
    case "ADDED":
      return "ADDED";

    case "REMOVED":
      return "REMOVED";

    case "TIME_CHANGED":
      return "TIME CHANGED";

    case "HOLE_CHANGED":
      return "HOLE CHANGED";

    case "REPLACED":
      return "REPLACED";

    case "CART_ASSIGNED":
      return "CART ASSIGNED";
  }
}

function badgeClasses(
  type:
    ChangeRecord["change_type"]
) {
  switch (type) {
    case "ADDED":
      return "border-green-400 bg-green-100 text-green-700";

    case "REMOVED":
      return "border-red-300 bg-red-100 text-red-700";

    case "TIME_CHANGED":
      return "border-amber-300 bg-amber-100 text-amber-700";

    case "HOLE_CHANGED":
      return "border-cyan-400 bg-cyan-100 text-cyan-700";

    case "REPLACED":
      return "border-purple-400 bg-purple-100 text-purple-700";

    case "CART_ASSIGNED":
      return "border-blue-300 bg-blue-100 text-blue-700";
  }
}

function getStringValue(
  record:
    | Record<string, unknown>
    | null,

  key: string
) {
  if (!record) {
    return null;
  }

  const value =
    record[key];

  return typeof value ===
    "string"
    ? value
    : null;
}

function getNumberValue(
  record:
    | Record<string, unknown>
    | null,

  key: string
) {
  if (!record) {
    return null;
  }

  const value =
    record[key];

  return typeof value ===
    "number"
    ? value
    : null;
}

function createChangeDetail(
  change: ChangeRecord
) {
  const oldTime =
    getStringValue(
      change.old_value,
      "tee_time"
    );

  const newTime =
    getStringValue(
      change.new_value,
      "tee_time"
    );

  const oldPosition =
    getStringValue(
      change.old_value,
      "starting_position"
    ) ??
    getNumberValue(
      change.old_value,
      "starting_hole"
    )?.toString();

  const newPosition =
    getStringValue(
      change.new_value,
      "starting_position"
    ) ??
    getNumberValue(
      change.new_value,
      "starting_hole"
    )?.toString();

  const oldPlayer =
    getStringValue(
      change.old_value,
      "player_name"
    );

  const newPlayer =
    getStringValue(
      change.new_value,
      "player_name"
    );

  switch (
    change.change_type
  ) {
    case "TIME_CHANGED":
      if (
        oldTime &&
        newTime
      ) {
        return `${formatTime(
          oldTime
        )} → ${formatTime(
          newTime
        )}`;
      }

      break;

    case "HOLE_CHANGED":
      if (
        oldPosition &&
        newPosition
      ) {
        return `(Hole ${oldPosition}) → (Hole ${newPosition})`;
      }

      break;

    case "REPLACED":
      if (
        oldPlayer &&
        newPlayer
      ) {
        return `Replaced ${oldPlayer}`;
      }

      break;

    case "ADDED":
      if (
        newPosition
      ) {
        return `Added to Hole ${newPosition}`;
      }

      break;

    case "REMOVED":
      if (
        oldPosition
      ) {
        return `Removed from Hole ${oldPosition}`;
      }

      break;

    case "CART_ASSIGNED":
      return (
        change.detail ??
        `Cart ${change.cart_number ?? "assigned"}`
      );
  }

  return (
    change.detail ??
    ""
  );
}

function buildHref({
  date,
  view,
  type,
  showCleared,
}: {
  date: string;
  view?: string;
  type?: string;
  showCleared?: boolean;
}) {
  const query =
    new URLSearchParams();

  query.set(
    "date",
    date
  );

  if (
    view &&
    view !== "all"
  ) {
    query.set(
      "view",
      view
    );
  }

  if (
    type &&
    type !== "ALL"
  ) {
    query.set(
      "type",
      type
    );
  }

  if (
    typeof showCleared ===
    "boolean"
  ) {
    query.set(
      "showCleared",
      showCleared
        ? "1"
        : "0"
    );
  }

  return `/changes?${query.toString()}`;
}

export default async function ChangesPage({
  searchParams,
}: ChangesPageProps) {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data: profile,
  } =
    await supabase
      .from(
        "profiles"
      )
      .select(
        "club_id"
      )
      .eq(
        "id",
        user.id
      )
      .single();

  if (
    !profile?.club_id
  ) {
    return (
      <main className="p-10">
        Unable to determine your club.
      </main>
    );
  }

  const params =
    await searchParams;

  /*
    Load the club-level Changes defaults.

    URL parameters still take priority so
    an individual user can temporarily
    show or hide cleared changes without
    changing the saved club setting.
  */

  const {
    data: settingsRow,
    error: settingsError,
  } =
    await supabase
      .from(
        "club_operational_settings"
      )
      .select("settings")
      .eq(
        "club_id",
        profile.club_id
      )
      .maybeSingle();

  if (settingsError) {
    console.error(
      "Changes settings load error:",
      settingsError
    );
  }

  const operationalSettings =
    (
      settingsRow?.settings &&
      typeof settingsRow.settings ===
        "object"
    )
      ? (
          settingsRow.settings as
            Record<string, unknown>
        )
      : {};

  // Keep the live Changes view focused on items that still require
  // attention. Cleared entries remain available through the explicit
  // "Show cleared" control.
  const defaultShowCleared =
    false;

  const retentionCandidate =
    Number(
      operationalSettings.clearedChangesRetentionDays
    );

  const clearedChangesRetentionDays =
    [7, 14, 30, 60, 90].includes(
      retentionCandidate
    )
      ? retentionCandidate
      : 30;

  const now =
    new Date();

  const today =
    easternDateString();

  const tomorrow =
    addDays(
      today,
      1
    );

  const selectedDate =
    typeof params.date ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      params.date
    )
      ? params.date
      : today;

  const view =
    params.view ===
      "changes" ||
    params.view ===
      "activity"
      ? params.view
      : "all";

  const selectedType =
    typeof params.type ===
      "string"
      ? params.type
      : "ALL";

  const showCleared =
    params.showCleared ===
    "1"
      ? true
      : params.showCleared ===
          "0"
        ? false
        : defaultShowCleared;

  const previousDate =
    addDays(
      selectedDate,
      -1
    );

  const nextDate =
    addDays(
      selectedDate,
      1
    );

  const selectedDayStart =
    easternMidnightIso(
      selectedDate
    );

  const selectedDayEnd =
    easternMidnightIso(
      nextDate
    );

  /*
    Retention is enforced as a display
    boundary here, not a destructive
    delete. Cleared records older than
    the saved retention window are hidden.

    A scheduled cleanup job can be added
    later if you decide old cleared rows
    should actually be deleted.
  */

  const retentionCutoff =
    new Date(
      now.getTime() -
        clearedChangesRetentionDays *
          24 *
          60 *
          60 *
          1000
    ).toISOString();

  let dateLabel =
    "";

  if (
    selectedDate ===
    today
  ) {
    dateLabel =
      "TODAY";
  } else if (
    selectedDate ===
    tomorrow
  ) {
    dateLabel =
      "TOMORROW";
  }

  /*
    We load the selected day's
    change records.
  */

  let query =
    supabase
      .from(
        "tee_sheet_changes"
      )
      .select(`
        id,
        change_type,
        player_name,
        bag_number,
        cart_number,
        tee_time,
        starting_hole,
        detail,
        status,
        created_at,
        cleared_at,
        old_value,
        new_value
      `)
      .eq(
        "club_id",
        profile.club_id
      )
      .eq(
        "sheet_date",
        selectedDate
      )
      .gte(
        "created_at",
        selectedDayStart
      )
      .lt(
        "created_at",
        selectedDayEnd
      )
      .order(
        "tee_time",
        {
          ascending: true,
        }
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

  if (
    !showCleared
  ) {
    query =
      query.eq(
        "status",
        "OPEN"
      );
  } else {
    /*
      Always include OPEN changes.

      Include CLEARED changes only when
      they were cleared inside the saved
      retention period. This makes the
      retention setting operational now
      without deleting historical data.
    */

    query =
      query.or(
        `status.eq.OPEN,and(status.eq.CLEARED,cleared_at.gte.${retentionCutoff})`
      );
  }

  if (
    selectedType !==
      "ALL" &&
    [
      "ADDED",
      "REMOVED",
      "TIME_CHANGED",
      "HOLE_CHANGED",
      "REPLACED",
      "CART_ASSIGNED",
    ].includes(
      selectedType
    )
  ) {
    query =
      query.eq(
        "change_type",
        selectedType
      );
  }

  if (view === "changes") {
    query =
      query.neq(
        "change_type",
        "CART_ASSIGNED"
      );
  } else if (
    view === "activity"
  ) {
    query =
      query.eq(
        "change_type",
        "CART_ASSIGNED"
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    console.error(
      "Changes load error:",
      error
    );
  }

  const changes =
    (
      data ??
      []
    ) as ChangeRecord[];

  /*
    Count open changes independently
    from whether Show Cleared is active.
  */

  const {
    count: openCountResult,
  } =
    await supabase
      .from(
        "tee_sheet_changes"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "club_id",
        profile.club_id
      )
      .eq(
        "sheet_date",
        selectedDate
      )
      .gte(
        "created_at",
        selectedDayStart
      )
      .lt(
        "created_at",
        selectedDayEnd
      )
      .eq(
        "status",
        "OPEN"
      );

  const openCount =
    openCountResult ??
    0;

  /*
    Group changes by tee time.
  */

  const grouped =
    new Map<
      string,
      ChangeRecord[]
    >();

  for (
    const change of changes
  ) {
    const time =
      change.tee_time ??
      "Unknown";

    if (
      !grouped.has(
        time
      )
    ) {
      grouped.set(
        time,
        []
      );
    }

    grouped
      .get(
        time
      )!
      .push(
        change
      );
  }

  /*
    Convert our server data into the
    format expected by the client-side
    selection / bulk clear component.
  */

  const selectionGroups =
    Array.from(
      grouped.entries()
    ).map(
      ([
        teeTime,
        timeChanges,
      ]) => ({
        teeTime:
          formatTime(
            teeTime
          ),

        count:
          timeChanges.length,

        items:
          timeChanges.map(
            (
              change
            ) => ({
              id:
                change.id,

              badge:
                changeLabel(
                  change.change_type
                ),

              badgeClass:
                badgeClasses(
                  change.change_type
                ),

              playerName:
                change.player_name ??
                "Unknown Player",

              detail:
                createChangeDetail(
                  change
                ),

              bagNumber:
                change.bag_number,

              cartNumber:
                change.cart_number,

              status:
                change.status,
            })
          ),
      })
    );

  const filterOptions =
    [
      {
        label:
          "All Types",
        value:
          "ALL",
      },

      {
        label:
          "Added",
        value:
          "ADDED",
      },

      {
        label:
          "Removed",
        value:
          "REMOVED",
      },

      {
        label:
          "Time Changed",
        value:
          "TIME_CHANGED",
      },

      {
        label:
          "Hole Changed",
        value:
          "HOLE_CHANGED",
      },

      {
        label:
          "Replaced",
        value:
          "REPLACED",
      },

      {
        label:
          "Cart Assigned",
        value:
          "CART_ASSIGNED",
      },
    ];

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* TOP NAVIGATION */}

      <AppNav
  active="changes"
  selectedDate={selectedDate}
/>

      {/* DATE NAVIGATION */}

      <div className="border-b border-slate-200 bg-[#ededed]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-center gap-6 px-4 py-3">
          <Link
            href={buildHref({
              date:
                previousDate,
              view,
              type:
                selectedType,
              showCleared,
            })}
            className="rounded-md px-3 py-1 text-3xl leading-none text-slate-700 hover:bg-white"
          >
            ‹
          </Link>

          <div className="flex min-w-[280px] items-center justify-center gap-2">
            <span className="font-semibold text-slate-600">
              {formatDisplayDate(
                selectedDate
              )}
            </span>

            {dateLabel && (
              <span className="text-xs font-bold text-indigo-600">
                {
                  dateLabel
                }
              </span>
            )}
          </div>

          <Link
            href={buildHref({
              date:
                nextDate,
              view,
              type:
                selectedType,
              showCleared,
            })}
            className="rounded-md px-3 py-1 text-3xl leading-none text-slate-700 hover:bg-white"
          >
            ›
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-[880px] px-4 py-7">
        {/* TITLE + PRINT */}

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-950">
            Change & Activity Log
          </h2>

          <div className="flex items-center gap-2">
            <ChangesPrintMenu
              date={
                selectedDate
              }
            />

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-lg font-bold text-slate-500 shadow-sm hover:bg-slate-50"
              title="More options"
            >
              …
            </button>
          </div>
        </div>

        {/* ALL / CHANGES / ACTIVITY */}

        <div className="mb-4">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            <Link
              href={buildHref({
                date:
                  selectedDate,

                view:
                  "all",

                type:
                  selectedType,

                showCleared,
              })}
              className={[
                "rounded-full px-4 py-1.5 text-sm",

                view ===
                "all"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:bg-slate-100",
              ].join(
                " "
              )}
            >
              All
            </Link>

            <Link
              href={buildHref({
                date:
                  selectedDate,

                view:
                  "changes",

                type:
                  selectedType,

                showCleared,
              })}
              className={[
                "rounded-full px-4 py-1.5 text-sm",

                view ===
                "changes"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:bg-slate-100",
              ].join(
                " "
              )}
            >
              Changes
            </Link>

            <Link
              href={buildHref({
                date:
                  selectedDate,

                view:
                  "activity",

                type:
                  selectedType,

                showCleared,
              })}
              className={[
                "rounded-full px-4 py-1.5 text-sm",

                view ===
                "activity"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:bg-slate-100",
              ].join(
                " "
              )}
            >
              Activity
            </Link>
          </div>
        </div>

        {/* FILTERS */}

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <form
            method="GET"
            action="/changes"
            className="flex items-center"
          >
            <input
              type="hidden"
              name="date"
              value={
                selectedDate
              }
            />

            <input
              type="hidden"
              name="view"
              value={
                view
              }
            />

            {showCleared && (
              <input
                type="hidden"
                name="showCleared"
                value="1"
              />
            )}

            <select
              name="type"
              defaultValue={
                selectedType
              }
              className="rounded-md border-0 bg-transparent text-sm text-slate-500 outline-none"
            >
              {filterOptions.map(
                (
                  option
                ) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                )
              )}
            </select>

            <button
              type="submit"
              className="ml-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Apply
            </button>
          </form>

          <Link
            href={buildHref({
              date:
                selectedDate,

              view,

              type:
                selectedType,

              showCleared:
                !showCleared,
            })}
            className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            {showCleared
              ? "Hide cleared"
              : "Show cleared"}
          </Link>
        </div>

        {/* EMPTY STATE */}

        {selectionGroups.length ===
        0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <div className="text-3xl text-slate-400">
              ✓
            </div>

            <h3 className="mt-3 text-lg font-semibold text-slate-900">
              {view ===
              "activity"
                ? "No activity"
                : showCleared
                  ? "No changes"
                  : "No open changes"}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              {view ===
              "activity"
                ? "No PACE cart assignments were recorded for this date."
                : showCleared
                  ? "No change records have been detected for this date."
                  : "No ForeTees changes have been detected for this date."}
            </p>

            {selectedDate ===
              tomorrow &&
              !showCleared &&
              view !==
                "activity" && (
                <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-400">
                  The first capture of tomorrow&apos;s tee sheet establishes the baseline. The next capture of that same date will identify any overnight changes.
                </p>
              )}
          </div>
        ) : (
          <ChangeSelectionList
            groups={
              selectionGroups
            }
          />
        )}
      </main>
    </div>
  );
}

function easternDateString() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    );

  return `${values.year}-${values.month}-${values.day}`;
}

function easternMidnightIso(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  const target =
    Date.UTC(
      year,
      month - 1,
      day
    );

  let candidate = target;

  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }
    );

  for (
    let attempt = 0;
    attempt < 4;
    attempt += 1
  ) {
    const parts =
      Object.fromEntries(
        formatter
          .formatToParts(
            new Date(candidate)
          )
          .map((part) => [
            part.type,
            part.value,
          ])
      );

    const representedAsUtc =
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
      );

    const adjustment =
      target - representedAsUtc;

    candidate += adjustment;

    if (adjustment === 0) {
      break;
    }
  }

  return new Date(
    candidate
  ).toISOString();
}
