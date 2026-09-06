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
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "club_id, display_name"
        )
        .eq("id", user.id)
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

    const description =
      String(
        body.description ?? ""
      ).trim();

    if (!description) {
      return NextResponse.json(
        {
          error:
            "Damage description is required.",
        },
        {
          status: 400,
        }
      );
    }

    const reportedBy =
      String(
        body.reportedBy ??
          profile.display_name ??
          ""
      ).trim();

    const {
      data: cart,
      error: cartError,
    } =
      await supabase
        .from("golf_carts")
        .select(
          "id, cart_number"
        )
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

    const {
      error: damageError,
    } =
      await supabase
        .from("cart_damage")
        .insert({
          club_id:
            profile.club_id,

          cart_id:
            cart.id,

          description,

          reported_by:
            reportedBy || null,

          reported_at:
            new Date().toISOString(),
        });

    if (damageError) {
      console.error(
        "Cart damage insert error:",
        damageError
      );

      return NextResponse.json(
        {
          error:
            damageError.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
      Damage is tracked separately in
      cart_damage. Reporting damage does
      not automatically change the cart's
      operating status.
    */

    return NextResponse.json({
      success: true,
      cartId: cart.id,
    });
  } catch (error) {
    console.error(
      "Unexpected damage route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error saving damage report.",
      },
      {
        status: 500,
      }
    );
  }
}