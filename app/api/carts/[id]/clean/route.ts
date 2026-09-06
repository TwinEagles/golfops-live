import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

export async function POST(
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

  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select(
        "club_id, display_name"
      )
      .eq("id", user.id)
      .single();

  if (!profile?.club_id) {
    return NextResponse.json(
      {
        error:
          "Club not found.",
      },
      {
        status: 403,
      }
    );
  }

  /*
    Confirm the cart belongs to the
    authenticated user's club before
    recording its cleaning history.
  */

  const {
    data: cart,
    error: cartError,
  } =
    await supabase
      .from("golf_carts")
      .select("id")
      .eq("id", id)
      .eq(
        "club_id",
        profile.club_id
      )
      .maybeSingle();

  if (
    cartError ||
    !cart
  ) {
    return NextResponse.json(
      {
        error:
          "Cart not found.",
      },
      {
        status: 404,
      }
    );
  }

  const body =
    await request.json();

  const cleanedBy =
    String(
      body.cleanedBy ??
        profile.display_name ??
        ""
    ).trim();

  const notes =
    String(
      body.notes ??
        ""
    ).trim();

  const {
    error,
  } =
    await supabase
      .from(
        "cart_cleaning_history"
      )
      .insert({
        club_id:
          profile.club_id,

        cart_id:
          cart.id,

        cleaned_by:
          cleanedBy ||
          null,

        notes:
          notes || null,

        cleaned_at:
          new Date().toISOString(),
      });

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