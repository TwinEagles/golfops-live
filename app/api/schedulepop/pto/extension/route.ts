import { createClient } from "@supabase/supabase-js";
import { reconcilePtoCalendars } from "@/lib/team-pto-sync";
import {
  cleanText,
  localDate,
  primaryDuty,
  resolvePtoDepartment,
  type SchedulePopEmployeeInput,
  type SchedulePopPtoInput,
} from "@/lib/team-pto";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

type PtoPayload = {
  sourceMode?: "full" | "delta";
  action?: "upsert" | "delete";
  locationId?: number;
  dateStart?: string;
  dateEnd?: string;
  complete?: boolean;
  employees?: SchedulePopEmployeeInput[];
  requests?: SchedulePopPtoInput[];
};

function validTimestamp(value: unknown) {
  return typeof value === "string" && timestampPattern.test(value);
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ ok: false, error: "Missing authorization token." }, { status: 401 });
  }

  const accessToken = authHeader.slice(7).trim();
  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser(accessToken);
  if (authError || !user) {
    return Response.json({ ok: false, error: "Invalid or expired GolfOps Live login." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await userSupabase
    .from("profiles")
    .select("club_id,role")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.club_id) {
    return Response.json({ ok: false, error: "Unable to determine your club." }, { status: 403 });
  }
  if (profile.role !== "admin") {
    return Response.json({ ok: false, error: "Admin access is required to synchronize TEAM PTO." }, { status: 403 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return Response.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });
  }

  let body: PtoPayload;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid TEAM PTO request." }, { status: 400 });
  }

  const sourceMode = body.sourceMode === "delta" ? "delta" : "full";
  const action = body.action === "delete" ? "delete" : "upsert";
  const employees = Array.isArray(body.employees) ? body.employees.slice(0, 500) : [];
  const requests = Array.isArray(body.requests) ? body.requests.slice(0, 10000) : [];

  let dateStart = cleanText(body.dateStart, 10);
  let dateEnd = cleanText(body.dateEnd, 10);
  if (sourceMode === "delta" && requests.length) {
    dateStart = localDate(requests[0].start) || dateStart;
    dateEnd = localDate(requests[0].end) || dateStart || dateEnd;
  }

  if (!datePattern.test(dateStart) || !datePattern.test(dateEnd) || dateStart > dateEnd) {
    return Response.json({ ok: false, error: "The TEAM PTO date range is invalid." }, { status: 400 });
  }
  if (!Number.isInteger(body.locationId) || Number(body.locationId) <= 0) {
    return Response.json({ ok: false, error: "The SchedulePop location is missing." }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const schedulePopUserIds = employees
    .map((employee) => Number(employee.id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const { data: existingEmployees, error: existingEmployeeError } = schedulePopUserIds.length
    ? await admin
        .from("schedulepop_employees")
        .select("schedulepop_user_id,routing_override")
        .eq("club_id", profile.club_id)
        .in("schedulepop_user_id", schedulePopUserIds)
    : { data: [], error: null };
  if (existingEmployeeError) {
    return Response.json({ ok: false, error: existingEmployeeError.message }, { status: 500 });
  }
  const overrideMap = new Map(
    (existingEmployees ?? []).map((row) => [Number(row.schedulepop_user_id), row.routing_override as string | null])
  );

  const employeeRows = employees
    .map((employee) => {
      const schedulepopUserId = Number(employee.id);
      if (!Number.isInteger(schedulepopUserId) || schedulepopUserId <= 0) return null;
      const duty = primaryDuty(employee);
      const override = overrideMap.get(schedulepopUserId) ?? null;
      const statusName = cleanText(employee.userStatusTypeName).toLowerCase();
      return {
        club_id: profile.club_id,
        schedulepop_user_id: schedulepopUserId,
        first_name: cleanText(employee.firstname),
        last_name: cleanText(employee.lastname),
        email: cleanText(employee.email, 320) || null,
        primary_duty: duty || null,
        duties: Array.isArray(employee.userDuties) ? employee.userDuties : [],
        zones: Array.isArray(employee.userZones) ? employee.userZones : [],
        routing_override: override,
        resolved_department: resolvePtoDepartment(duty, override),
        active: !["inactive", "terminated", "disabled"].includes(statusName),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (employeeRows.length) {
    const { error } = await admin
      .from("schedulepop_employees")
      .upsert(employeeRows, { onConflict: "club_id,schedulepop_user_id" });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const requestUserIds = requests
    .map((item) => Number(item.user))
    .filter((id) => Number.isInteger(id) && id > 0);
  const allUserIds = Array.from(new Set([...schedulePopUserIds, ...requestUserIds]));
  const { data: savedEmployees, error: savedEmployeeError } = allUserIds.length
    ? await admin
        .from("schedulepop_employees")
        .select("id,schedulepop_user_id")
        .eq("club_id", profile.club_id)
        .in("schedulepop_user_id", allUserIds)
    : { data: [], error: null };
  if (savedEmployeeError) {
    return Response.json({ ok: false, error: savedEmployeeError.message }, { status: 500 });
  }
  const employeeIdMap = new Map(
    (savedEmployees ?? []).map((row) => [Number(row.schedulepop_user_id), String(row.id)])
  );

  if (action === "delete") {
    const requestIds = requests
      .map((item) => Number(item.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!requestIds.length) {
      return Response.json({ ok: false, error: "The deleted SchedulePop PTO ID is missing." }, { status: 400 });
    }
    const { data: deletingRows, error: deletingRowsError } = await admin
      .from("team_pto_requests")
      .select("start_local,end_local")
      .eq("club_id", profile.club_id)
      .in("schedulepop_request_id", requestIds);
    if (deletingRowsError) {
      return Response.json({ ok: false, error: deletingRowsError.message }, { status: 500 });
    }
    const deletingDates = (deletingRows ?? [])
      .flatMap((row) => [localDate(row.start_local), localDate(row.end_local)])
      .filter((value): value is string => Boolean(value))
      .sort();
    if (deletingDates.length) {
      dateStart = deletingDates[0];
      dateEnd = deletingDates[deletingDates.length - 1];
    }
    const { error } = await admin
      .from("team_pto_requests")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("club_id", profile.club_id)
      .in("schedulepop_request_id", requestIds);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const requestRows = requests
      .map((item) => {
        const requestId = Number(item.id);
        const schedulepopUserId = Number(item.user);
        if (
          !Number.isInteger(requestId) ||
          requestId <= 0 ||
          !Number.isInteger(schedulepopUserId) ||
          schedulepopUserId <= 0 ||
          !validTimestamp(item.start) ||
          !validTimestamp(item.end)
        ) {
          return null;
        }
        return {
          club_id: profile.club_id,
          employee_id: employeeIdMap.get(schedulepopUserId) ?? null,
          schedulepop_request_id: requestId,
          schedulepop_user_id: schedulepopUserId,
          employee_first_name: cleanText(item.firstname),
          employee_last_name: cleanText(item.lastname),
          start_local: item.start,
          end_local: item.end,
          all_day: item.allDay !== false,
          approved: item.approved === true,
          is_deleted: item.isDeleted === true,
          request_type: cleanText(item.status, 100) || "PTO",
          manager_note: cleanText(item.managerNote, 1000) || null,
          source_created_at: validTimestamp(item.createDatetime) ? item.createDatetime : null,
          source_updated_at: validTimestamp(item.updateDatetime) ? item.updateDatetime : null,
          raw_payload: item,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (requestRows.length) {
      const { error } = await admin
        .from("team_pto_requests")
        .upsert(requestRows, { onConflict: "club_id,schedulepop_request_id" });
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (sourceMode === "full" && body.complete === true) {
      const seenIds = new Set(requestRows.map((row) => row.schedulepop_request_id));
      const { data: storedRows, error: storedError } = await admin
        .from("team_pto_requests")
        .select("schedulepop_request_id")
        .eq("club_id", profile.club_id)
        .gte("start_local", `${dateStart} 00:00:00`)
        .lte("start_local", `${dateEnd} 23:59:59`)
        .eq("is_deleted", false);
      if (storedError) return Response.json({ ok: false, error: storedError.message }, { status: 500 });
      const missingIds = (storedRows ?? [])
        .map((row) => Number(row.schedulepop_request_id))
        .filter((id) => !seenIds.has(id));
      if (missingIds.length) {
        const { error } = await admin
          .from("team_pto_requests")
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq("club_id", profile.club_id)
          .in("schedulepop_request_id", missingIds);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
    }
  }

  if (sourceMode === "full") {
    const { error } = await admin.from("team_pto_imports").insert({
      club_id: profile.club_id,
      location_id: Number(body.locationId),
      date_start: dateStart,
      date_end: dateEnd,
      employee_count: employeeRows.length,
      request_count: requests.length,
      source_complete: body.complete === true,
      imported_by: user.id,
    });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const calendar = await reconcilePtoCalendars(admin, profile.club_id, dateStart, dateEnd);
  return Response.json({
    ok: true,
    employeesImported: employeeRows.length,
    requestsImported: requests.length,
    complete: body.complete === true,
    calendar,
  });
}
