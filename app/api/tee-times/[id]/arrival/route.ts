import { NextResponse } from "next/server";
import { hasGolfOpsPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { teeSheetArrivalIdentityKey } from "@/lib/tee-sheet-arrival";

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
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasGolfOpsPermission("tee_sheet"))) {
      return NextResponse.json(
        { ok: false, error: "You do not have permission to update player arrivals." },
        { status: 403 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

    if (!profile?.club_id) {
      return NextResponse.json(
        { ok: false, error: "Unable to determine your club." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    if (typeof body?.arrived !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "Invalid arrival status." },
        { status: 400 }
      );
    }

    const { data: slot, error: slotError } = await supabase
      .from("tee_sheet_slots")
      .select("id,sheet_date,player_name,member_id,bag_number")
      .eq("id", id)
      .eq("club_id", profile.club_id)
      .maybeSingle();

    if (slotError || !slot?.player_name) {
      return NextResponse.json(
        { ok: false, error: slotError?.message ?? "Tee sheet player not found." },
        { status: slotError ? 500 : 404 }
      );
    }

    const identityKey = teeSheetArrivalIdentityKey(slot);
    if (!identityKey) {
      return NextResponse.json(
        { ok: false, error: "Unable to identify this player." },
        { status: 400 }
      );
    }

    if (body.arrived) {
      const { error } = await supabase
        .from("tee_sheet_player_arrivals")
        .upsert(
          {
            club_id: String(profile.club_id),
            sheet_date: slot.sheet_date,
            identity_key: identityKey,
            member_id: slot.member_id === null ? null : String(slot.member_id),
            bag_number: slot.bag_number,
            player_name: slot.player_name,
            arrived_at: new Date().toISOString(),
            arrived_by: user.id,
          },
          { onConflict: "club_id,sheet_date,identity_key" }
        );

      if (error) {
        console.error("Player arrival save error:", error);
        return NextResponse.json(
          { ok: false, error: "Unable to save the player arrival." },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase
        .from("tee_sheet_player_arrivals")
        .delete()
        .eq("club_id", String(profile.club_id))
        .eq("sheet_date", slot.sheet_date)
        .eq("identity_key", identityKey);

      if (error) {
        console.error("Player arrival clear error:", error);
        return NextResponse.json(
          { ok: false, error: "Unable to clear the player arrival." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, arrived: body.arrived });
  } catch (error) {
    console.error("Player arrival route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to update the player arrival.",
      },
      { status: 500 }
    );
  }
}
