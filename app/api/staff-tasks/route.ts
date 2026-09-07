import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGolfOpsAccess } from "@/lib/permissions";

const areas = new Set(["OUTSIDE_OPERATIONS","STARTER_PLAYER_ASSISTANT","RANGE","GOLF_SHOP","INSTRUCTION","GENERAL"]);
const dates = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const access = await getGolfOpsAccess();
  if (!access) return NextResponse.json({ ok:false, error:"You must be signed in." }, { status:401 });
  if (!access.isAdmin && !access.permissions.outside_operations) return NextResponse.json({ ok:false, error:"Staff Schedule access required." }, { status:403 });
  const body = await request.json().catch(() => null) as any;
  if (!body?.action) return NextResponse.json({ ok:false, error:"Invalid request." }, { status:400 });
  const db = await createClient();
  if (body.action === "add") {
    const title = String(body.title ?? "").trim().slice(0,200);
    const dueDate = String(body.dueDate ?? "");
    if (!title || !areas.has(body.area) || !dates.test(dueDate)) return NextResponse.json({ ok:false, error:"Title, area, and due date are required." }, { status:400 });
    const { data, error } = await db.from("staff_tasks").insert({ club_id:access.clubId, title, description:String(body.description ?? "").trim().slice(0,1000)||null, area:body.area, due_date:dueDate, created_by:access.userId }).select("*").single();
    if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
    return NextResponse.json({ ok:true, task:data });
  }
  if (body.action === "status") {
    if (!["OPEN","IN_PROGRESS","COMPLETED"].includes(body.status)) return NextResponse.json({ ok:false, error:"Invalid status." }, { status:400 });
    const patch = body.status === "COMPLETED" ? { status:body.status, completed_by:access.userId, completed_at:new Date().toISOString() } : { status:body.status, completed_by:null, completed_at:null };
    const { data, error } = await db.from("staff_tasks").update(patch).eq("id",body.id).eq("club_id",access.clubId).select("*").single();
    if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
    return NextResponse.json({ ok:true, task:data });
  }
  if (body.action === "delete") {
    if (!access.isAdmin) return NextResponse.json({ ok:false, error:"Admin access required." }, { status:403 });
    const { error } = await db.from("staff_tasks").delete().eq("id",body.id).eq("club_id",access.clubId);
    if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
    return NextResponse.json({ ok:true });
  }
  return NextResponse.json({ ok:false, error:"Unknown action." }, { status:400 });
}
