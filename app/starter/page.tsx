import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import PerryWeatherWidget from "@/components/PerryWeatherWidget";
import StarterTeeSheetScroller from "@/components/StarterTeeSheetScroller";
import { easternDateString } from "@/lib/golfops-date";
import { getGolfOpsAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TeeSheetSlot = {
  id: string;
  tee_time: string;
  course: string;
  starting_hole: number;
  starting_position: string | null;
  slot_position: number;
  player_name: string | null;
  bag_number: string | null;
  cw: string | null;
  cart_number: string | null;
  check_in: string | null;
};

type GroupedTeeTime = {
  teeTime: string;
  course: string;
  startingHole: number;
  startingPosition: string | null;
  players: TeeSheetSlot[];
};

function formatTime(value: string) {
  const [hourText = "0", minute = "00"] =
    value.split(":");

  let hour = Number(hourText);
  const meridiem = hour >= 12 ? "PM" : "AM";

  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour -= 12;
  }

  return `${hour}:${minute} ${meridiem}`;
}

function displayDate(value: string) {
  const [year, month, day] =
    value.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function easternMinutes(date = new Date()) {
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

  const hour = Number(
    parts.find((part) => part.type === "hour")
      ?.value ?? "0"
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")
      ?.value ?? "0"
  );

  return hour * 60 + minute;
}

function teeTimeMinutes(value: string) {
  const [hourText = "0", minuteText = "0"] =
    value.split(":");

  return (
    Number(hourText) * 60 +
    Number(minuteText)
  );
}

function minutesLabel(value: number) {
  const normalized =
    ((value % 1440) + 1440) % 1440;

  const hour24 =
    Math.floor(normalized / 60);

  const minute =
    normalized % 60;

  const meridiem =
    hour24 >= 12 ? "PM" : "AM";

  const hour =
    hour24 % 12 || 12;

  return `${hour}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function formatStartingHole(
  startingPosition: string | null,
  startingHole: number
) {
  const value =
    (startingPosition ?? "")
      .trim()
      .toUpperCase();

  if (
    value === "F" ||
    value === "F9" ||
    value === "F9/18"
  ) {
    return "1";
  }

  if (
    value === "B" ||
    value === "B9" ||
    value === "B9/18"
  ) {
    return "10";
  }

  if (/^S\d+$/i.test(value)) {
    return "UNASSIGNED";
  }

  return value || String(startingHole);
}

function courseBadgeClass(course: string) {
  const normalized =
    course.trim().toLowerCase();

  if (normalized.includes("eagle")) {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (normalized.includes("talon")) {
    return "border-sky-300 bg-sky-50 text-sky-800";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}

function CheckInIndicator({
  value,
}: {
  value: string | null;
}) {
  const status =
    (value ?? "")
      .trim()
      .toUpperCase();

  if (status === "X") {
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-lg font-black text-white"
        title="Checked in"
      >
        ✓
      </span>
    );
  }

  if (
    status === "N" ||
    status === "NO" ||
    status === "NO_SHOW" ||
    status === "RED"
  ) {
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-xl font-black text-white"
        title="Not checked in"
      >
        ×
      </span>
    );
  }

  return (
    <span
      className="h-8 w-8 rounded-md border-2 border-slate-300 bg-white"
      title="No check-in status"
    />
  );
}

export default async function StarterPage() {
  const access =
    await getGolfOpsAccess();

  if (!access) {
    redirect("/");
  }

  const canUseStarter =
    access.isAdmin ||
    access.permissions.starter;

  if (!canUseStarter) {
    if (access.permissions.tv) {
      redirect("/tv");
    }

    redirect("/settings/account");
  }

  const supabase =
    await createClient();

  const today =
    easternDateString();

  const currentMinutes =
    easternMinutes();

  const windowStart =
    currentMinutes - 15;

  const windowEnd =
    currentMinutes + 60;

  const [
    slotsResult,
    importResult,
  ] =
    await Promise.all([
      supabase
        .from("tee_sheet_slots")
        .select(`
          id,
          tee_time,
          course,
          starting_hole,
          starting_position,
          slot_position,
          player_name,
          bag_number,
          cw,
          cart_number,
          check_in
        `)
        .eq("club_id", access.clubId)
        .eq("sheet_date", today)
        .order("tee_time", { ascending: true })
        .order("course", { ascending: true })
        .order("starting_hole", { ascending: true })
        .order("starting_position", { ascending: true })
        .order("slot_position", { ascending: true }),

      supabase
        .from("tee_sheet_imports")
        .select("created_at")
        .eq("club_id", access.clubId)
        .eq("sheet_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (slotsResult.error) {
    console.error(
      "Starter tee sheet load error:",
      slotsResult.error
    );
  }

  const slots =
    (slotsResult.data ?? []) as TeeSheetSlot[];

  const grouped =
    new Map<string, GroupedTeeTime>();

  for (const slot of slots) {
    const slotMinutes =
      teeTimeMinutes(slot.tee_time);

    if (
      slotMinutes < windowStart ||
      slotMinutes > windowEnd
    ) {
      continue;
    }

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

  const teeTimes =
    Array.from(grouped.values())
      .filter((teeTime) =>
        teeTime.players.some(
          (player) => player.player_name
        )
      );

  const playerCount =
    teeTimes.reduce(
      (total, teeTime) =>
        total +
        teeTime.players.filter(
          (player) => player.player_name
        ).length,
      0
    );

  const checkedInCount =
    teeTimes.reduce(
      (total, teeTime) =>
        total +
        teeTime.players.filter(
          (player) =>
            player.player_name &&
            player.check_in === "X"
        ).length,
      0
    );

  const lastImport =
    importResult.data?.created_at ?? null;

  return (
    <div className="h-screen overflow-hidden bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav
        active="starter"
        selectedDate={today}
      />

      <main className="grid h-[calc(100vh-65px)] min-h-0 gap-4 p-4 lg:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] shadow-sm">
          <header className="shrink-0 border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--golfops-accent)]">
                  Starter Display
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  {displayDate(today)}
                </h1>

                <p className="mt-1 text-sm font-semibold text-[var(--golfops-text-muted)]">
                  Showing {minutesLabel(windowStart)} through {minutesLabel(windowEnd)}
                </p>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold">
                  {teeTimes.length} groups · {playerCount} players
                </div>

                <div className="mt-1 text-xs text-[var(--golfops-text-muted)]">
                  {checkedInCount} checked in
                  {lastImport
                    ? ` · Updated ${new Date(lastImport).toLocaleTimeString("en-US", {
                        timeZone: "America/New_York",
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : " · No tee sheet import today"}
                </div>
              </div>
            </div>
          </header>

          <StarterTeeSheetScroller>
            {teeTimes.length === 0 ? (
              <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
                <div>
                  <h2 className="text-xl font-bold">
                    No groups in the current window
                  </h2>

                  <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">
                    Groups will appear automatically as their tee times approach.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {teeTimes.map((teeTime) => (
                  <article
                    key={[
                      teeTime.teeTime,
                      teeTime.course,
                      teeTime.startingPosition ?? teeTime.startingHole,
                    ].join("|")}
                    className="grid min-h-[126px] overflow-hidden rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] lg:grid-cols-[112px_repeat(4,minmax(0,1fr))]"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-4 py-3 lg:flex-col lg:justify-center lg:border-b-0 lg:border-r lg:px-2 lg:text-center">
                      <div className="text-lg font-black">
                        {formatTime(teeTime.teeTime)}
                      </div>

                      <div
                        className={[
                          "rounded-md border px-2 py-1 text-xs font-black uppercase tracking-wide",
                          courseBadgeClass(teeTime.course),
                        ].join(" ")}
                      >
                        {teeTime.course}
                      </div>

                      <div className="text-xs font-bold text-[var(--golfops-text-muted)]">
                        Hole {formatStartingHole(
                          teeTime.startingPosition,
                          teeTime.startingHole
                        )}
                      </div>
                    </div>

                    {[0, 1, 2, 3].map((position) => {
                      const player =
                        teeTime.players[position];

                      if (!player?.player_name) {
                        return (
                          <div
                            key={position}
                            className="golfops-open-slot hidden border-r border-[var(--golfops-border)] lg:block"
                          />
                        );
                      }

                      return (
                        <div
                          key={player.id}
                          className="relative border-b border-[var(--golfops-border)] px-3 py-3 last:border-b-0 lg:border-b-0 lg:border-r"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xl font-black leading-none">
                              {player.bag_number || "—"}
                            </div>

                            <CheckInIndicator
                              value={player.check_in}
                            />
                          </div>

                          <div className="mt-3 line-clamp-2 text-base font-bold leading-tight">
                            {player.player_name}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--golfops-text-muted)]">
                            {player.cw && (
                              <span className="rounded bg-[var(--golfops-surface-soft)] px-1.5 py-0.5">
                                {player.cw}
                              </span>
                            )}

                            <span>
                              Cart {player.cart_number || "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </article>
                ))}
              </div>
            )}
          </StarterTeeSheetScroller>
        </section>

        <div className="min-h-0">
          <PerryWeatherWidget variant="starter" />
        </div>
      </main>
    </div>
  );
}
