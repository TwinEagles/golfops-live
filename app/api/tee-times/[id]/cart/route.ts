import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        {
          ok: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    const allowed =
      await hasGolfOpsPermission(
        "tee_sheet"
      );

    if (!allowed) {
      return Response.json(
        {
          ok: false,
          error:
            "You do not have permission to update cart assignments.",
        },
        { status: 403 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

    if (!profile?.club_id) {
      return Response.json(
        {
          ok: false,
          error:
            "Unable to determine your club.",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const cartNumber =
      typeof body?.cart_number === "string"
        ? body.cart_number.trim()
        : "";

    const { data, error } = await supabase
      .from("tee_sheet_slots")
      .update({
        cart_number: cartNumber || null,
      })
      .eq("id", id)
      .eq("club_id", profile.club_id)
      .select("id, cart_number")
      .single();

    if (error) {
      console.error("Cart number update error:", error);

      return Response.json(
        {
          ok: false,
          error: error.message,
          details: error.details,
          code: error.code,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return Response.json(
        {
          ok: false,
          error: "No tee sheet slot was updated.",
        },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      cart_number: data.cart_number,
    });
  } catch (error) {
    console.error("Cart assignment route error:", error);

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update cart number.",
      },
      { status: 500 }
    );
  }
}
