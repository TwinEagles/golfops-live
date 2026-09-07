import { createClient } from "@supabase/supabase-js";

type ShiftInput = {
  employeeName?: string;
  jobTitle?: string;
  shiftDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  duty?: string | null;
  zone?: string | null;
  status?: string;
  notes?: string | null;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const statuses = new Set(["SCHEDULED", "OFF", "TIME_OFF", "UNAVAILABLE"]);
const safeText = (value: unknown, max = 250) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ ok: false, error: "Missing authorization token." }, { status: 401 });
  }

  const accessToken = authHeader.slice(7).trim();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return Response.json({ ok: false, error: "Invalid or expired GolfOps Live login." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.club_id) {
    return Response.json({ ok: false, error: "Unable to determine your club." }, { status: 403 });
  }
  if (profile.role !== "admin") {
    return Response.json({ ok: false, error: "Admin access is required to import SchedulePop staffing." }, { status: 403 });
  }

  let body: { fileName?: string; dateStart?: string; dateEnd?: string; shifts?: ShiftInput[] };
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: "Invalid request." }, { status: 400 }); }

  if (
    !datePattern.test(body.dateStart ?? "") ||
    !datePattern.test(body.dateEnd ?? "") ||
    !Array.isArray(body.shifts) ||
    body.shifts.length === 0 ||
    body.shifts.length > 5000
  ) {
    return Response.json({ ok: false, error: "The SchedulePop report did not contain a valid date range and staffing data." }, { status: 400 });
  }

  const rows = body.shifts.map((shift) => ({
    employee_name: safeText(shift.employeeName),
    job_title: safeText(shift.jobTitle),
    shift_date: safeText(shift.shiftDate, 10),
    start_time: safeText(shift.startTime, 20) || null,
    end_time: safeText(shift.endTime, 20) || null,
    duty: safeText(shift.duty) || null,
    zone: safeText(shift.zone) || null,
    status: statuses.has(shift.status ?? "") ? shift.status : "SCHEDULED",
    notes: safeText(shift.notes, 1000) || null
  })).filter((row) =>
    row.employee_name &&
    row.job_title &&
    datePattern.test(row.shift_date) &&
    row.shift_date >= body.dateStart! &&
    row.shift_date <= body.dateEnd!
  );
  if (!rows.length) {
    return Response.json({ ok: false, error: "No valid staffing rows were found." }, { status: 400 });
  }

  const { data: importRow, error: importError } = await supabase
    .from("schedulepop_imports")
    .insert({
      club_id: profile.club_id,
      file_name: safeText(body.fileName, 300) || "SchedulePop extension import",
      date_start: body.dateStart,
      date_end: body.dateEnd,
      rows_imported: rows.length,
      imported_by: user.id
    })
    .select("id")
    .single();
  if (importError || !importRow) {
    return Response.json({ ok: false, error: importError?.message || "Unable to create the import." }, { status: 500 });
  }

  const { error: shiftsError } = await supabase.from("schedulepop_shifts").insert(
    rows.map((row) => ({ ...row, club_id: profile.club_id, import_id: importRow.id }))
  );
  if (shiftsError) {
    await supabase.from("schedulepop_imports").delete().eq("id", importRow.id);
    return Response.json({ ok: false, error: shiftsError.message }, { status: 500 });
  }

  const { error: cleanupError } = await supabase
    .from("schedulepop_shifts")
    .delete()
    .eq("club_id", profile.club_id)
    .gte("shift_date", body.dateStart)
    .lte("shift_date", body.dateEnd)
    .neq("import_id", importRow.id);
  if (cleanupError) console.error("SchedulePop old-shift cleanup error:", cleanupError);

  return Response.json({ ok: true, rowsImported: rows.length });
}
