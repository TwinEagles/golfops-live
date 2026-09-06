import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const ids =
      Array.isArray(body?.ids)
        ? body.ids.filter(Boolean)
        : [];

    if (ids.length === 0) {
      return NextResponse.json(
        {
          error: "At least one change ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
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
        "changes"
      );

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to clear changes.",
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
      .select("club_id, role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.club_id
    ) {
      return NextResponse.json(
        {
          error: "Unable to determine your club.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: matchingChanges,
      error: lookupError,
    } = await supabase
      .from("tee_sheet_changes")
      .select("id")
      .eq("club_id", profile.club_id)
      .in("id", ids);

    if (lookupError) {
      return NextResponse.json(
        {
          error: lookupError.message,
        },
        {
          status: 500,
        }
      );
    }

    const allowedIds =
      (matchingChanges ?? []).map(
        (change) => change.id
      );

    if (allowedIds.length === 0) {
      return NextResponse.json(
        {
          error: "No matching change records found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: updateError,
    } = await supabase
      .from("tee_sheet_changes")
      .update({
        status: "CLEARED",
        cleared_at:
          new Date().toISOString(),
        cleared_by: user.id,
      })
      .eq("club_id", profile.club_id)
      .in("id", allowedIds);

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      cleared: allowedIds.length,
    });
  } catch (error) {
    console.error(
      "Clear selected changes error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to clear selected changes.",
      },
      {
        status: 500,
      }
    );
  }
}
