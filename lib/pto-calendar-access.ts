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
  if (access.isAdmin || access.permissions.pto_calendar) {
    return { canInside: true, canOutside: true, department: null };
  }

  return { canInside: false, canOutside: false, department: null };
}
