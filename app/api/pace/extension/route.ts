import {
  createClient,
} from "@supabase/supabase-js";

type IncomingVehicle = {
  vehicle_id?: unknown;
  cart_number?: unknown;

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

    return Response.json({
      ok: true,
      received:
        incomingVehicles.length,
      updated:
        uniqueRows.length,
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