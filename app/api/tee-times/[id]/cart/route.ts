import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

const pairFor = (position: number) =>
  position === 1 ? 2 : position === 2 ? 1 : position === 3 ? 4 : position === 4 ? 3 : null;
const norm = (value: string | null) => (value ?? "").trim().toUpperCase();
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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    if (!(await hasGolfOpsPermission("tee_sheet"))) return Response.json({ ok: false, error: "You do not have permission to update cart assignments." }, { status: 403 });
    const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
    if (!profile?.club_id) return Response.json({ ok: false, error: "Unable to determine your club." }, { status: 403 });

    const { id } = await context.params;
    const body = await request.json();
    const cartNumber = typeof body?.cart_number === "string" ? body.cart_number.trim() : "";
    const { data: selected, error: selectedError } = await supabase.from("tee_sheet_slots").select("id, sheet_date, tee_time, course, starting_hole, starting_position, slot_position, player_name, member_id, bag_number, cart_number").eq("id", id).eq("club_id", profile.club_id).single();
    if (selectedError || !selected) return Response.json({ ok: false, error: selectedError?.message || "Tee sheet slot not found." }, { status: 404 });

    const ids: Array<string | number> = [selected.id];
    const partnerPosition = pairFor(selected.slot_position);

    // Copy to the partner only for a brand-new assignment. Later edits and clears
    // affect only the field the user changed.
    if (partnerPosition !== null && !selected.cart_number && cartNumber) {
      const { data: candidates, error: candidateError } = await supabase.from("tee_sheet_slots").select("id, course, starting_hole, starting_position, slot_position, player_name, member_id, bag_number, cart_number").eq("club_id", profile.club_id).eq("sheet_date", selected.sheet_date).eq("tee_time", selected.tee_time);
      if (candidateError) return Response.json({ ok: false, error: candidateError.message }, { status: 500 });
      const partner = (candidates ?? []).find((slot) =>
        slot.slot_position === partnerPosition &&
        Boolean(slot.player_name?.trim()) &&
        !slot.cart_number &&
        norm(slot.course) === norm(selected.course) &&
        norm(slot.starting_position) === norm(selected.starting_position) &&
        slot.starting_hole === selected.starting_hole
      );
      if (partner) ids.push(partner.id);
    }

    const { data, error } = await supabase.from("tee_sheet_slots").update({ cart_number: cartNumber || null }).eq("club_id", profile.club_id).in("id", ids).select("id, sheet_date, player_name, member_id, bag_number, cart_number");
    if (error) return Response.json({ ok: false, error: error.message, details: error.details, code: error.code }, { status: 500 });

    const savedAt = new Date().toISOString();
    const preparedStateRows = (data ?? [])
      .flatMap((slot) => {
        const identityKey = operationalIdentityKey(slot);
        if (!identityKey) return [];

        return [{
          club_id: String(profile.club_id),
          sheet_date: slot.sheet_date,
          identity_key: identityKey,
          member_id:
            slot.member_id === null ? null : String(slot.member_id),
          bag_number: slot.bag_number,
          player_name: slot.player_name,
          cart_number: slot.cart_number,
          updated_at: savedAt,
        }];
      });

    const identityKeys = preparedStateRows.map(
      (row) => row.identity_key
    );

    let priorCheckInByIdentity = new Map<string, string>();

    if (identityKeys.length > 0) {
      const { data: priorState, error: priorStateError } = await supabase
        .from("tee_sheet_operational_state")
        .select("identity_key,check_in")
        .eq("club_id", String(profile.club_id))
        .eq("sheet_date", selected.sheet_date)
        .in("identity_key", identityKeys);

      if (priorStateError) {
        return Response.json(
          { ok: false, error: priorStateError.message },
          { status: 500 }
        );
      }

      priorCheckInByIdentity = new Map(
        (priorState ?? []).map((row) => [
          row.identity_key,
          row.check_in ?? "",
        ])
      );
    }

    const stateRows = preparedStateRows.map((row) => ({
      ...row,
      check_in:
        priorCheckInByIdentity.get(row.identity_key) ?? "",
    }));

    if (stateRows.length > 0) {
      const { error: stateError } = await supabase
        .from("tee_sheet_operational_state")
        .upsert(stateRows, {
          onConflict: "club_id,sheet_date,identity_key",
        });

      if (stateError) {
        console.error("Cart operational state error:", stateError);
        return Response.json(
          {
            ok: false,
            error:
              "The cart was assigned, but GolfOps could not protect it from the next ForeTees refresh.",
          },
          { status: 500 }
        );
      }
    }

    return Response.json({ ok: true, cart_number: cartNumber || null, updated_slot_ids: (data ?? []).map((slot) => slot.id) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update cart number." }, { status: 500 });
  }
}
