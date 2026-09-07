import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

const allowedValues = new Set([
  "",
  "CHECKED",
  "MISSING",
]);

export async function PUT(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const allowed =
      await hasGolfOpsPermission(
        "tee_sheet"
      );

    if (!allowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You do not have permission to update bag status.",
        },
        {
          status: 403,
        }
      );
    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

    if (!profile?.club_id) {
      return NextResponse.json(
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

    const { id } =
      await context.params;

    const body =
      await request.json();

    const value =
      typeof body?.value === "string"
        ? body.value
            .trim()
            .toUpperCase()
        : "";

    if (!allowedValues.has(value)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid bag status.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: slot,
      error,
    } =
      await supabase
        .from("tee_sheet_slots")
        .update({
          check_in: value,
        })
        .eq("id", id)
        .eq(
          "club_id",
          profile.club_id
        )
        .select("id, check_in")
        .single();

    if (error) {
      console.error(
        "Bag status update error:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      check_in: slot.check_in,
    });
  } catch (error) {
    console.error(
      "Bag status route error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update bag status.",
      },
      {
        status: 500,
      }
    );
  }
}