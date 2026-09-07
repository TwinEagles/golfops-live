import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGolfOpsAccess } from "@/lib/permissions";

type ActionBody =
  | { action: "complete"; itemId: string; workDate: string; operatorName: string }
  | { action: "uncomplete"; itemId: string; workDate: string }
  | { action: "add_handoff"; workDate: string; operatorName: string; category: string; note: string }
  | { action: "resolve_handoff"; handoffId: string; operatorName: string; resolved: boolean }
  | { action: "add_item"; shift: string; itemText: string }
  | { action: "rename_item"; itemId: string; itemText: string }
  | { action: "set_item_active"; itemId: string; active: boolean }
  | { action: "reorder_items"; shift: string; orderedIds: string[] };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const categories = new Set(["GENERAL", "MEMBER", "BAG", "CART", "RANGE", "FACILITY"]);
const shifts = new Set(["OPENING", "MIDDAY", "CLOSING"]);

export async function POST(request: Request) {
  const access = await getGolfOpsAccess();
  if (!access) return NextResponse.json({ ok: false, error: "You must be signed in." }, { status: 401 });
  if (!access.isAdmin && !access.permissions.outside_operations) {
    return NextResponse.json({ ok: false, error: "Outside Operations access required." }, { status: 403 });
  }

  let body: ActionBody;
  try { body = (await request.json()) as ActionBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }

  const supabase = await createClient();

  if (body.action === "add_item") {
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
    const itemText = body.itemText?.trim();
    if (!itemText || !shifts.has(body.shift)) return NextResponse.json({ ok: false, error: "Shift and duty are required." }, { status: 400 });
    const { data: lastItem } = await supabase.from("outside_ops_checklist_items").select("item_order").eq("club_id", access.clubId).eq("shift", body.shift).order("item_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase.from("outside_ops_checklist_items").insert({ club_id: access.clubId, shift: body.shift, item_text: itemText, item_order: (lastItem?.item_order ?? 0) + 10, active: true }).select("id, shift, item_order, item_text, active").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, item: data });
  }

  if (body.action === "rename_item") {
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
    const itemText = body.itemText?.trim();
    if (!body.itemId || !itemText) return NextResponse.json({ ok: false, error: "Duty is required." }, { status: 400 });
    const { data, error } = await supabase.from("outside_ops_checklist_items").update({ item_text: itemText }).eq("id", body.itemId).eq("club_id", access.clubId).select("id, shift, item_order, item_text, active").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, item: data });
  }

  if (body.action === "set_item_active") {
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
    const { data, error } = await supabase.from("outside_ops_checklist_items").update({ active: body.active }).eq("id", body.itemId).eq("club_id", access.clubId).select("id, shift, item_order, item_text, active").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, item: data });
  }

  if (body.action === "reorder_items") {
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
    if (!shifts.has(body.shift) || !Array.isArray(body.orderedIds)) return NextResponse.json({ ok: false, error: "Invalid duty order." }, { status: 400 });
    for (let index = 0; index < body.orderedIds.length; index += 1) {
      const { error } = await supabase.from("outside_ops_checklist_items").update({ item_order: (index + 1) * 10 }).eq("id", body.orderedIds[index]).eq("club_id", access.clubId).eq("shift", body.shift);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "complete") {
    const operatorName = body.operatorName?.trim();
    if (!operatorName || !datePattern.test(body.workDate) || !body.itemId) {
      return NextResponse.json({ ok: false, error: "Name, date, and checklist item are required." }, { status: 400 });
    }
    const { data: item } = await supabase.from("outside_ops_checklist_items").select("id").eq("id", body.itemId).eq("club_id", access.clubId).eq("active", true).maybeSingle();
    if (!item) return NextResponse.json({ ok: false, error: "Checklist item not found." }, { status: 404 });
    const { data, error } = await supabase.from("outside_ops_checklist_completions").upsert({
      club_id: access.clubId, item_id: body.itemId, work_date: body.workDate,
      operator_name: operatorName, completed_by: access.userId, completed_at: new Date().toISOString(),
    }, { onConflict: "club_id,item_id,work_date" }).select("id, item_id, operator_name, completed_at").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, completion: data });
  }

  if (body.action === "uncomplete") {
    if (!datePattern.test(body.workDate) || !body.itemId) return NextResponse.json({ ok: false, error: "Date and checklist item are required." }, { status: 400 });
    const { error } = await supabase.from("outside_ops_checklist_completions").delete().eq("club_id", access.clubId).eq("item_id", body.itemId).eq("work_date", body.workDate);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "add_handoff") {
    const operatorName = body.operatorName?.trim();
    const note = body.note?.trim();
    if (!operatorName || !note || !datePattern.test(body.workDate) || !categories.has(body.category)) {
      return NextResponse.json({ ok: false, error: "Name, category, date, and note are required." }, { status: 400 });
    }
    const { data, error } = await supabase.from("outside_ops_handoffs").insert({
      club_id: access.clubId, work_date: body.workDate, category: body.category, note,
      created_by: access.userId, created_by_name: operatorName,
    }).select("id, category, note, status, created_by_name, created_at, resolved_by_name, resolved_at").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, handoff: data });
  }

  if (body.action === "resolve_handoff") {
    const operatorName = body.operatorName?.trim();
    if (!operatorName || !body.handoffId) return NextResponse.json({ ok: false, error: "Name and handoff item are required." }, { status: 400 });
    const patch = body.resolved
      ? { status: "RESOLVED", resolved_by: access.userId, resolved_by_name: operatorName, resolved_at: new Date().toISOString() }
      : { status: "OPEN", resolved_by: null, resolved_by_name: null, resolved_at: null };
    const { data, error } = await supabase.from("outside_ops_handoffs").update(patch).eq("id", body.handoffId).eq("club_id", access.clubId).select("id, category, note, status, created_by_name, created_at, resolved_by_name, resolved_at").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, handoff: data });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
