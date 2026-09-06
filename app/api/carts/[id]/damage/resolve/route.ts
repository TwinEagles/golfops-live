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
    const { id } =
      await context.params;

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const allowed =
      await hasGolfOpsPermission(
        "golf_carts"
      );

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "You do not have access to Golf Carts.",
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
        .select(
          "club_id, display_name"
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
      return NextResponse.json(
        {
          error:
            profileError?.message ??
            "Club profile not found.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const reportedAt =
      String(
        body.reportedAt ??
          ""
      ).trim();

    if (!reportedAt) {
      return NextResponse.json(
        {
          error:
            "Damage record timestamp is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const resolvedBy =
      String(
        body.resolvedBy ??
          profile.display_name ??
          ""
      ).trim();

    const resolutionNotes =
      String(
        body.resolutionNotes ??
          ""
      ).trim();

    const {
      data: damage,
      error: lookupError,
    } =
      await supabase
        .from("cart_damage")
        .select(
          "id, cart_id, reported_at, resolved_at"
        )
        .eq(
          "club_id",
          profile.club_id
        )
        .eq(
          "cart_id",
          id
        )
        .eq(
          "reported_at",
          reportedAt
        )
        .is(
          "resolved_at",
          null
        )
        .maybeSingle();

    if (
      lookupError ||
      !damage
    ) {
      return NextResponse.json(
        {
          error:
            lookupError?.message ??
            "Open damage record not found.",
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
        .from("cart_damage")
        .update({
          resolved_at:
            new Date().toISOString(),

          resolved_by:
            resolvedBy ||
            null,

          resolution_notes:
            resolutionNotes ||
            null,
        })
        .eq(
          "id",
          damage.id
        )
        .eq(
          "club_id",
          profile.club_id
        );

    if (updateError) {
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
      success: true,
    });
  } catch (error) {
    console.error(
      "Damage resolution error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to resolve damage report.",
      },
      {
        status: 500,
      }
    );
  }
}