import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

const allowedValues = new Set(["", "CHECKED", "MISSING"]);

const norm = (value: string | null) =>
  (value ?? "").trim().toUpperCase();

const normalizeName = (value: string | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function operationalIdentityKey(slot: {
  member_id: string | number | null;
  bag_number: string | null;
  player_name: string | null;
}) {
  if (slot.member_id !== null && slot.member_id !== undefined) {
    return `member:${String(slot.member_id)}`;
  }

  const bag = norm(slot.bag_number);
  if (bag) return `bag:${bag}`;

  const name = normalizeName(slot.player_name);
  return name ? `name:${name}` : null;
}

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
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!(await hasGolfOpsPermission("tee_sheet"))) {
      return NextResponse.json(
        {
          ok: false,
          error: "You do not have permission to update bag status.",
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
      return NextResponse.json(
        { ok: false, error: "Unable to determine your club." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const value =
      typeof body?.value === "string"
        ? body.value.trim().toUpperCase()
        : "";

    if (!allowedValues.has(value)) {
      return NextResponse.json(
        { ok: false, error: "Invalid bag status." },
        { status: 400 }
      );
    }

    const { data: slot, error } = await supabase
      .from("tee_sheet_slots")
      .update({ check_in: value })
      .eq("id", id)
      .eq("club_id", profile.club_id)
      .select(
        "id,sheet_date,player_name,member_id,bag_number,cart_number,check_in"
      )
      .maybeSingle();

    if (error || !slot) {
      console.error("Bag status update error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: error?.message ?? "Tee sheet slot not found.",
        },
        { status: error ? 500 : 404 }
      );
    }

    const identityKey = operationalIdentityKey(slot);

    if (identityKey) {
      const { data: priorState, error: priorStateError } = await supabase
        .from("tee_sheet_operational_state")
        .select("cart_number")
        .eq("club_id", String(profile.club_id))
        .eq("sheet_date", slot.sheet_date)
        .eq("identity_key", identityKey)
        .maybeSingle();

      if (priorStateError) {
        return NextResponse.json(
          { ok: false, error: priorStateError.message },
          { status: 500 }
        );
      }

      const { error: stateError } = await supabase
        .from("tee_sheet_operational_state")
        .upsert(
          {
            club_id: String(profile.club_id),
            sheet_date: slot.sheet_date,
            identity_key: identityKey,
            member_id:
              slot.member_id === null ? null : String(slot.member_id),
            bag_number: slot.bag_number,
            player_name: slot.player_name,
            cart_number:
              slot.cart_number ?? priorState?.cart_number ?? null,
            check_in: slot.check_in ?? "",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "club_id,sheet_date,identity_key" }
        );

      if (stateError) {
        console.error("Check-in operational state error:", stateError);
        return NextResponse.json(
          {
            ok: false,
            error:
              "The status was saved, but GolfOps could not protect it from the next ForeTees refresh.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      check_in: slot.check_in,
    });
  } catch (error) {
    console.error("Bag status route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update bag status.",
      },
      { status: 500 }
    );
  }
}
