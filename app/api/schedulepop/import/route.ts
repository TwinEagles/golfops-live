import { NextResponse } from "next/server";
import { getGolfOpsAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

type ShiftInput = {
  employeeName?: string; jobTitle?: string; shiftDate?: string; startTime?: string | null;
  endTime?: string | null; duty?: string | null; zone?: string | null; status?: string; notes?: string | null;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const statuses = new Set(["SCHEDULED", "OFF", "TIME_OFF", "UNAVAILABLE"]);
const safeText = (value: unknown, max = 250) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const access = await getGolfOpsAccess();
  if (!access) return NextResponse.json({ ok: false, error: "You must be signed in." }, { status: 401 });
  if (!access.isAdmin) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });

  let body: { fileName?: string; dateStart?: string; dateEnd?: string; shifts?: ShiftInput[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }

  if (!datePattern.test(body.dateStart ?? "") || !datePattern.test(body.dateEnd ?? "") || !Array.isArray(body.shifts) || body.shifts.length === 0 || body.shifts.length > 5000) {
    return NextResponse.json({ ok: false, error: "The SchedulePop report did not contain a valid date range and staffing data." }, { status: 400 });
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
    notes: safeText(shift.notes, 1000) || null,
  })).filter((row) => row.employee_name && row.job_title && datePattern.test(row.shift_date) && row.shift_date >= body.dateStart! && row.shift_date <= body.dateEnd!);

  if (!rows.length) return NextResponse.json({ ok: false, error: "No valid staffing rows were found." }, { status: 400 });

  const supabase = await createClient();
  const { data: importRow, error: importError } = await supabase.from("schedulepop_imports").insert({
    club_id: access.clubId, file_name: safeText(body.fileName, 300) || "SchedulePop schedule.html",
    date_start: body.dateStart, date_end: body.dateEnd, rows_imported: rows.length, imported_by: access.userId,
  }).select("id").single();
  if (importError || !importRow) return NextResponse.json({ ok: false, error: importError?.message || "Unable to create the import." }, { status: 500 });

  const { error: shiftsError } = await supabase.from("schedulepop_shifts").insert(rows.map((row) => ({ ...row, club_id: access.clubId, import_id: importRow.id })));
  if (shiftsError) {
    await supabase.from("schedulepop_imports").delete().eq("id", importRow.id);
    return NextResponse.json({ ok: false, error: shiftsError.message }, { status: 500 });
  }

  const { error: cleanupError } = await supabase.from("schedulepop_shifts").delete().eq("club_id", access.clubId).gte("shift_date", body.dateStart).lte("shift_date", body.dateEnd).neq("import_id", importRow.id);
  if (cleanupError) console.error("SchedulePop old-shift cleanup error:", cleanupError);

  return NextResponse.json({ ok: true, rowsImported: rows.length });
}
