import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

type AddPlayerBody = {
  type?: "MEMBER" | "GUEST";
  member_id?: string;
  player_name?: string;
  bag_number?: string;
};

export async function PUT(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const body =
      (await request.json()) as AddPlayerBody;

    const supabase =
      await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    } = await supabase
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

    /*
      Confirm the requested physical slot
      belongs to this club.
    */

    const {
      data: slot,
      error: slotError,
    } = await supabase
      .from("tee_sheet_slots")
      .select(`
        id,
        player_name
      `)
      .eq("id", id)
      .eq("club_id", profile.club_id)
      .maybeSingle();

    if (
      slotError ||
      !slot
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

    if (slot.player_name) {
      return NextResponse.json(
        {
          error:
            "This tee sheet position is already occupied.",
        },
        {
          status: 409,
        }
      );
    }

    /*
      ADD EXISTING MEMBER
    */

    if (
      body.type === "MEMBER"
    ) {
      if (!body.member_id) {
        return NextResponse.json(
          {
            error:
              "Member ID is required.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: member,
        error: memberError,
      } = await supabase
        .from("members")
        .select(`
          id,
          full_name,
          member_number,
          bag_number
        `)
        .eq(
          "id",
          body.member_id
        )
        .eq(
          "club_id",
          profile.club_id
        )
        .maybeSingle();

      if (
        memberError ||
        !member
      ) {
        return NextResponse.json(
          {
            error:
              "Member could not be found.",
          },
          {
            status: 404,
          }
        );
      }

      const {
        error: updateError,
      } = await supabase
        .from("tee_sheet_slots")
        .update({
          source: "MANUAL",

          raw_player_name:
            member.full_name,

          player_name:
            member.full_name,

          member_id:
            member.id,

          member_number:
            member.member_number,

          bag_number:
            member.bag_number,

          cw: "C",

          cart_number:
            null,

          check_in:
            "",

          notes:
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
          "Add member to tee sheet error:",
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
        player: {
          type: "MEMBER",
          name:
            member.full_name,
          bag_number:
            member.bag_number,
        },
      });
    }

    /*
      ADD GUEST
    */

    if (
      body.type === "GUEST"
    ) {
      const playerName =
        body.player_name?.trim();

      const bagNumber =
        body.bag_number?.trim() ||
        null;

      if (!playerName) {
        return NextResponse.json(
          {
            error:
              "Guest name is required.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        error: updateError,
      } = await supabase
        .from("tee_sheet_slots")
        .update({
          source: "MANUAL",

          raw_player_name:
            playerName,

          player_name:
            playerName,

          member_id:
            null,

          member_number:
            null,

          bag_number:
            bagNumber,

          cw: "C",

          cart_number:
            null,

          check_in:
            "",

          notes:
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
          "Add guest to tee sheet error:",
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
        player: {
          type: "GUEST",
          name:
            playerName,
          bag_number:
            bagNumber,
        },
      });
    }

    return NextResponse.json(
      {
        error:
          "Player type must be MEMBER or GUEST.",
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      "Add player route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to add player.",
      },
      {
        status: 500,
      }
    );
  }
}