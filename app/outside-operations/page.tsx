import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import OperationsRefresh from "@/components/OperationsRefresh";
import { getGolfOpsAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

function easternDateString() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function OutsideOperationsManager({ workDate, initialItems, initialHandoffs }: {
  workDate: string;
  initialItems: Array<{ id: string; shift: string; item_order: number; item_text: string }>;
  initialHandoffs: Array<{ id: string; category: string; note: string; status: string }>;
}) {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Outside Operations</h1>
      <p className="text-sm opacity-70">{workDate}</p>
      <section className="rounded-lg border border-[var(--golfops-border)] p-4">
        <h2 className="mb-3 font-medium">Checklist</h2>
        <ul className="space-y-2">
          {initialItems.map((item) => <li key={item.id}>{item.item_text}</li>)}
        </ul>
      </section>
      <section className="rounded-lg border border-[var(--golfops-border)] p-4">
        <h2 className="mb-3 font-medium">Handoffs</h2>
        <ul className="space-y-2">
          {initialHandoffs.map((handoff) => <li key={handoff.id}>{handoff.category}: {handoff.note}</li>)}
        </ul>
      </section>
    </main>
  );
}

export default async function OutsideOperationsPage() {
  const access = await getGolfOpsAccess();
  if (!access) redirect("/");
  if (!access.isAdmin && !access.permissions.outside_operations) redirect("/settings/account");

  const supabase = await createClient();
  const today = easternDateString();
  const [itemsResult, completionsResult, handoffsResult, profilesResult] = await Promise.all([
    supabase.from("outside_ops_checklist_items").select("id, shift, item_order, item_text").eq("club_id", access.clubId).eq("active", true).order("shift").order("item_order"),
    supabase.from("outside_ops_checklist_completions").select("id, item_id, operator_name, completed_at").eq("club_id", access.clubId).eq("work_date", today),
    supabase.from("outside_ops_handoffs").select("id, category, note, status, created_by_name, created_at, resolved_by_name, resolved_at").eq("club_id", access.clubId).eq("work_date", today).order("created_at", { ascending: false }),
    supabase.from("profiles").select("display_name").eq("club_id", access.clubId).order("display_name"),
  ]);

  for (const [label, result] of [["items", itemsResult], ["completions", completionsResult], ["handoffs", handoffsResult], ["profiles", profilesResult]] as const) {
    if (result.error) console.error(`Outside operations ${label} load error:`, result.error);
  }

  const staffNames = Array.from(new Set((profilesResult.data ?? []).map((row) => row.display_name?.trim()).filter((value): value is string => Boolean(value))));

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
      />
    </div>
  );
}
