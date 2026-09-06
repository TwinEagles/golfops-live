import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";
import PrintPlacardsToolbar from "@/components/PrintPlacardsToolbar";

type PrintPageProps = {
  searchParams: Promise<{
    date?: string;
    mode?: string;
    cutStack?: string;
    holes?: string;
    from?: string;
    to?: string;
    design?: string;
  }>;
};

type OperationalSettings = {
  placardDesign?: "bold" | "clean";
  cutAndStack?: boolean;
  holeOrder?: "1-18" | "18-1";
};

type TeeSheetSlot = {
  id: number;
  tee_time: string;
  course: string | null;
  starting_hole: number | null;
  starting_position: string | null;
  slot_position: number;
  player_name: string | null;
  bag_number: string | null;
  cart_number: string | null;
  cw: string | null;
};

type ChangeRecord = {
  id: number;
  change_type:
    | "ADDED"
    | "REMOVED"
    | "TIME_CHANGED"
    | "HOLE_CHANGED"
    | "REPLACED";
  player_name: string | null;
  bag_number: string | null;
  tee_time: string | null;
  status: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

type Placard = {
  key: string;
  teeTime: string;
  course: string;
  rawStartingPosition: string;
  startingPosition: string;
  cartNumber: string | null;
  slotGroup: "A" | "B";
  players: TeeSheetSlot[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase();
}

function formatDate(value: string) {
  const [year, month, day] =
    value.split("-").map(Number);

  return `${month}/${day}/${year}`;
}

function formatTime(value: string) {
  if (!value) {
    return "";
  }

  const [hourText, minute] =
    value.split(":");

  let hour =
    Number(hourText);

  const meridiem =
    hour >= 12
      ? "PM"
      : "AM";

  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour -= 12;
  }

  return `${hour}:${minute} ${meridiem}`;
}

function getStringValue(
  record: Record<string, unknown> | null,
  key: string
) {
  if (!record) {
    return null;
  }

  const value =
    record[key];

  return typeof value === "string"
    ? value
    : null;
}

function getNumberValue(
  record: Record<string, unknown> | null,
  key: string
) {
  if (!record) {
    return null;
  }

  const value =
    record[key];

  return typeof value === "number"
    ? value
    : null;
}

function displayStartingHole(
  startingPosition: string | null,
  startingHole: number | null
) {
  const position =
    (startingPosition ?? "")
      .trim()
      .toUpperCase();

  /*
    Shotgun positions:
    1A, 1B, 10A, etc.
  */

  if (/^\d+[A-Z]$/.test(position)) {
    return position;
  }

  /*
    Regular tee times:
    F / F9 / F9/18 = Hole 1
  */

  if (position.startsWith("F")) {
    return "1";
  }

  /*
    Regular tee times:
    B / B9 / B9/18 = Hole 10
  */

  if (position.startsWith("B")) {
    return "10";
  }

  if (/^\d+$/.test(position)) {
    return position;
  }

  if (
    startingHole !== null &&
    startingHole !== undefined
  ) {
    return String(startingHole);
  }

  const numeric =
    position.match(/\d+/);

  return numeric
    ? numeric[0]
    : "";
}

function rawPosition(
  startingPosition: string | null,
  startingHole: number | null
) {
  return (
    startingPosition ??
    startingHole?.toString() ??
    ""
  )
    .trim()
    .toUpperCase();
}

function slotGroup(
  position: number
): "A" | "B" {
  return position <= 2
    ? "A"
    : "B";
}

function positionNumber(value: string) {
  const match =
    value.match(/\d+/);

  return match
    ? Number(match[0])
    : 999;
}

function buildPlacards(
  slots: TeeSheetSlot[]
) {
  const groups =
    new Map<
      string,
      TeeSheetSlot[]
    >();

  for (const slot of slots) {
    if (!slot.player_name) {
      continue;
    }

    const position =
      rawPosition(
        slot.starting_position,
        slot.starting_hole
      );

    const fallbackCart =
      slot.slot_position <= 2
        ? "PAIR-A"
        : "PAIR-B";

    const cartKey =
      slot.cart_number?.trim()
        ? `CART-${slot.cart_number.trim()}`
        : fallbackCart;

    const key = [
      slot.tee_time,
      slot.course ?? "",
      position,
      cartKey,
    ].join("|");

    if (!groups.has(key)) {
      groups.set(
        key,
        []
      );
    }

    groups
      .get(key)!
      .push(slot);
  }

  return Array.from(
    groups.entries()
  ).map(
    ([key, players]) => {
      const first =
        players[0];

      return {
        key,

        teeTime:
          first.tee_time,

        course:
          first.course ?? "",

        rawStartingPosition:
          rawPosition(
            first.starting_position,
            first.starting_hole
          ),

        startingPosition:
          displayStartingHole(
            first.starting_position,
            first.starting_hole
          ),

        cartNumber:
          first.cart_number,

        slotGroup:
          slotGroup(
            first.slot_position
          ),

        players:
          [...players].sort(
            (a, b) =>
              a.slot_position -
              b.slot_position
          ),
      };
    }
  ) as Placard[];
}

function placardHasPlayer(
  placard: Placard,
  playerName: string | null,
  bagNumber: string | null
) {
  const targetName =
    normalize(playerName);

  const targetBag =
    normalize(bagNumber);

  return placard.players.some(
    (player) => {
      const playerNameValue =
        normalize(
          player.player_name
        );

      const playerBagValue =
        normalize(
          player.bag_number
        );

      if (
        targetBag &&
        playerBagValue &&
        targetBag ===
          playerBagValue
      ) {
        return true;
      }

      if (
        targetName &&
        playerNameValue &&
        targetName ===
          playerNameValue
      ) {
        return true;
      }

      return false;
    }
  );
}

function findPlacardsForChange(
  change: ChangeRecord,
  placards: Placard[]
) {
  const matches =
    new Set<string>();

  /*
    For ADDED / REPLACED / TIME CHANGED /
    HOLE CHANGED, the useful sign is the
    golfer's CURRENT sign.
  */

  if (
    change.change_type !==
    "REMOVED"
  ) {
    const newPlayer =
      getStringValue(
        change.new_value,
        "player_name"
      );

    const newBag =
      getStringValue(
        change.new_value,
        "bag_number"
      );

    const playerName =
      newPlayer ??
      change.player_name;

    const bagNumber =
      newBag ??
      change.bag_number;

    for (const placard of placards) {
      if (
        placardHasPlayer(
          placard,
          playerName,
          bagNumber
        )
      ) {
        matches.add(
          placard.key
        );
      }
    }

    /*
      If identity matching worked,
      use that precise current sign.
    */

    if (matches.size > 0) {
      return matches;
    }
  }

  /*
    REMOVED PLAYER

    That golfer no longer exists on
    the current tee sheet, so find the
    current cart sign occupying the
    golfer's old physical position.
  */

  const oldTime =
    getStringValue(
      change.old_value,
      "tee_time"
    ) ??
    change.tee_time;

  const oldCourse =
    getStringValue(
      change.old_value,
      "course"
    );

  const oldStartingPosition =
    getStringValue(
      change.old_value,
      "starting_position"
    );

  const oldStartingHole =
    getNumberValue(
      change.old_value,
      "starting_hole"
    );

  const oldSlotPosition =
    getNumberValue(
      change.old_value,
      "slot_position"
    );

  const oldCartNumber =
    getStringValue(
      change.old_value,
      "cart_number"
    );

  const oldRawPosition =
    rawPosition(
      oldStartingPosition,
      oldStartingHole
    );

  const oldSlotGroup =
    oldSlotPosition
      ? slotGroup(
          oldSlotPosition
        )
      : null;

  for (const placard of placards) {
    if (
      oldTime &&
      placard.teeTime !==
        oldTime
    ) {
      continue;
    }

    if (
      oldCourse &&
      normalize(
        placard.course
      ) !==
        normalize(
          oldCourse
        )
    ) {
      continue;
    }

    if (
      oldRawPosition &&
      placard.rawStartingPosition !==
        oldRawPosition
    ) {
      continue;
    }

    /*
      If there was already a cart
      assignment, it is our strongest
      way to identify the affected sign.
    */

    if (
      oldCartNumber &&
      placard.cartNumber
    ) {
      if (
        normalize(
          placard.cartNumber
        ) ===
        normalize(
          oldCartNumber
        )
      ) {
        matches.add(
          placard.key
        );
      }

      continue;
    }

    /*
      Otherwise use the golfer's old
      slot pair:
      Slots 1+2 = first sign
      Slots 3+4 = second sign.
    */

    if (
      oldSlotGroup &&
      placard.slotGroup ===
        oldSlotGroup
    ) {
      matches.add(
        placard.key
      );
    }
  }

  if (matches.size > 0) {
    return matches;
  }

  /*
    Last-resort fallback for older change
    records that did not store enough
    position information.

    Restrict it to the same tee time.
  */

  if (change.tee_time) {
    for (const placard of placards) {
      if (
        placard.teeTime ===
        change.tee_time
      ) {
        matches.add(
          placard.key
        );
      }
    }
  }

  return matches;
}

function filterPlacardsForChanges(
  placards: Placard[],
  changes: ChangeRecord[]
) {
  const wantedKeys =
    new Set<string>();

  for (const change of changes) {
    const matches =
      findPlacardsForChange(
        change,
        placards
      );

    for (
      const key of matches
    ) {
      wantedKeys.add(key);
    }
  }

  return placards.filter(
    (placard) =>
      wantedKeys.has(
        placard.key
      )
  );
}

function cutStackOrder(
  placards: Placard[]
) {
  const split =
    Math.ceil(
      placards.length / 2
    );

  const firstHalf =
    placards.slice(
      0,
      split
    );

  const secondHalf =
    placards.slice(split);

  const result:
    Placard[] = [];

  for (
    let i = 0;
    i < split;
    i++
  ) {
    if (firstHalf[i]) {
      result.push(
        firstHalf[i]
      );
    }

    if (secondHalf[i]) {
      result.push(
        secondHalf[i]
      );
    }
  }

  return result;
}

export default async function PrintPlacardsPage({
  searchParams,
}: PrintPageProps) {
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
  const allowed =
    await hasGolfOpsPermission(
      "tee_sheet"
    );

  if (!allowed) {
    redirect("/dashboard");
  }
  const {
    data: profile,
  } =
    await supabase
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

  const params =
    await searchParams;

  const date =
    typeof params.date ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      params.date
    )
      ? params.date
      : null;

  if (!date) {
    return (
      <main className="p-10">
        A valid tee sheet date is required.
      </main>
    );
  }

  const mode =
    params.mode ===
      "changes"
      ? "changes"
      : "all";

  /*
    CLUB OPERATIONAL SETTINGS

    Query-string values still win when the
    toolbar explicitly changes an option.

    When an option is not present in the URL,
    use the saved Club Settings as the default.
  */

  const {
    data: operationalSettingsRow,
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

  const operationalSettings =
    (
      operationalSettingsRow?.settings &&
      typeof operationalSettingsRow.settings ===
        "object"
        ? operationalSettingsRow.settings
        : {}
    ) as OperationalSettings;

  const defaultCutStack =
    operationalSettings.cutAndStack ??
    true;

  const defaultHoleOrder =
    operationalSettings.holeOrder ??
    "1-18";

  const defaultDesign =
    operationalSettings.placardDesign ??
    "bold";

  const cutStack =
    params.cutStack === "1"
      ? true
      : params.cutStack === "0"
        ? false
        : defaultCutStack;

  const holeOrder =
    params.holes === "desc"
      ? "desc"
      : params.holes === "asc"
        ? "asc"
        : defaultHoleOrder ===
            "18-1"
          ? "desc"
          : "asc";

  const fromTime =
    params.from ?? "";

  const toTime =
    params.to ?? "";

  const design =
    params.design === "clean"
      ? "clean"
      : params.design === "bold"
        ? "bold"
        : defaultDesign;

  /*
    EVENT NAME
  */

  const {
    data: importData,
  } =
    await supabase
      .from(
        "tee_sheet_imports"
      )
      .select(
        "parsed_snapshot"
      )
      .eq(
        "club_id",
        profile.club_id
      )
      .eq(
        "sheet_date",
        date
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

  let eventName:
    string | null = null;

  const snapshot =
    importData?.parsed_snapshot;

  if (
    snapshot &&
    typeof snapshot ===
      "object" &&
    "eventName" in snapshot
  ) {
    const value =
      (
        snapshot as {
          eventName?: unknown;
        }
      ).eventName;

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      eventName =
        value.trim();
    }
  }

  /*
    CURRENT TEE SHEET
  */

  let slotQuery =
    supabase
      .from(
        "tee_sheet_slots"
      )
      .select(`
        id,
        tee_time,
        course,
        starting_hole,
        starting_position,
        slot_position,
        player_name,
        bag_number,
        cart_number,
        cw
      `)
      .eq(
        "club_id",
        profile.club_id
      )
      .eq(
        "sheet_date",
        date
      )
      .not(
        "player_name",
        "is",
        null
      );

  if (fromTime) {
    slotQuery =
      slotQuery.gte(
        "tee_time",
        fromTime
      );
  }

  if (toTime) {
    slotQuery =
      slotQuery.lte(
        "tee_time",
        toTime
      );
  }

  const {
    data: slotData,
    error: slotError,
  } =
    await slotQuery;

  if (slotError) {
    console.error(
      "Placard slot load error:",
      slotError
    );

    return (
      <main className="p-10">
        Unable to load the tee sheet.
      </main>
    );
  }

  const slots =
    (slotData ??
      []) as TeeSheetSlot[];

  let placards =
    buildPlacards(
      slots
    );

  /*
    PRINT CHANGES ONLY
  */

  if (mode === "changes") {
    const {
      data: changeData,
      error: changeError,
    } =
      await supabase
        .from(
          "tee_sheet_changes"
        )
        .select(`
          id,
          change_type,
          player_name,
          bag_number,
          tee_time,
          status,
          old_value,
          new_value
        `)
        .eq(
          "club_id",
          profile.club_id
        )
        .eq(
          "sheet_date",
          date
        )
        .eq(
          "status",
          "OPEN"
        );

    if (changeError) {
      console.error(
        "Placard changes load error:",
        changeError
      );
    }

    const changes =
      (changeData ??
        []) as ChangeRecord[];

    placards =
      filterPlacardsForChanges(
        placards,
        changes
      );
  }

  /*
    SORT
  */

  placards.sort(
    (a, b) => {
      const timeCompare =
        a.teeTime.localeCompare(
          b.teeTime
        );

      if (timeCompare !== 0) {
        return timeCompare;
      }

      const aHole =
        positionNumber(
          a.startingPosition
        );

      const bHole =
        positionNumber(
          b.startingPosition
        );

      const holeCompare =
        holeOrder === "asc"
          ? aHole - bHole
          : bHole - aHole;

      if (holeCompare !== 0) {
        return holeCompare;
      }

      return a.startingPosition.localeCompare(
        b.startingPosition,
        undefined,
        {
          numeric: true,
        }
      );
    }
  );

  if (cutStack) {
    placards =
      cutStackOrder(
        placards
      );
  }

  return (
    <>
      <PrintPlacardsToolbar
        date={date}
        mode={mode}
        placardCount={
          placards.length
        }
        cutStack={cutStack}
        holeOrder={holeOrder}
        design={design}
      />

      <main className="print-page">
        {placards.length === 0 ? (
          <div className="empty-state">
            <h2>
              {mode === "changes"
                ? "No changed cart signs to print"
                : "No cart signs to print"}
            </h2>

            <p>
              {mode === "changes"
                ? "There are no open tee sheet changes requiring a new cart sign."
                : "No matching cart signs were found for this request."}
            </p>
          </div>
        ) : (
          <div className="placard-list">
            {placards.map(
              (placard) => (
                <article
                  key={
                    placard.key
                  }
                  className={[
                    "placard",
                    design ===
                      "clean"
                      ? "clean-design"
                      : "bold-design",
                  ].join(" ")}
                >
                  <div className="inner-border">
                    <header className="sign-header">
                      <div className="club-course">
                        The TwinEagles Club
                        {placard.course ? (
                          <>
                            {" - "}
                            <span
                              className={[
                                "course-name",
                                placard.course
                                  .trim()
                                  .toLowerCase() === "eagle"
                                  ? "course-eagle"
                                  : placard.course
                                        .trim()
                                        .toLowerCase() === "talon"
                                    ? "course-talon"
                                    : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {placard.course}
                            </span>
                          </>
                        ) : null}
                      </div>

                      {eventName && (
                        <div className="event-name">
                          {eventName}
                        </div>
                      )}
                    </header>

                    <div className="watermark">
                      <img
                        src="/twineagles-logo.png"
                        alt=""
                        className="watermark-logo"
                      />
                    </div>

                    <div className="player-area">
                      {placard.players.map(
                        (player) => (
                          <div
                            key={
                              player.id
                            }
                            className="player-name"
                          >
                            {
                              player.player_name
                            }
                          </div>
                        )
                      )}
                    </div>

                    <footer className="sign-footer">
                      <div className="hole-block">
                        Hole:{" "}
                        <strong>
                          {placard.startingPosition ||
                            "—"}
                        </strong>
                      </div>

                      <div className="date-time-block">
                        <div>
                          Date:{" "}
                          <strong>
                            {formatDate(
                              date
                            )}
                          </strong>
                        </div>

                        <div>
                          Time:{" "}
                          <strong>
                            {formatTime(
                              placard.teeTime
                            )}
                          </strong>
                        </div>
                      </div>
                    </footer>
                  </div>

                  <span className="crop crop-tl" />
                  <span className="crop crop-tr" />
                  <span className="crop crop-bl" />
                  <span className="crop crop-br" />
                </article>
              )
            )}
          </div>
        )}
      </main>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f2f3f5;
          color: #000;
        }

        .print-toolbar {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 10px 14px;
          background: #f8f9fb;
          border-bottom: 1px solid #dfe3e8;
          font-family: Arial, sans-serif;
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .toolbar-control,
        .toolbar-close {
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 6px;
          padding: 0 14px;
          background: #e8ebef;
          color: #374151;
          font-size: 13px;
          text-decoration: none;
          cursor: pointer;
        }

        .toolbar-print {
          background: #5965e8;
          color: white;
          font-weight: 700;
        }

        .time-control,
        .design-control {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: Arial, sans-serif;
          color: #64748b;
          font-size: 13px;
        }

        .time-control input,
        .design-control select {
          height: 36px;
          border: 1px solid #d1d5db;
          border-radius: 5px;
          background: white;
          padding: 0 8px;
          font-size: 13px;
        }

        .design-control select {
          min-width: 180px;
        }

        .sign-count {
          font-family: Arial, sans-serif;
          color: #64748b;
          font-size: 13px;
          white-space: nowrap;
        }

        .print-page {
          padding: 24px 0 40px;
        }

        .placard-list {
          width: 760px;
          margin: 0 auto;
        }

        .placard {
          position: relative;
          width: 760px;
          height: 475px;
          margin: 0 auto 18px;
          padding: 8px;
          background: white;
          border: 3px solid #111;
          page-break-inside: avoid;
          break-inside: avoid;
          font-family: Georgia, "Times New Roman", serif;
        }

        .inner-border {
          position: relative;
          width: 100%;
          height: 100%;
          border: 1px solid #555;
          padding: 12px 42px 20px;
          overflow: hidden;
        }

        .sign-header {
          position: relative;
          z-index: 3;
          text-align: center;
          font-weight: 700;
        }

        .club-course {
          font-size: 26px;
          line-height: 1.1;
        }

        .course-name {
          font-weight: 800;
        }

        .course-eagle {
          color: #8a6500;
        }

        .course-talon {
          color: #1f3a5f;
        }

        .event-name {
          margin-top: 2px;
          font-size: 18px;
          line-height: 1.1;
        }

        .watermark {
          position: absolute;
          inset: 72px 0 88px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 1;
        }

        .watermark-logo {
          width: 250px;
          max-height: 250px;
          object-fit: contain;
          opacity: 0.1;
          filter: grayscale(100%);
        }

        .player-area {
          position: absolute;
          z-index: 2;
          top: 110px;
          left: 45px;
          right: 45px;
          bottom: 95px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .player-name {
          text-align: center;
          font-size: 54px;
          line-height: 1.12;
          font-weight: 700;
          white-space: normal;
        }

        .sign-footer {
          position: absolute;
          z-index: 3;
          left: 58px;
          right: 58px;
          bottom: 54px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 27px;
          font-weight: 700;
        }

        .hole-block {
          text-align: left;
        }

        .date-time-block {
          min-width: 270px;
          text-align: right;
          line-height: 1.2;
        }

        .clean-design .player-name {
          font-family: Arial, sans-serif;
          font-size: 47px;
        }

        .clean-design .club-course,
        .clean-design .event-name,
        .clean-design .sign-footer {
          font-family: Arial, sans-serif;
        }

        .crop {
          position: absolute;
          width: 30px;
          height: 30px;
          pointer-events: none;
        }

        .crop-tl {
          top: -4px;
          left: -4px;
          border-top: 2px solid #000;
          border-left: 2px solid #000;
        }

        .crop-tr {
          top: -4px;
          right: -4px;
          border-top: 2px solid #000;
          border-right: 2px solid #000;
        }

        .crop-bl {
          bottom: -4px;
          left: -4px;
          border-bottom: 2px solid #000;
          border-left: 2px solid #000;
        }

        .crop-br {
          bottom: -4px;
          right: -4px;
          border-bottom: 2px solid #000;
          border-right: 2px solid #000;
        }

        .empty-state {
          width: 600px;
          margin: 80px auto;
          padding: 50px;
          background: white;
          border-radius: 8px;
          text-align: center;
          font-family: Arial, sans-serif;
        }

        @media print {
          @page {
            size: letter portrait;
            margin: 0.22in;
          }

          body {
            background: white;
          }

          .print-toolbar {
            display: none !important;
          }

          .print-page {
            padding: 0;
          }

          .placard-list {
            width: 100%;
          }

          .placard {
            width: 100%;
            height: 5in;
            margin: 0;
            padding: 0.05in;
            border-width: 2px;
          }

          .placard:nth-child(even) {
            page-break-after: always;
          }

          .placard:last-child {
            page-break-after: auto;
          }

          .inner-border {
            padding:
              0.12in
              0.38in
              0.18in;
          }

          .club-course {
            font-size: 23pt;
          }

          .event-name {
            font-size: 15pt;
          }

          .watermark-logo {
            width: 2.25in;
            max-height: 2.25in;
            opacity: 0.1;
          }

          .player-area {
            top: 1.05in;
            bottom: 0.9in;
          }

          .player-name {
            font-size: 39pt;
          }

          .sign-footer {
            left: 0.55in;
            right: 0.55in;
            bottom: 0.48in;
            font-size: 21pt;
          }
        }
      `}</style>
    </>
  );
}