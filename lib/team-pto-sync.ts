import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  isGoogleCalendarConfigured,
  updateCalendarEvent,
} from "@/lib/google-calendar";
import { addDays, daysApart, localDate, ptoGroupKey } from "@/lib/team-pto";

type RequestRow = {
  schedulepop_request_id: number;
  schedulepop_user_id: number;
  employee_first_name: string;
  employee_last_name: string;
  start_local: string;
  end_local: string;
  all_day: boolean;
  request_type: string;
  employee_id: string | null;
};

type EmployeeRow = {
  id: string;
  schedulepop_user_id: number;
  resolved_department: "INSIDE" | "OUTSIDE" | "REVIEW";
};

type SyncRow = {
  id: string;
  group_key: string;
  department: "INSIDE" | "OUTSIDE";
  google_event_id: string | null;
  content_hash: string;
  attempt_count: number;
};

type DesiredEvent = {
  groupKey: string;
  department: "INSIDE" | "OUTSIDE";
  employeeName: string;
  startDate: string;
  endDate: string;
  endDateExclusive: string;
  allDay: boolean;
  startLocal: string;
  endLocal: string;
  requestIds: number[];
  contentHash: string;
};

function hashContent(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildDesiredEvents(requests: RequestRow[], employees: EmployeeRow[]) {
  const employeeMap = new Map(employees.map((row) => [Number(row.schedulepop_user_id), row]));
  const buckets = new Map<string, RequestRow[]>();

  for (const request of requests) {
    const employee = employeeMap.get(Number(request.schedulepop_user_id));
    if (!employee || employee.resolved_department === "REVIEW") continue;
    const key = [request.schedulepop_user_id, employee.resolved_department, request.request_type, request.all_day].join("|");
    const rows = buckets.get(key) ?? [];
    rows.push(request);
    buckets.set(key, rows);
  }

  const events: DesiredEvent[] = [];
  for (const [bucketKey, bucketRows] of buckets) {
    const department = bucketKey.split("|")[1] as "INSIDE" | "OUTSIDE";
    const sorted = [...bucketRows].sort((a, b) => a.start_local.localeCompare(b.start_local));
    let group: RequestRow[] = [];

    const flush = () => {
      if (!group.length) return;
      const first = group[0];
      const last = group[group.length - 1];
      const startDate = localDate(first.start_local)!;
      const endDate = localDate(last.start_local)!;
      const employeeName = `${first.employee_first_name} ${first.employee_last_name}`.trim();
      const requestIds = group.map((row) => Number(row.schedulepop_request_id)).sort((a, b) => a - b);
      const groupKey = ptoGroupKey([department, first.schedulepop_user_id, ...requestIds]);
      const content = {
        department,
        employeeName,
        startDate,
        endDate,
        allDay: first.all_day,
        startLocal: first.start_local,
        endLocal: last.end_local,
        requestIds,
      };
      events.push({
        ...content,
        groupKey,
        endDateExclusive: addDays(endDate, 1),
        contentHash: hashContent(content),
      });
      group = [];
    };

    for (const row of sorted) {
      if (!group.length) {
        group.push(row);
        continue;
      }
      const previous = group[group.length - 1];
      const previousDate = localDate(previous.start_local)!;
      const currentDate = localDate(row.start_local)!;
      if (row.all_day && previous.all_day && daysApart(previousDate, currentDate) === 1) {
        group.push(row);
      } else {
        flush();
        group.push(row);
      }
    }
    flush();
  }
  return events;
}

export async function reconcilePtoCalendars(
  admin: SupabaseClient,
  clubId: string,
  dateStart: string,
  dateEnd: string
) {
  if (!isGoogleCalendarConfigured()) {
    return {
      configured: false,
      created: 0,
      updated: 0,
      removed: 0,
      unchanged: 0,
      failed: 0,
      errors: ["Google Calendar credentials have not been configured."],
    };
  }

  const [{ data: requestData, error: requestError }, { data: employeeData, error: employeeError }] =
    await Promise.all([
      admin
        .from("team_pto_requests")
        .select("schedulepop_request_id,schedulepop_user_id,employee_first_name,employee_last_name,start_local,end_local,all_day,request_type,employee_id")
        .eq("club_id", clubId)
        .eq("approved", true)
        .eq("is_deleted", false)
        .gte("start_local", `${dateStart} 00:00:00`)
        .lte("start_local", `${dateEnd} 23:59:59`),
      admin
        .from("schedulepop_employees")
        .select("id,schedulepop_user_id,resolved_department")
        .eq("club_id", clubId),
    ]);

  if (requestError) throw new Error(requestError.message);
  if (employeeError) throw new Error(employeeError.message);

  const desired = buildDesiredEvents(
    (requestData ?? []) as RequestRow[],
    (employeeData ?? []) as EmployeeRow[]
  );
  const desiredMap = new Map(desired.map((event) => [event.groupKey, event]));

  const { data: existingData, error: existingError } = await admin
    .from("pto_calendar_syncs")
    .select("id,group_key,department,google_event_id,content_hash,attempt_count")
    .eq("club_id", clubId)
    .lte("start_date", dateEnd)
    .gte("end_date", dateStart)
    .neq("sync_status", "REMOVED");
  if (existingError) throw new Error(existingError.message);

  const existing = (existingData ?? []) as SyncRow[];
  const result = {
    configured: true,
    created: 0,
    updated: 0,
    removed: 0,
    unchanged: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const event of desired) {
    const current = existing.find((row) => row.group_key === event.groupKey);
    const calendarInput = {
      summary: `${event.employeeName} - PTO`,
      description: `Approved SchedulePop PTO\nDepartment: ${event.department === "INSIDE" ? "Inside Operations" : "Outside Operations"}\nSynchronized by GolfOps Live.`,
      startDate: event.startDate,
      endDateExclusive: event.endDateExclusive,
      allDay: event.allDay,
      startLocal: event.startLocal,
      endLocal: event.endLocal,
      groupKey: event.groupKey,
      department: event.department,
    } as const;

    try {
      let googleEventId = current?.google_event_id ?? null;
      if (!googleEventId) {
        googleEventId = await createCalendarEvent(calendarInput);
        result.created += 1;
      } else if (current?.content_hash !== event.contentHash) {
        await updateCalendarEvent(googleEventId, calendarInput);
        result.updated += 1;
      } else {
        result.unchanged += 1;
      }

      const { error } = await admin.from("pto_calendar_syncs").upsert(
        {
          club_id: clubId,
          group_key: event.groupKey,
          department: event.department,
          employee_name: event.employeeName,
          start_date: event.startDate,
          end_date: event.endDate,
          google_event_id: googleEventId,
          content_hash: event.contentHash,
          sync_status: "SYNCED",
          attempt_count: (current?.attempt_count ?? 0) + 1,
          last_error: null,
          last_attempt_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "club_id,group_key" }
      );
      if (error) throw new Error(error.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown calendar synchronization error.";
      result.failed += 1;
      result.errors.push(`${event.employeeName}: ${message}`);
      await admin.from("pto_calendar_syncs").upsert(
        {
          club_id: clubId,
          group_key: event.groupKey,
          department: event.department,
          employee_name: event.employeeName,
          start_date: event.startDate,
          end_date: event.endDate,
          google_event_id: current?.google_event_id ?? null,
          content_hash: event.contentHash,
          sync_status: "ERROR",
          attempt_count: (current?.attempt_count ?? 0) + 1,
          last_error: message.slice(0, 1000),
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "club_id,group_key" }
      );
    }
  }

  for (const current of existing) {
    if (desiredMap.has(current.group_key)) continue;
    try {
      if (current.google_event_id) {
        await deleteCalendarEvent(current.department, current.google_event_id);
      }
      await admin
        .from("pto_calendar_syncs")
        .update({
          sync_status: "REMOVED",
          last_error: null,
          last_attempt_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);
      result.removed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown calendar removal error.";
      result.failed += 1;
      result.errors.push(`Calendar removal: ${message}`);
      await admin
        .from("pto_calendar_syncs")
        .update({
          sync_status: "ERROR",
          last_error: message.slice(0, 1000),
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);
    }
  }

  return result;
}
