import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import PtoCalendarMonth from "@/components/PtoCalendarMonth";
import { listCalendarEvents, type GoogleCalendarEvent } from "@/lib/google-calendar";
import { getGolfOpsAccess } from "@/lib/permissions";
import { getPtoCalendarAccess } from "@/lib/pto-calendar-access";

function currentEasternMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function PtoCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ department: routeDepartment }, query] = await Promise.all([params, searchParams]);
  const department = routeDepartment === "inside" ? "INSIDE" : routeDepartment === "outside" ? "OUTSIDE" : null;
  if (!department) redirect("/operations");

  const access = await getGolfOpsAccess();
  if (!access) redirect("/");
  const calendarAccess = await getPtoCalendarAccess(access);
  const allowed = department === "INSIDE" ? calendarAccess.canInside : calendarAccess.canOutside;
  if (!allowed) {
    if (calendarAccess.department === "INSIDE") redirect("/pto-calendar/inside");
    if (calendarAccess.department === "OUTSIDE") redirect("/pto-calendar/outside");
    redirect("/operations");
  }

  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "")
    ? query.month!
    : currentEasternMonth();
  const bounds = monthBounds(month);
  let events: GoogleCalendarEvent[] = [];
  let error = "";
  try {
    events = await listCalendarEvents(department, bounds.start, bounds.end);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load the PTO calendar.";
  }

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="pto-calendar" />
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-5 sm:py-8">
        {error ? (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">{error}</div>
        ) : (
          <PtoCalendarMonth department={department} month={month} events={events} />
        )}
      </main>
    </div>
  );
}
