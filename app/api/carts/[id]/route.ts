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
  const { id } =
    await context.params;

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

  const allowedStatuses =
    new Set([
      "ACTIVE",
      "DAMAGED",
      "OUT_OF_SERVICE",
      "RETIRED",
    ]);

  if (
    body.status &&
    !allowedStatuses.has(
      body.status
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid status.",
      },
      {
        status: 400,
      }
    );
  }

  const update: {
    status?: string;
    notes?: string | null;
  } = {};

  if (body.status) {
    update.status =
      body.status;
  }

  if (
    "notes" in body
  ) {
    update.notes =
      body.notes || null;
  }

  const { error } =
    await supabase
      .from("golf_carts")
      .update(update)
      .eq("id", id)
      .eq(
        "club_id",
        profile.club_id
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
  });
}
