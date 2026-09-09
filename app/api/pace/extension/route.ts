import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

type IncomingVehicle = {
  vehicle_id?: unknown;
  cart_number?: unknown;
  pace_label?: unknown;

  course_id?: unknown;
  course_name?: unknown;

  hole_name?: unknown;
  hole_short_name?: unknown;
  hole_sequence?: unknown;

  current_pace?: unknown;
  pace_minutes?: unknown;

  start_time?: unknown;
  estimated_finish_at?: unknown;
  thru_holes?: unknown;

  is_online?: unknown;
  is_in_play?: unknown;
  is_available?: unknown;
  is_charging?: unknown;
  gps_valid?: unknown;
  needs_service?: unknown;

  position_at?: unknown;
};

type PaceAssignmentVehicle = {
  cart_number: string;
  pace_label: string | null;
  is_online: boolean;
  is_in_play: boolean;
};

type TeeSheetSlot = {
  id: number;
  import_id: number | null;
  sheet_date: string;
  tee_time: string;
  course: string | null;
  starting_hole: number | null;
  starting_position: string | null;
  slot_position: number;
  player_name: string | null;
  member_id: number | null;
  bag_number: string | null;
  cart_number: string | null;
};

function cleanText(
  value: unknown,
  maximumLength = 100
) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }

  const cleaned =
    String(value)
      .trim()
      .replace(/\s+/g, " ");

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(
    0,
    maximumLength
  );
}

function normalizeCartNumber(
  value: unknown
) {
  const cleaned =
    cleanText(value, 40)
      ?.replace(
        /^cart\s*/i,
        ""
      )
      .trim()
      .toUpperCase() ?? "";

  if (!cleaned) {
    return null;
  }

  /*
    Cart numbers may contain
    letters, such as 12AC.
  */

  if (
    !/^[A-Z0-9_-]+$/.test(
      cleaned
    )
  ) {
    return null;
  }

  return cleaned;
}

function cleanInteger(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  if (
    !Number.isFinite(
      numberValue
    )
  ) {
    return null;
  }

  return Math.trunc(
    numberValue
  );
}

function cleanBigInt(
  value: unknown
) {
  const cleaned =
    cleanInteger(value);

  if (
    cleaned === null ||
    !Number.isSafeInteger(
      cleaned
    )
  ) {
    return null;
  }

  return cleaned;
}

function cleanBoolean(
  value: unknown
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  if (
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return false;
  }

  return null;
}

function cleanTimestamp(
  value: unknown
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const timestamp =
    new Date(value);

  if (
    Number.isNaN(
      timestamp.getTime()
    )
  ) {
    return null;
  }

  return timestamp.toISOString();
}

function cleanJsonValue(
  value: unknown
) {
  if (
    value === undefined
  ) {
    return null;
  }

  try {
    const serialized =
      JSON.stringify(value);

    if (
      serialized.length >
      2000
    ) {
      return null;
    }

    return JSON.parse(
      serialized
    );
  } catch {
    return null;
  }
}

export async function POST(
  request: Request
) {
  try {
    /*
      Validate the GolfOps
      extension login.
    */

    const authHeader =
      request.headers.get(
        "authorization"
      );

    if (
      !authHeader?.startsWith(
        "Bearer "
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Missing authorization token.",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken =
      authHeader
        .replace(
          "Bearer ",
          ""
        )
        .trim();

    if (!accessToken) {
      return Response.json(
        {
          ok: false,
          error:
            "Missing authorization token.",
        },
        {
          status: 401,
        }
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const publishableKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !publishableKey ||
      !serviceRoleKey
    ) {
      console.error(
        "PACE import environment variables are missing."
      );

      return Response.json(
        {
          ok: false,
          error:
            "PACE integration is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const userSupabase =
      createClient(
        supabaseUrl,
        publishableKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },

          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data: {
        user,
      },
      error: authError,
    } =
      await userSupabase
        .auth
        .getUser(
          accessToken
        );

    if (
      authError ||
      !user
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid or expired GolfOps Live login.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: profile,
      error: profileError,
    } =
      await userSupabase
        .from("profiles")
        .select(
          "club_id, role"
        )
        .eq(
          "id",
          user.id
        )
        .single();

    if (
      profileError ||
      !profile?.club_id
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Unable to determine your club.",
        },
        {
          status: 403,
        }
      );
    }

    /*
      Admins have full access.
      Standard users need Tee
      Sheet permission.
    */

    if (
      profile.role !== "admin"
    ) {
      const {
        data: permission,
      } =
        await userSupabase
          .from(
            "user_permissions"
          )
          .select(
            "tee_sheet"
          )
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "club_id",
            profile.club_id
          )
          .maybeSingle();

      if (
        permission?.tee_sheet !==
        true
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "You do not have permission to update PACE status.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const body =
      await request.json();

    const incomingVehicles =
      Array.isArray(
        body?.vehicles
      )
        ? (
            body.vehicles as
              IncomingVehicle[]
          )
        : [];

    if (
      incomingVehicles.length <
        1 ||
      incomingVehicles.length >
        250
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "No valid PACE vehicle data was supplied.",
        },
        {
          status: 400,
        }
      );
    }

    const receivedAt =
      new Date()
        .toISOString();

    const paceLabelsByCart =
      new Map<string, string | null>();

    for (
      const vehicle of
        incomingVehicles
    ) {
      const cartNumber =
        normalizeCartNumber(
          vehicle.cart_number
        );

      if (cartNumber) {
        paceLabelsByCart.set(
          cartNumber,
          cleanText(
            vehicle.pace_label,
            100
          )
        );
      }
    }

    const sanitizedRows =
      incomingVehicles
        .map((vehicle) => {
          const cartNumber =
            normalizeCartNumber(
              vehicle.cart_number
            );

          if (!cartNumber) {
            return null;
          }

          return {
            club_id:
              profile.club_id,

            cart_number:
              cartNumber,

            pace_vehicle_id:
              cleanBigInt(
                vehicle.vehicle_id
              ),

            course_id:
              cleanBigInt(
                vehicle.course_id
              ),

            course_name:
              cleanText(
                vehicle.course_name,
                100
              ),

            hole_name:
              cleanText(
                vehicle.hole_name,
                100
              ),

            hole_short_name:
              cleanText(
                vehicle.hole_short_name,
                50
              ),

            hole_sequence:
              cleanInteger(
                vehicle.hole_sequence
              ),

            /*
              CurrentPace may be
              a number, string or
              object. We will confirm
              its exact shape when a
              cart is on the course.
            */

            current_pace:
              cleanJsonValue(
                vehicle.current_pace
              ),

            pace_minutes:
              cleanInteger(
                vehicle.pace_minutes
              ),

            start_time:
              cleanTimestamp(
                vehicle.start_time
              ),

            estimated_finish_at:
              cleanTimestamp(
                vehicle
                  .estimated_finish_at
              ),

            thru_holes:
              cleanInteger(
                vehicle.thru_holes
              ),

            is_online:
              cleanBoolean(
                vehicle.is_online
              ) ?? false,

            is_in_play:
              cleanBoolean(
                vehicle.is_in_play
              ) ?? false,

            is_available:
              cleanBoolean(
                vehicle.is_available
              ),

            is_charging:
              cleanBoolean(
                vehicle.is_charging
              ),

            gps_valid:
              cleanBoolean(
                vehicle.gps_valid
              ),

            needs_service:
              cleanBoolean(
                vehicle.needs_service
              ),

            position_at:
              cleanTimestamp(
                vehicle.position_at
              ),

            last_seen_at:
              receivedAt,

            updated_at:
              receivedAt,
          };
        })
        .filter(
          (
            row
          ): row is NonNullable<
            typeof row
          > => row !== null
        );

    /*
      Remove duplicate cart
      numbers from a single
      incoming batch.
    */

    const uniqueRows =
      Array.from(
        new Map(
          sanitizedRows.map(
            (row) => [
              row.cart_number,
              row,
            ]
          )
        ).values()
      );

    if (
      uniqueRows.length === 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "PACE did not supply any valid cart numbers.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Service-role access is
      used only after the user
      and permission checks.
    */

    const adminSupabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      error: upsertError,
    } =
      await adminSupabase
        .from(
          "pace_cart_status"
        )
        .upsert(
          uniqueRows,
          {
            onConflict:
              "club_id,cart_number",
          }
        );

    if (upsertError) {
      console.error(
        "PACE status upsert error:",
        upsertError
      );

      return Response.json(
        {
          ok: false,
          error:
            upsertError.message,
        },
        {
          status: 500,
        }
      );
    }

    let cartReconciliation = {
      assigned_groups: 0,
      assigned_players: 0,
      ambiguous: 0,
      conflicts: 0,
    };

    try {
      cartReconciliation =
        await reconcilePaceCartAssignments(
          adminSupabase,
          profile.club_id,
          uniqueRows.map(
            (row) => ({
              cart_number:
                row.cart_number,
              pace_label:
                paceLabelsByCart.get(
                  row.cart_number
                ) ?? null,
              is_online:
                row.is_online,
              is_in_play:
                row.is_in_play,
            })
          )
        );
    } catch (reconcileError) {
      /*
        Cart reconciliation is
        supplemental. A matching
        problem must not interrupt
        the live PACE status feed.
      */

      console.error(
        "PACE cart reconciliation error:",
        reconcileError
      );
    }

    return Response.json({
      ok: true,
      received:
        incomingVehicles.length,
      updated:
        uniqueRows.length,
      cart_reconciliation:
        cartReconciliation,
      received_at:
        receivedAt,
    });
  } catch (error) {
    console.error(
      "PACE extension route error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to import PACE status.",
      },
      {
        status: 500,
      }
    );
  }
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

  const value =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    );

  return `${value.year}-${value.month}-${value.day}`;
}

function normalizedWords(
  value: string | null
) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const ignoredPaceLabelWords =
  new Set([
    "cart",
    "golfer",
    "guest",
    "member",
    "player",
    "eagle",
    "talon",
    "course",
    "the",
  ]);

function paceLabelWords(
  label: string | null,
  cartNumber: string
) {
  const normalizedCart =
    cartNumber.toLowerCase();

  return normalizedWords(label)
    .filter(
      (word) =>
        word !== normalizedCart &&
        !/^\d+$/.test(word) &&
        word.length >= 3 &&
        !ignoredPaceLabelWords.has(
          word
        )
    );
}

function normalizedField(
  value: string | null
) {
  return (value ?? "")
    .trim()
    .toUpperCase();
}

function pairNumber(
  position: number
) {
  if (
    position === 1 ||
    position === 2
  ) {
    return 1;
  }

  if (
    position === 3 ||
    position === 4
  ) {
    return 2;
  }

  return position;
}

function sameGroup(
  left: TeeSheetSlot,
  right: TeeSheetSlot
) {
  return (
    left.tee_time ===
      right.tee_time &&
    normalizedField(left.course) ===
      normalizedField(
        right.course
      ) &&
    left.starting_hole ===
      right.starting_hole &&
    normalizedField(
      left.starting_position
    ) ===
      normalizedField(
        right.starting_position
      )
  );
}

async function reconcilePaceCartAssignments(
  supabase: SupabaseClient,
  clubId: string | number,
  vehicles: PaceAssignmentVehicle[]
) {
  const result = {
    assigned_groups: 0,
    assigned_players: 0,
    ambiguous: 0,
    conflicts: 0,
  };

  const activeVehicles =
    vehicles.filter(
      (vehicle) =>
        vehicle.is_online &&
        vehicle.is_in_play &&
        paceLabelWords(
          vehicle.pace_label,
          vehicle.cart_number
        ).length > 0
    );

  if (
    activeVehicles.length === 0
  ) {
    return result;
  }

  const today =
    easternDateString();

  const {
    data: slotData,
    error: slotError,
  } = await supabase
    .from("tee_sheet_slots")
    .select(`
      id,
      import_id,
      sheet_date,
      tee_time,
      course,
      starting_hole,
      starting_position,
      slot_position,
      player_name,
      member_id,
      bag_number,
      cart_number
    `)
    .eq("club_id", clubId)
    .eq("sheet_date", today)
    .not("player_name", "is", null);

  if (slotError) {
    throw slotError;
  }

  const slots =
    (slotData ?? []) as
      TeeSheetSlot[];

  if (slots.length === 0) {
    return result;
  }

  const changeRows:
    Record<string, unknown>[] = [];

  for (
    const vehicle of
      activeVehicles
  ) {
    const labelWords =
      paceLabelWords(
        vehicle.pace_label,
        vehicle.cart_number
      );

    const matchingSlots =
      slots.filter((slot) => {
        const playerWords =
          new Set(
            normalizedWords(
              slot.player_name
            )
          );

        return labelWords.some(
          (word) =>
            playerWords.has(word)
        );
      });

    const pairCandidates =
      new Map<
        string,
        TeeSheetSlot
      >();

    for (
      const slot of
        matchingSlots
    ) {
      const key = [
        slot.tee_time,
        normalizedField(
          slot.course
        ),
        slot.starting_hole ?? "",
        normalizedField(
          slot.starting_position
        ),
        pairNumber(
          slot.slot_position
        ),
      ].join("|");

      pairCandidates.set(
        key,
        slot
      );
    }

    if (
      pairCandidates.size !== 1
    ) {
      if (
        pairCandidates.size > 1
      ) {
        result.ambiguous += 1;
      }

      continue;
    }

    const matchedSlot =
      Array.from(
        pairCandidates.values()
      )[0];

    const matchedPair =
      pairNumber(
        matchedSlot.slot_position
      );

    const pairSlots =
      slots.filter(
        (slot) =>
          sameGroup(
            slot,
            matchedSlot
          ) &&
          pairNumber(
            slot.slot_position
          ) === matchedPair &&
          Boolean(
            slot.player_name
              ?.trim()
          )
      );

    const existingNumbers =
      pairSlots
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
        );

    if (
      existingNumbers.some(
        (value) =>
          value !==
            vehicle.cart_number
      )
    ) {
      result.conflicts += 1;
      continue;
    }

    const blankSlots =
      pairSlots.filter(
        (slot) =>
          !normalizeCartNumber(
            slot.cart_number
          )
      );

    if (
      blankSlots.length === 0
    ) {
      continue;
    }

    const {
      error: updateError,
    } = await supabase
      .from("tee_sheet_slots")
      .update({
        cart_number:
          vehicle.cart_number,
      })
      .eq("club_id", clubId)
      .in(
        "id",
        blankSlots.map(
          (slot) => slot.id
        )
      );

    if (updateError) {
      throw updateError;
    }

    for (
      const slot of blankSlots
    ) {
      slot.cart_number =
        vehicle.cart_number;
    }

    const playerNames =
      blankSlots
        .map(
          (slot) =>
            slot.player_name
              ?.trim()
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        );

    changeRows.push({
      club_id: clubId,
      import_id:
        matchedSlot.import_id,
      sheet_date: today,
      change_type:
        "CART_ASSIGNED",
      member_id:
        matchedSlot.member_id,
      player_name:
        playerNames.join(" / ") ||
        matchedSlot.player_name,
      bag_number:
        matchedSlot.bag_number,
      cart_number:
        vehicle.cart_number,
      tee_time:
        matchedSlot.tee_time,
      starting_hole:
        matchedSlot.starting_hole,
      detail:
        `PACE assigned Cart ${vehicle.cart_number} to ${playerNames.join(" and ")}.`,
      old_value: {
        cart_number: null,
      },
      new_value: {
        cart_number:
          vehicle.cart_number,
        pace_label:
          vehicle.pace_label,
      },
      status: "OPEN",
    });

    result.assigned_groups += 1;
    result.assigned_players +=
      blankSlots.length;
  }

  if (changeRows.length > 0) {
    const {
      error: changeError,
    } = await supabase
      .from("tee_sheet_changes")
      .insert(changeRows);

    if (changeError) {
      throw changeError;
    }
  }

  return result;
}
