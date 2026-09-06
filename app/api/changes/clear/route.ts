import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const id = body?.id;

    if (!id) {
      return NextResponse.json(
        {
          error: "Change ID is required.",
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
          error:
            "Unable to determine your club.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: existingChange,
      error: existingError,
    } = await supabase
      .from("tee_sheet_changes")
      .select("id, status")
      .eq("id", id)
      .eq(
        "club_id",
        profile.club_id
      )
      .maybeSingle();

    if (
      existingError ||
      !existingChange
    ) {
      console.error(
        "Change lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Change record not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      existingChange.status ===
      "CLEARED"
    ) {
      return NextResponse.json({
        ok: true,
        alreadyCleared: true,
      });
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
      .eq("id", id)
      .eq(
        "club_id",
        profile.club_id
      );

    if (updateError) {
      console.error(
        "Clear change update error:",
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
      id,
    });
  } catch (error) {
    console.error(
      "Clear change route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to clear change.",
      },
      {
        status: 500,
      }
    );
  }
}
