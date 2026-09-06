import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

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
            "You do not have permission to update check-in status.",
        },
        {
          status: 403,
        }
      );
    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("club_id, role")
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
      body?.value === "X"
        ? "X"
        : "";

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
        .select(
          "id, check_in"
        )
        .single();

    if (error) {
      console.error(
        "Check-in update error:",
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
      check_in:
        slot.check_in,
    });
  } catch (error) {
    console.error(
      "Check-in route error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update check-in status.",
      },
      {
        status: 500,
      }
    );
  }
}
