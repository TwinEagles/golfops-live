import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

export async function PUT(
  request: Request
) {
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

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

  if (!profile?.club_id) {
    return NextResponse.json(
      {
        error:
          "Club not found.",
      },
      {
        status: 400,
      }
    );
  }

  const body =
    await request.json();

  const days =
    Number(body.days);

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid detailing interval.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: current,
  } =
    await supabase
      .from(
        "club_operational_settings"
      )
      .select(
        "settings"
      )
      .eq(
        "club_id",
        profile.club_id
      )
      .maybeSingle();

  const currentSettings =
    current?.settings &&
    typeof current.settings ===
      "object"
      ? current.settings
      : {};

  const settings = {
    ...currentSettings,
    cartDetailingDays:
      days,
  };

  const { error } =
    await supabase
      .from(
        "club_operational_settings"
      )
      .upsert(
        {
          club_id:
            profile.club_id,
          settings,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "club_id",
        }
      );

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
    days,
  });
}
