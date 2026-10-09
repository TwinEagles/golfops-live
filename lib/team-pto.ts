import { createHash } from "node:crypto";

export type PtoDepartment = "INSIDE" | "OUTSIDE" | "REVIEW";

export type SchedulePopDuty = {
  id?: number;
  duty?: number;
  name?: string;
  disabled?: boolean;
  activeDuty?: boolean;
};

export type SchedulePopZone = {
  id?: number;
  zone?: number;
  zoneName?: string;
  enabled?: boolean;
};

export type SchedulePopEmployeeInput = {
  id?: number;
  firstname?: string;
  lastname?: string;
  email?: string;
  userStatusTypeName?: string;
  userDuties?: SchedulePopDuty[];
  userZones?: SchedulePopZone[];
};

export type SchedulePopPtoInput = {
  id?: number;
  user?: number;
  firstname?: string;
  lastname?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  approved?: boolean;
  isDeleted?: boolean;
  status?: string;
  managerNote?: string | null;
  createDatetime?: string;
  updateDatetime?: string;
};

const insideDutyTerms = [
  "director of golf",
  "head golf professional",
  "assistant golf professional",
  "golf professional",
  "golf shop",
  "merchand",
  "instruction",
  "locker room",
];

const outsideDutyTerms = [
  "outside golf operations",
  "outside operations",
  "starter",
  "player assistant",
  "range attendant",
  "range attendent",
  "bag staff",
];

export function cleanText(value: unknown, max = 250) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function primaryDuty(employee: SchedulePopEmployeeInput) {
  const duties = Array.isArray(employee.userDuties) ? employee.userDuties : [];
  const active = duties.find((duty) => duty.activeDuty && !duty.disabled);
  const available = duties.find((duty) => !duty.disabled);
  return cleanText(active?.name || available?.name);
}

export function resolvePtoDepartment(
  dutyName: string,
  override?: string | null
): PtoDepartment {
  if (override === "INSIDE" || override === "OUTSIDE") return override;

  const duty = cleanText(dutyName).toLowerCase();
  if (!duty) return "REVIEW";

  if (outsideDutyTerms.some((term) => duty.includes(term))) return "OUTSIDE";
  if (insideDutyTerms.some((term) => duty.includes(term))) return "INSIDE";
  return "REVIEW";
}

export function localDate(value: string | null | undefined) {
  const match = cleanText(value, 40).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function daysApart(left: string, right: string) {
  const leftTime = Date.parse(`${left}T00:00:00Z`);
  const rightTime = Date.parse(`${right}T00:00:00Z`);
  return Math.round((rightTime - leftTime) / 86_400_000);
}

export function ptoGroupKey(parts: Array<string | number>) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}
