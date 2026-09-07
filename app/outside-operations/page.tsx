import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import OutsideOperationsManager from "@/components/OutsideOperationsManager";
import OperationsRefresh from "@/components/OperationsRefresh";
import { getGolfOpsAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

function easternDateString() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function OutsideOperationsPage() {
  const access = await getGolfOpsAccess();
  if (!access) redirect("/");
  if (!access.isAdmin && !access.permissions.outside_operations) redirect("/settings/account");

  const supabase = await createClient();
  const today = easternDateString();
  const [itemsResult, completionsResult, handoffsResult, profilesResult, staffingResult, scheduleImportResult] = await Promise.all([
    supabase.from("outside_ops_checklist_items").select("id, shift, item_order, item_text, active").eq("club_id", access.clubId).order("shift").order("item_order"),
    supabase.from("outside_ops_checklist_completions").select("id, item_id, operator_name, completed_at").eq("club_id", access.clubId).eq("work_date", today),
    supabase.from("outside_ops_handoffs").select("id, category, note, status, created_by_name, created_at, resolved_by_name, resolved_at").eq("club_id", access.clubId).eq("work_date", today).order("created_at", { ascending: false }),
    supabase.from("profiles").select("display_name").eq("club_id", access.clubId).order("display_name"),
    supabase.from("schedulepop_shifts").select("id, employee_name, job_title, start_time, end_time, duty, zone, status, notes").eq("club_id", access.clubId).eq("shift_date", today).order("start_time"),
    supabase.from("schedulepop_imports").select("imported_at, date_start, date_end, rows_imported").eq("club_id", access.clubId).order("imported_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  for (const [label, result] of [["items", itemsResult], ["completions", completionsResult], ["handoffs", handoffsResult], ["profiles", profilesResult]] as const) {
    if (result.error) console.error(`Outside operations ${label} load error:`, result.error);
  }

  const staffNames = Array.from(new Set([
    ...(profilesResult.data ?? []).map((row) => row.display_name?.trim()),
    ...(staffingResult.data ?? []).filter((row) => row.status === "SCHEDULED").map((row) => row.employee_name?.trim()),
  ].filter((value): value is string => Boolean(value)))).sort();

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <OperationsRefresh />
      <AppNav active="outside-operations" selectedDate={today} />
      <OutsideOperationsManager
        workDate={today}
        initialItems={itemsResult.data ?? []}
        initialCompletions={completionsResult.data ?? []}
        initialHandoffs={handoffsResult.data ?? []}
        staffNames={staffNames}
        isAdmin={access.isAdmin}
        initialStaffing={staffingResult.data ?? []}
        lastScheduleImport={scheduleImportResult.data ?? null}
      />
    </div>
  );
}
