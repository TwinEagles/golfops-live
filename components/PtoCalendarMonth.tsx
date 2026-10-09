import Link from "next/link";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return dateString(new Date(Date.UTC(year, month - 1, day + days)));
}

function eventDate(value: { date?: string; dateTime?: string }) {
  return value.date ?? value.dateTime?.slice(0, 10) ?? null;
}

export default function PtoCalendarMonth({
  department,
  month,
  events,
}: {
  department: "INSIDE" | "OUTSIDE";
  month: string;
  events: GoogleCalendarEvent[];
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, monthNumber - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, monthNumber, 0));
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const eventsByDate = new Map<string, GoogleCalendarEvent[]>();
  for (const event of events) {
    const start = eventDate(event.start);
    const endExclusive = eventDate(event.end);
    if (!start || !endExclusive) continue;
    for (let day = start; day < endExclusive; day = addUtcDays(day, 1)) {
      const rows = eventsByDate.get(day) ?? [];
      rows.push(event);
      eventsByDate.set(day, rows);
    }
  }

  const days: Date[] = [];
  for (const cursor = new Date(gridStart); cursor <= gridEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(new Date(cursor));
  }

  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const route = department === "INSIDE" ? "/pto-calendar/inside" : "/pto-calendar/outside";
  const accent = department === "INSIDE" ? "bg-amber-100 text-amber-950" : "bg-rose-100 text-rose-950";
  const title = department === "INSIDE" ? "Inside Operations Time Off" : "Outside Operations Time Off";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">Read-only calendar synchronized from approved SchedulePop PTO.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`${route}?month=${dateString(previous).slice(0, 7)}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label="Previous month">←</Link>
          <div className="min-w-40 text-center text-lg font-bold text-slate-900">
            {firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
          </div>
          <Link href={`${route}?month=${dateString(next).slice(0, 7)}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label="Next month">→</Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {weekdays.map((weekday) => <div key={weekday} className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">{weekday}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dateString(day);
              const inMonth = day.getUTCMonth() === monthNumber - 1;
              const dayEvents = eventsByDate.get(key) ?? [];
              return (
                <div key={key} className={["min-h-32 border-b border-r border-slate-200 p-2", inMonth ? "bg-white" : "bg-slate-50"].join(" ")}>
                  <div className={["mb-2 text-sm font-semibold", inMonth ? "text-slate-800" : "text-slate-400"].join(" ")}>{day.getUTCDate()}</div>
                  <div className="space-y-1.5">
                    {dayEvents.map((event) => (
                      <div key={`${key}-${event.id}`} className={["rounded-md px-2 py-1.5 text-xs font-semibold", accent].join(" ")} title={event.description ?? event.summary}>
                        {event.summary}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
