import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
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
          error:
            "You do not have permission to edit the tee sheet.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

    if (
      profileError ||
      !profile?.club_id
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to determine your club.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: existingSlot,
      error: existingError,
    } =
      await supabase
        .from(
          "tee_sheet_slots"
        )
        .select(`
          id,
          club_id,
          player_name,
          member_id,
          member_number,
          bag_number,
          cart_number,
          check_in,
          notes,
          highlight,
          event_color,
          played_today
        `)
        .eq("id", id)
        .eq(
          "club_id",
          profile.club_id
        )
        .maybeSingle();

    if (
      existingError ||
      !existingSlot
    ) {
      return NextResponse.json(
        {
          error:
            "Tee sheet slot not found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: updateError,
    } =
      await supabase
        .from(
          "tee_sheet_slots"
        )
        .update({
          source:
            "MANUAL",

          raw_player_name:
            null,

          player_name:
            null,

          member_id:
            null,

          member_number:
            null,

          bag_number:
            null,

          cw:
            null,

          cart_number:
            null,

          check_in:
            "",

          notes:
            null,

          highlight:
            null,

          event_color:
            null,

          played_today:
            false,
        })
        .eq("id", id)
        .eq(
          "club_id",
          profile.club_id
        );

    if (updateError) {
      console.error(
        "Remove player error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Remove player route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove player.",
      },
      {
        status: 500,
      }
    );
  }
}
