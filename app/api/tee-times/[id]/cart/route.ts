import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

function pairedPosition(position: number) {
  if (position === 1) return 2;
  if (position === 2) return 1;
  if (position === 3) return 4;
  if (position === 4) return 3;

  return null;
}

function normalize(value: string | null) {
  return (value ?? "")
    .trim()
    .toUpperCase();
}

export async function PUT(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        {
          ok: false,
          error: "Not authenticated.",
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
      return Response.json(
        {
          ok: false,
          error:
            "You do not have permission to update cart assignments.",
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
      return Response.json(
        {
          ok: false,
          error:
            "Unable to determine your club.",
        },
        {
          status: 403,
        }
      );
    }

    const { id } =
      await context.params;

    const body =
      await request.json();

    const cartNumber =
      typeof body?.cart_number === "string"
        ? body.cart_number.trim()
        : "";

    /*
      Load the selected player so the API
      can identify the adjacent cart partner.
    */

    const {
      data: selectedSlot,
      error: selectedSlotError,
    } =
      await supabase
        .from("tee_sheet_slots")
        .select(`
          id,
          sheet_date,
          tee_time,
          course,
          starting_hole,
          starting_position,
          slot_position,
          player_name
        `)
        .eq("id", id)
        .eq(
          "club_id",
          profile.club_id
        )
        .single();

    if (
      selectedSlotError ||
      !selectedSlot
    ) {
      return Response.json(
        {
          ok: false,
          error:
            selectedSlotError?.message ||
            "Tee sheet slot not found.",
        },
        {
          status: 404,
        }
      );
    }

    const partnerPosition =
      pairedPosition(
        selectedSlot.slot_position
      );

    const slotIds: Array<
      string | number
    > = [selectedSlot.id];

    if (partnerPosition !== null) {
      /*
        Find possible slots from the same
        tee time. Filter course and starting
        position afterward so null values
        are handled correctly.
      */

      const {
        data: groupSlots,
        error: groupError,
      } =
        await supabase
          .from("tee_sheet_slots")
          .select(`
            id,
            course,
            starting_hole,
            starting_position,
            slot_position,
            player_name
          `)
          .eq(
            "club_id",
            profile.club_id
          )
          .eq(
            "sheet_date",
            selectedSlot.sheet_date
          )
          .eq(
            "tee_time",
            selectedSlot.tee_time
          );

      if (groupError) {
        return Response.json(
          {
            ok: false,
            error: groupError.message,
          },
          {
            status: 500,
          }
        );
      }

      const partner =
        (groupSlots ?? []).find(
          (slot) =>
            slot.slot_position ===
              partnerPosition &&
            Boolean(
              slot.player_name?.trim()
            ) &&
            normalize(slot.course) ===
              normalize(
                selectedSlot.course
              ) &&
            normalize(
              slot.starting_position
            ) ===
              normalize(
                selectedSlot.starting_position
              ) &&
            slot.starting_hole ===
              selectedSlot.starting_hole
        );

      if (partner) {
        slotIds.push(partner.id);
      }
    }

    const {
      data: updatedSlots,
      error: updateError,
    } =
      await supabase
        .from("tee_sheet_slots")
        .update({
          cart_number:
            cartNumber || null,
        })
        .eq(
          "club_id",
          profile.club_id
        )
        .in("id", slotIds)
        .select("id, cart_number");

    if (updateError) {
      console.error(
        "Cart number update error:",
        updateError
      );

      return Response.json(
        {
          ok: false,
          error: updateError.message,
          details: updateError.details,
          code: updateError.code,
        },
        {
          status: 500,
        }
      );
    }

    return Response.json({
      ok: true,
      cart_number:
        cartNumber || null,
      updated_slot_ids:
        (updatedSlots ?? []).map(
          (slot) => slot.id
        ),
    });
  } catch (error) {
    console.error(
      "Cart assignment route error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update cart number.",
      },
      {
        status: 500,
      }
    );
  }
}