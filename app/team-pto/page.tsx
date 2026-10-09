import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import TeamPtoManager, {
  type TeamPtoBlock,
  type TeamPtoEmployee,
} from "@/components/TeamPtoManager";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { getGolfOpsAccess } from "@/lib/permissions";
import { getPtoCalendarAccess } from "@/lib/pto-calendar-access";
import { createClient } from "@/lib/supabase/server";
import { daysApart, localDate, ptoGroupKey } from "@/lib/team-pto";

function easternDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function futureDate(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return easternDateString(date);
}

type RequestRow = {
  schedulepop_request_id: number;
  schedulepop_user_id: number;
  employee_id: string | null;
  employee_first_name: string;
  employee_last_name: string;
  start_local: string;
  end_local: string;
  all_day: boolean;
  request_type: string;
};

export default async function TeamPtoPage() {
  const access = await getGolfOpsAccess();
  if (!access) redirect("/");
  if (!access.isAdmin) {
    const calendarAccess = await getPtoCalendarAccess(access);
    if (calendarAccess.department === "INSIDE") redirect("/pto-calendar/inside");
    if (calendarAccess.department === "OUTSIDE") redirect("/pto-calendar/outside");
    redirect("/operations");
  }

  const supabase = await createClient();
  const dateStart = easternDateString();
  const dateEnd = futureDate(18);

  const [requestResult, employeeResult, syncResult, importResult] = await Promise.all([
    supabase
      .from("team_pto_requests")
      .select("schedulepop_request_id,schedulepop_user_id,employee_id,employee_first_name,employee_last_name,start_local,end_local,all_day,request_type")
      .eq("club_id", access.clubId)
      .eq("approved", true)
      .eq("is_deleted", false)
      .gte("start_local", `${dateStart} 00:00:00`)
      .lte("start_local", `${dateEnd} 23:59:59`)
      .order("start_local"),
    supabase
      .from("schedulepop_employees")
      .select("id,schedulepop_user_id,first_name,last_name,primary_duty,routing_override,resolved_department,active")
      .eq("club_id", access.clubId)
      .order("last_name"),
    supabase
      .from("pto_calendar_syncs")
      .select("group_key,sync_status,last_error")
      .eq("club_id", access.clubId)
      .neq("sync_status", "REMOVED"),
    supabase
      .from("team_pto_imports")
      .select("imported_at")
      .eq("club_id", access.clubId)
      .order("imported_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const activeEmployeeRows = (employeeResult.data ?? []).filter((row) => row.active);
  const employees = activeEmployeeRows.map((row) => ({
    id: String(row.id),
    name: `${row.first_name} ${row.last_name}`.trim(),
    primaryDuty: row.primary_duty,
    routingOverride: row.routing_override,
    resolvedDepartment: row.resolved_department,
  })) as TeamPtoEmployee[];
  const departmentMap = new Map(
    activeEmployeeRows.map((row) => [
      Number(row.schedulepop_user_id),
      row.resolved_department as "INSIDE" | "OUTSIDE" | "REVIEW",
    ])
  );
  const syncMap = new Map(
    (syncResult.data ?? []).map((row) => [String(row.group_key), row])
  );

  const buckets = new Map<string, RequestRow[]>();
  for (const request of (requestResult.data ?? []) as RequestRow[]) {
    const department = departmentMap.get(Number(request.schedulepop_user_id));
    if (!department) continue;
    const key = [request.schedulepop_user_id, department, request.request_type, request.all_day].join("|");
    const rows = buckets.get(key) ?? [];
    rows.push(request);
    buckets.set(key, rows);
  }

  const blocks: TeamPtoBlock[] = [];
  for (const [bucketKey, rows] of buckets) {
    const department = bucketKey.split("|")[1] as "INSIDE" | "OUTSIDE" | "REVIEW";
    const sorted = [...rows].sort((a, b) => a.start_local.localeCompare(b.start_local));
    let group: RequestRow[] = [];
    const flush = () => {
      if (!group.length) return;
      const first = group[0];
      const last = group[group.length - 1];
      const requestIds = group.map((row) => Number(row.schedulepop_request_id)).sort((a, b) => a - b);
      const groupKey = ptoGroupKey([department, first.schedulepop_user_id, ...requestIds]);
      const sync = syncMap.get(groupKey);
      blocks.push({
        groupKey,
        employeeName: `${first.employee_first_name} ${first.employee_last_name}`.trim(),
        employeeId: first.employee_id,
        department,
        startDate: localDate(first.start_local)!,
        endDate: localDate(last.start_local)!,
        allDay: first.all_day,
        startLocal: first.start_local,
        endLocal: last.end_local,
        requestCount: group.length,
        syncStatus: sync?.sync_status ?? null,
        syncError: sync?.last_error ?? null,
      });
      group = [];
    };
    for (const row of sorted) {
      if (!group.length) {
        group.push(row);
        continue;
      }
      const previous = group[group.length - 1];
      if (
        row.all_day &&
        previous.all_day &&
        daysApart(localDate(previous.start_local)!, localDate(row.start_local)!) === 1
      ) {
        group.push(row);
      } else {
        flush();
        group.push(row);
      }
    }
    flush();
  }

  blocks.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.employeeName.localeCompare(b.employeeName));

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="team-pto" />
      <TeamPtoManager
        blocks={blocks}
        employees={employees}
        isAdmin={access.isAdmin}
        dateStart={dateStart}
        dateEnd={dateEnd}
        lastImportedAt={importResult.data?.imported_at ?? null}
        calendarConfigured={isGoogleCalendarConfigured()}
      />
    </div>
  );
}
