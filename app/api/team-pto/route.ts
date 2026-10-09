import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { reconcilePtoCalendars } from "@/lib/team-pto-sync";
import { resolvePtoDepartment } from "@/lib/team-pto";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

async function adminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id,role")
    .eq("id", user.id)
    .single();
  if (!profile?.club_id || profile.role !== "admin") return null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { clubId: profile.club_id as string, admin };
}

export async function POST(request: Request) {
  let context;
  try {
    context = await adminContext();
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Configuration error." }, { status: 500 });
  }
  if (!context) return Response.json({ ok: false, error: "Admin access is required." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { dateStart?: string; dateEnd?: string };
  if (!datePattern.test(body.dateStart ?? "") || !datePattern.test(body.dateEnd ?? "")) {
    return Response.json({ ok: false, error: "A valid calendar date range is required." }, { status: 400 });
  }
  const calendar = await reconcilePtoCalendars(
    context.admin,
    context.clubId,
    body.dateStart!,
    body.dateEnd!
  );
  return Response.json({ ok: true, calendar });
}

export async function PATCH(request: Request) {
  let context;
  try {
    context = await adminContext();
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Configuration error." }, { status: 500 });
  }
  if (!context) return Response.json({ ok: false, error: "Admin access is required." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    employeeId?: string;
    routingOverride?: "INSIDE" | "OUTSIDE" | null;
  };
  if (!body.employeeId || !["INSIDE", "OUTSIDE", null].includes(body.routingOverride ?? null)) {
    return Response.json({ ok: false, error: "The routing selection is invalid." }, { status: 400 });
  }
  const { data: employee, error: employeeError } = await context.admin
    .from("schedulepop_employees")
    .select("id,primary_duty")
    .eq("id", body.employeeId)
    .eq("club_id", context.clubId)
    .single();
  if (employeeError || !employee) {
    return Response.json({ ok: false, error: "Employee not found." }, { status: 404 });
  }
  const override = body.routingOverride ?? null;
  const { error } = await context.admin
    .from("schedulepop_employees")
    .update({
      routing_override: override,
      resolved_department: resolvePtoDepartment(employee.primary_duty ?? "", override),
      updated_at: new Date().toISOString(),
    })
    .eq("id", employee.id)
    .eq("club_id", context.clubId);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
