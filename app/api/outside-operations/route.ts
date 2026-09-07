import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGolfOpsAccess } from "@/lib/permissions";

type ActionBody =
  | { action: "complete"; itemId: string; workDate: string; operatorName: string }
  | { action: "uncomplete"; itemId: string; workDate: string }
  | { action: "add_handoff"; workDate: string; operatorName: string; category: string; note: string }
  | { action: "resolve_handoff"; handoffId: string; operatorName: string; resolved: boolean };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const categories = new Set(["GENERAL", "MEMBER", "BAG", "CART", "RANGE", "FACILITY"]);

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
