import { createClient } from "@/lib/supabase/server";
import type { GolfOpsAccess } from "@/lib/permissions";

export type PtoCalendarDepartment = "INSIDE" | "OUTSIDE";

export type PtoCalendarAccess = {
  canInside: boolean;
  canOutside: boolean;
  department: PtoCalendarDepartment | null;
};

export async function getPtoCalendarAccess(
  access: GolfOpsAccess
): Promise<PtoCalendarAccess> {
  if (access.isAdmin) {
    return { canInside: true, canOutside: true, department: null };
  }

  if (!access.email) {
    return { canInside: false, canOutside: false, department: null };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("schedulepop_employees")
    .select("resolved_department")
    .eq("club_id", access.clubId)
    .eq("active", true)
    .ilike("email", access.email)
    .in("resolved_department", ["INSIDE", "OUTSIDE"])
    .limit(1)
    .maybeSingle();

  const department = data?.resolved_department as PtoCalendarDepartment | undefined;
  return {
    canInside: department === "INSIDE",
    canOutside: department === "OUTSIDE",
    department: department ?? null,
  };
}
