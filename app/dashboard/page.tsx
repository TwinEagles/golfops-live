import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BagStatusButton from "@/components/BagStatusButton";
import CartNumberInput from "@/components/CartNumberInput";
import TeeTimeEditRow from "@/components/TeeTimeEditRow";
import AppNav from "@/components/AppNav";
import TeeSheetDateSelector from "@/components/TeeSheetDateSelector";

function formatStartingHole(
  startingPosition: string | null,
  startingHole: number
) {
  const value =
    (startingPosition ?? "")
      .trim()
      .toUpperCase();

  /*
    ForeTees front-nine/front-side
    designations all start on Hole 1.
  */

  if (
    value === "F" ||
    value === "F9" ||
    value === "F9/18"
  ) {
    return "1";
  }

  /*
    ForeTees back-nine/back-side
    designations all start on Hole 10.
  */

  if (
    value === "B" ||
    value === "B9" ||
    value === "B9/18"
  ) {
    return "10";
  }

  /*
    ForeTees standby/open shotgun groups are
    stored internally as S1, S2, S3, etc. so
    multiple rows at the same shotgun time
    remain distinct. Display them simply as S.
  */
  if (/^S\d+$/i.test(value)) {
    return "UNASSIGNED";
  }

  /*
    Shotgun positions such as
    1A, 1B, 10A remain unchanged.
  */

  if (value) {
    return value;
  }

  return String(
    startingHole
  );
}
function formatTime(value: string) {
  const [hourText, minute] = value.split(":");
  let hour = Number(hourText);

  const meridiem = hour >= 12 ? "PM" : "AM";

  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour -= 12;
  }

  return `${hour}:${minute} ${meridiem}`;
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeName(value: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeBag(value: string | null) {
  return (value ?? "")
    .trim()
    .toUpperCase();
}

type TeeSheetSlot = {
  id: string;
  tee_time: string;
  course: string;
  starting_hole: number;
  starting_position: string | null;
  holes: number;
  slot_position: number;
  player_name: string | null;
  member_id: string | null;
  bag_number: string | null;
  cw: string | null;
  cart_number: string | null;
  check_in: string | null;
  highlight: string | null;
};

type GroupedTeeTime = {
  teeTime: string;
  course: string;
  startingHole: number;
  startingPosition: string | null;
  players: TeeSheetSlot[];
};

type DashboardPageProps = {
  searchParams: Promise<{
    date?: string;
    q?: string;
  }>;
};

type OperationalSettings = {
  showPlayedTodayStar?: boolean;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) {
    return (
      <main className="p-10">
        Unable to determine your club.
      </main>
    );
  }

  /*
    CLUB OPERATIONAL SETTINGS

    These settings are saved from:
    Settings -> Tee Sheet
  */
  const {
    data: operationalSettingsRow,
  } = await supabase
    .from("club_operational_settings")
    .select("settings")
    .eq("club_id", profile.club_id)
    .maybeSingle();

  const operationalSettings =
    (
      operationalSettingsRow?.settings &&
      typeof operationalSettingsRow.settings ===
        "object"
        ? operationalSettingsRow.settings
        : {}
    ) as OperationalSettings;

  const showPlayedTodayStar =
    operationalSettings.showPlayedTodayStar ??
    true;

  const params = await searchParams;

  const now = new Date();

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const tomorrow = addDays(today, 1);

  const selectedDate =
    typeof params.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : today;

  /*
    Load recently captured tee-sheet dates for the
    date dropdown. We use imports rather than every
    tee-sheet slot so each date appears only once.
  */
  const {
    data: importedDateRows,
  } = await supabase
    .from("tee_sheet_imports")
    .select("sheet_date")
    .eq("club_id", profile.club_id)
    .order("sheet_date", { ascending: false })
    .limit(120);

  const availableDates = Array.from(
    new Set(
      (importedDateRows ?? [])
        .map((row) => row.sheet_date)
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(value)
        )
    )
  );

  if (!availableDates.includes(selectedDate)) {
    availableDates.push(selectedDate);
    availableDates.sort((a, b) =>
      b.localeCompare(a)
    );
  }

  const search =
    typeof params.q === "string"
      ? params.q.trim().toLowerCase()
      : "";

  const previousDate = addDays(selectedDate, -1);
  const nextDate = addDays(selectedDate, 1);

  let dateLabel = "";

  if (selectedDate === today) {
    dateLabel = "TODAY";
  } else if (selectedDate === tomorrow) {
    dateLabel = "TOMORROW";
  }

  /*
    Load selected day's tee sheet.
  */
  const { data, error } = await supabase
    .from("tee_sheet_slots")
    .select(`
      id,
      tee_time,
      course,
      starting_hole,
      starting_position,
      holes,
      slot_position,
      player_name,
      member_id,
      bag_number,
      cw,
      cart_number,
      check_in,
      highlight
    `)
    .eq("club_id", profile.club_id)
    .eq("sheet_date", selectedDate)
    .order("tee_time", { ascending: true })
    .order("course", { ascending: true })
    .order("starting_hole", { ascending: true })
    .order("starting_position", { ascending: true })
    .order("slot_position", { ascending: true });

  if (error) {
    console.error("Tee sheet load error:", error);
  }

  const slots = (data ?? []) as TeeSheetSlot[];

  /*
    Load latest import snapshot for this date
    so we can display Today's Events.
  */
  const { data: latestImportForDate } = await supabase
    .from("tee_sheet_imports")
    .select("parsed_snapshot")
    .eq("club_id", profile.club_id)
    .eq("sheet_date", selectedDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const parsedSnapshot =
    latestImportForDate?.parsed_snapshot as
      | {
          eventName?: string | null;
        }
      | null;

  const todayEvent =
    parsedSnapshot?.eventName ?? null;

  /*
    Load today's players when viewing another date.
    Used for the star indicator.
  */
  let todaySlots: TeeSheetSlot[] = [];

  if (
    showPlayedTodayStar &&
    selectedDate !== today
  ) {
    const { data: todayData } = await supabase
      .from("tee_sheet_slots")
      .select(`
        id,
        tee_time,
        course,
        starting_hole,
        starting_position,
        holes,
        slot_position,
        player_name,
        member_id,
        bag_number,
        cw,
        cart_number,
        check_in,
        highlight
      `)
      .eq("club_id", profile.club_id)
      .eq("sheet_date", today);

    todaySlots = (todayData ?? []) as TeeSheetSlot[];
  }

  const todayMemberIds = new Set(
    todaySlots
      .filter((slot) => slot.member_id)
      .map((slot) => slot.member_id as string)
  );

  const todayBags = new Set(
    todaySlots
      .filter((slot) => slot.bag_number)
      .map((slot) => normalizeBag(slot.bag_number))
  );

  const todayNames = new Set(
    todaySlots
      .filter((slot) => slot.player_name)
      .map((slot) => normalizeName(slot.player_name))
  );

  function playerAlsoOnToday(slot: TeeSheetSlot) {
    if (
      !showPlayedTodayStar ||
      selectedDate === today
    ) {
      return false;
    }

    if (
      slot.member_id &&
      todayMemberIds.has(slot.member_id)
    ) {
      return true;
    }

    const bag = normalizeBag(slot.bag_number);

    if (bag && todayBags.has(bag)) {
      return true;
    }

    const name = normalizeName(slot.player_name);

    return !!name && todayNames.has(name);
  }



  /*
    Group slots into tee-time / shotgun-position rows.
  */
  const grouped = new Map<string, GroupedTeeTime>();

  for (const slot of slots) {
    const positionKey =
      slot.starting_position ??
      String(slot.starting_hole);

    const key = [
      slot.tee_time,
      slot.course,
      positionKey,
    ].join("|");

    if (!grouped.has(key)) {
      grouped.set(key, {
        teeTime: slot.tee_time,
        course: slot.course,
        startingHole: slot.starting_hole,
        startingPosition: slot.starting_position,
        players: [],
      });
    }

    grouped.get(key)!.players.push(slot);
  }

  let teeTimes = Array.from(grouped.values());

  /*
    Search by player, bag, or cart.
  */
  if (search) {
    teeTimes = teeTimes.filter((teeTime) =>
      teeTime.players.some((player) => {
        return (
          player.player_name
            ?.toLowerCase()
            .includes(search) ||
          player.bag_number
            ?.toLowerCase()
            .includes(search) ||
          player.cart_number
            ?.toLowerCase()
            .includes(search)
        );
      })
    );
  }

  const occupiedPlayers = slots.filter(
    (slot) => slot.player_name
  ).length;

  const checkedInPlayers = slots.filter(
    (slot) =>
      slot.player_name &&
      slot.check_in === "X"
  ).length;

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      {/* TOP NAVIGATION */}
     <AppNav
  active="tee-sheet"
  selectedDate={selectedDate}
/>

      {/* DATE / PRINT BAR */}
      <div className="border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-muted)]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-center gap-1 px-2 py-3 sm:gap-4 sm:px-4 lg:gap-6">
          <Link
            href={`/print/placards?mode=all&date=${selectedDate}`}
            target="_blank"
            title="Print Cart Signs"
            aria-label="Print Cart Signs"
            className="
              flex h-10 w-10 shrink-0 sm:h-12 sm:w-12
              items-center justify-center
              rounded-lg
              text-[var(--golfops-text-secondary)]
              transition
              hover:bg-[var(--golfops-surface-soft)]
              hover:shadow-sm
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M6 9V2h12v7" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />

              <rect
                x="6"
                y="14"
                width="12"
                height="8"
              />
            </svg>
          </Link>

          <Link
            href={`/dashboard?date=${previousDate}`}
            className="shrink-0 rounded-md px-2 py-1 text-3xl leading-none text-[var(--golfops-text-secondary)] hover:bg-[var(--golfops-surface-soft)] sm:px-3"
          >
            ‹
          </Link>

          <TeeSheetDateSelector
            selectedDate={selectedDate}
            availableDates={availableDates}
            today={today}
          />

          <Link
            href={`/dashboard?date=${nextDate}`}
            className="shrink-0 rounded-md px-2 py-1 text-3xl leading-none text-[var(--golfops-text-secondary)] hover:bg-[var(--golfops-surface-soft)] sm:px-3"
          >
            ›
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-[1280px] px-4 py-4">
        {/* LEGEND */}
        <details
          open
          className="mb-4 overflow-hidden rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)]"
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--golfops-text-secondary)]">
            ⓘ &nbsp; Legend

            <span className="ml-2 text-xs font-normal text-[var(--golfops-text-dim)]">
              hide
            </span>
          </summary>

          <div className="grid gap-8 border-t border-[var(--golfops-border)] px-4 py-3 text-xs text-[var(--golfops-text-muted)] md:grid-cols-4">
            {/* ROW COLORS */}
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Row Colors
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-7 rounded border-l-4 border-green-500 bg-green-100" />
                  <span>Added</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-5 w-7 rounded border-l-4 border-amber-400 bg-amber-100" />
                  <span>Time changed</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-5 w-7 rounded border-l-4 border-cyan-400 bg-cyan-100" />
                  <span>Hole changed</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-5 w-7 rounded border-l-4 border-purple-500 bg-purple-100" />
                  <span>Player replaced</span>
                </div>
              </div>
            </div>

            {/* PLAYER BADGES */}
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Player Badges
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[var(--golfops-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--golfops-accent-text)]">
                    MANUAL
                  </span>

                  <span>
                    Added directly in GolfOps Live
                    <br />
                    (not from ForeTees import)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="italic text-[var(--golfops-accent-text)]">
                    Open
                  </span>

                  <span>
                    — empty slot
                  </span>
                </div>
              </div>
            </div>

            {/* CART / WALKER */}
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Cart / Walker
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-500">
                    C
                  </span>

                  <span>
                    Cart
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--golfops-accent-text)]">
                    W
                  </span>

                  <span>
                    Walker
                  </span>
                </div>
              </div>
            </div>

            {/* OTHER */}
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Other
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-1 rounded bg-amber-400" />

                  <span>
                    Event (color set by tag)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--golfops-accent)] text-[10px] font-bold text-white">
                    ✓
                  </span>

                  <span>
                    Checked in
                  </span>
                </div>

                {showPlayedTodayStar && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      ⭐
                    </span>

                    <span>
                      Also on today's tee sheet
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </details>

        {/* TODAY'S EVENTS */}
        {todayEvent && (
          <div className="mb-4 flex items-center gap-2 text-sm text-[var(--golfops-text-muted)]">
            <span>
              Today&apos;s Events:
            </span>

            <span className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-accent-soft)] px-3 py-1.5 font-medium text-[var(--golfops-accent-text)]">
              {todayEvent}
            </span>
          </div>
        )}

        {/* SEARCH / COUNTS */}
        <div className="mb-3 flex flex-col gap-3 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2">
          <form
            action="/dashboard"
            method="GET"
            className="w-full max-w-[470px]"
          >
            <input
              type="hidden"
              name="date"
              value={selectedDate}
            />

            <input
              type="search"
              name="q"
              defaultValue={
                params.q ?? ""
              }
              placeholder="Search players, bags, carts..."
              className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg)] px-4 py-3 text-sm text-[var(--golfops-text)] outline-none placeholder:text-[var(--golfops-text-dim)] focus:border-[var(--golfops-accent)]"
            />
          </form>

          <div className="whitespace-nowrap text-sm sm:ml-4">
            <span className="font-bold text-[var(--golfops-text)]">
              {occupiedPlayers}
            </span>

            <span className="ml-1 text-[var(--golfops-text-dim)]">
              players
            </span>

            <span className="ml-4 font-bold text-[var(--golfops-accent)]">
              {checkedInPlayers}
            </span>

            <span className="ml-1 text-[var(--golfops-text-dim)]">
              in
            </span>
          </div>
        </div>

        {teeTimes.length === 0 ? (
          <div className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-10 text-center">
            <h2 className="font-semibold text-[var(--golfops-text-secondary)]">
              No tee sheet captured
            </h2>

            <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">
              There is no imported ForeTees tee sheet for this date.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {teeTimes.map((teeTime) => {
              const groupHighlighted =
                teeTime.players.some(
                  (player) =>
                    player.highlight
                );

              const editSlots =
                [0, 1, 2, 3].map(
                  (position) => {
                    const player =
                      teeTime.players[position];

                    return {
                      id:
                        player?.id ??
                        `empty-${[
                          teeTime.teeTime,
                          teeTime.course,
                          teeTime.startingPosition ??
                            teeTime.startingHole,
                          position,
                        ].join("-")}`,

                      playerName:
                        player?.player_name ??
                        null,
                    };
                  }
                );

              return (
                <div
                  key={[
                    teeTime.teeTime,
                    teeTime.course,
                    teeTime.startingPosition ??
                      teeTime.startingHole,
                  ].join("|")}
                  className={[
                    "relative flex min-h-[112px] flex-col overflow-hidden rounded-lg border border-[var(--golfops-border)] md:grid md:grid-cols-[90px_repeat(4,minmax(0,1fr))_52px] md:rounded-md",
                    groupHighlighted
                      ? "golfops-row-highlight"
                      : "bg-[var(--golfops-surface)]",
                  ].join(" ")}
                >
                  {/* TIME / COURSE / HOLE */}
                  <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--golfops-border-strong)] bg-[var(--golfops-surface-soft)] px-4 py-3 text-center md:flex-col md:justify-center md:border-b-0 md:border-r-2 md:px-2 md:py-0">
                    <div className="text-base font-bold text-[var(--golfops-text)]">
                      {formatTime(
                        teeTime.teeTime
                      )}
                    </div>

                    <div className="golfops-course-label text-sm font-medium md:mt-2">
                      {teeTime.course}
                    </div>

                    <div className="golfops-hole-badge rounded px-2 py-0.5 text-xs font-bold md:mt-1">
                      {formatStartingHole(
                        teeTime.startingPosition,
                        teeTime.startingHole
                      )}
                    </div>
                  </div>

                  {/* FOUR PLAYER POSITIONS */}
                  {[0, 1, 2, 3].map(
                    (position) => {
                      const player =
                        teeTime.players[position];

                      if (
                        !player?.player_name
                      ) {
                        return (
                          <div
                            key={position}
                            className="golfops-open-slot min-h-[52px] border-b border-[var(--golfops-border)] md:min-h-0 md:border-b-0 md:border-r"
                          />
                        );
                      }

                      return (
                        <div
                          key={position}
                          className="relative min-h-[108px] border-b border-[var(--golfops-border)] bg-[var(--golfops-surface)] px-4 py-3 md:min-h-0 md:border-b-0 md:border-r md:px-3 md:py-2"
                        >
                          {/* LARGE BAG NUMBER */}
                          <div className="pr-10 text-xl font-bold leading-none text-[var(--golfops-text)]">
                            {playerAlsoOnToday(
                              player
                            ) && (
                              <span
                                className="mr-1.5 text-base"
                                title="This golfer is also on today's tee sheet"
                              >
                                ⭐
                              </span>
                            )}

                            {player.bag_number ??
                              ""}
                          </div>

                          {/* CHECK BOX */}
                          <div className="absolute right-2 top-2">
                            <BagStatusButton
                              slotId={
                                player.id
                              }
                              bagNumber={
                                player.bag_number
                              }
                              initialStatus={
                                player.check_in
                              }
                            />
                          </div>

                          {/* PLAYER NAME */}
                          <div className="mt-3 flex items-center gap-2">
                            {player.cw && (
                              <span className="rounded bg-[var(--golfops-surface-soft)] px-1.5 py-0.5 text-xs font-bold text-[var(--golfops-text-muted)]">
                                {player.cw}
                              </span>
                            )}

                            <span className="font-bold text-[var(--golfops-text)]">
                              {player.player_name}
                            </span>
                          </div>

                          {/* CART NUMBER */}
                          <div className="mt-3">
                            <CartNumberInput
                              slotId={
                                player.id
                              }
                              initialCartNumber={
                                player.cart_number
                              }
                            />
                          </div>
                        </div>
                      );
                    }
                  )}

                  {/* EDIT / DONE */}
                  <div className="hidden items-center justify-center bg-[var(--golfops-surface)] md:flex">
                    <TeeTimeEditRow
                      slots={editSlots}
                    />
                  </div>

                  <div className="bg-[var(--golfops-surface)] p-2 md:hidden">
                    <TeeTimeEditRow
                      slots={editSlots}
                      mobile
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
