import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

export async function POST(
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
      .select("club_id, role")
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

  const start =
    Number(body.start);

  const end =
    Number(body.end);

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end - start > 500
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid cart range.",
      },
      {
        status: 400,
      }
    );
  }

  const { data: existing } =
    await supabase
      .from("golf_carts")
      .select(
        "cart_number"
      )
      .eq(
        "club_id",
        profile.club_id
      );

  const existingNumbers =
    new Set(
      (existing ?? []).map(
        (cart) =>
          String(
            cart.cart_number
          )
      )
    );

  const rows = [];

  for (
    let number = start;
    number <= end;
    number++
  ) {
    const cartNumber =
      String(number);

    if (
      existingNumbers.has(
        cartNumber
      )
    ) {
      continue;
    }

    rows.push({
      club_id:
        profile.club_id,
      cart_number:
        cartNumber,
      status:
        "ACTIVE",
      notes: null,
    });
  }

  if (
    rows.length === 0
  ) {
    return NextResponse.json({
      added: 0,
    });
  }

  const { error } =
    await supabase
      .from("golf_carts")
      .insert(rows);

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
    added: rows.length,
  });
}
