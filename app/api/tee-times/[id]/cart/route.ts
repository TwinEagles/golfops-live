import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

const pairFor = (position: number) =>
  position === 1 ? 2 : position === 2 ? 1 : position === 3 ? 4 : position === 4 ? 3 : null;
const norm = (value: string | null) => (value ?? "").trim().toUpperCase();

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
    const { data: selected, error: selectedError } = await supabase.from("tee_sheet_slots").select("id, sheet_date, tee_time, course, starting_hole, starting_position, slot_position, player_name, cart_number").eq("id", id).eq("club_id", profile.club_id).single();
    if (selectedError || !selected) return Response.json({ ok: false, error: selectedError?.message || "Tee sheet slot not found." }, { status: 404 });

    const ids: Array<string | number> = [selected.id];
    const partnerPosition = pairFor(selected.slot_position);

    // Copy to the partner only for a brand-new assignment. Later edits and clears
    // affect only the field the user changed.
    if (partnerPosition !== null && !selected.cart_number && cartNumber) {
      const { data: candidates, error: candidateError } = await supabase.from("tee_sheet_slots").select("id, course, starting_hole, starting_position, slot_position, player_name, cart_number").eq("club_id", profile.club_id).eq("sheet_date", selected.sheet_date).eq("tee_time", selected.tee_time);
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

    const { data, error } = await supabase.from("tee_sheet_slots").update({ cart_number: cartNumber || null }).eq("club_id", profile.club_id).in("id", ids).select("id, cart_number");
    if (error) return Response.json({ ok: false, error: error.message, details: error.details, code: error.code }, { status: 500 });
    return Response.json({ ok: true, cart_number: cartNumber || null, updated_slot_ids: (data ?? []).map((slot) => slot.id) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update cart number." }, { status: 500 });
  }
}
