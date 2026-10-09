"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type TeamPtoBlock = {
  groupKey: string;
  employeeName: string;
  employeeId: string | null;
  department: "INSIDE" | "OUTSIDE" | "REVIEW";
  startDate: string;
  endDate: string;
  allDay: boolean;
  startLocal: string;
  endLocal: string;
  requestCount: number;
  syncStatus: string | null;
  syncError: string | null;
};

export type TeamPtoEmployee = {
  id: string;
  name: string;
  primaryDuty: string | null;
  routingOverride: "INSIDE" | "OUTSIDE" | null;
  resolvedDepartment: "INSIDE" | "OUTSIDE" | "REVIEW";
};

type SyncResult = {
  ok?: boolean;
  error?: string;
  calendar?: {
    configured?: boolean;
    created?: number;
    updated?: number;
    removed?: number;
    unchanged?: number;
    failed?: number;
    errors?: string[];
  };
};

const PAGE_SOURCE = "golfops-live-page";
const EXTENSION_SOURCE = "golfops-live-extension";

function displayDateRange(start: string, end: string) {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };
  const startDate = parse(start);
  const endDate = parse(end);
  if (start === end) {
    return startDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function departmentLabel(value: string) {
  if (value === "INSIDE") return "Inside Operations";
  if (value === "OUTSIDE") return "Outside Operations";
  return "Needs Review";
}

export default function TeamPtoManager({
  blocks,
  employees,
  isAdmin,
  dateStart,
  dateEnd,
  lastImportedAt,
  calendarConfigured,
}: {
  blocks: TeamPtoBlock[];
  employees: TeamPtoEmployee[];
  isAdmin: boolean;
  dateStart: string;
  dateEnd: string;
  lastImportedAt: string | null;
  calendarConfigured: boolean;
}) {
  const router = useRouter();
  const [department, setDepartment] = useState("ALL");
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const activeRequestId = useRef<string | null>(null);
  const ackTimer = useRef<number | null>(null);
  const resultTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return blocks.filter((block) => {
      if (department !== "ALL" && block.department !== department) return false;
      if (term && !block.employeeName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [blocks, department, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, TeamPtoBlock[]>();
    for (const block of filtered) {
      const [year, month] = block.startDate.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      const rows = groups.get(label) ?? [];
      rows.push(block);
      groups.set(label, rows);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  useEffect(() => {
    function clearTimers() {
      if (ackTimer.current !== null) window.clearTimeout(ackTimer.current);
      if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
      ackTimer.current = null;
      resultTimer.current = null;
    }

    function handleMessage(event: MessageEvent) {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== EXTENSION_SOURCE ||
        event.data?.requestId !== activeRequestId.current
      ) return;

      if (event.data.type === "SCHEDULEPOP_PTO_SYNC_ACK") {
        if (ackTimer.current !== null) window.clearTimeout(ackTimer.current);
        ackTimer.current = null;
        return;
      }

      if (event.data.type !== "SCHEDULEPOP_PTO_SYNC_RESULT") return;
      clearTimers();
      activeRequestId.current = null;
      setWorking(false);
      const result = event.data.result as SyncResult;
      if (!result?.ok) {
        setError(result?.error || "Unable to synchronize TEAM PTO.");
        return;
      }
      const calendar = result.calendar;
      setMessage(
        calendar?.configured === false
          ? "SchedulePop PTO was imported. Google Calendar setup is still required."
          : `TEAM PTO synchronized. ${calendar?.created ?? 0} calendar event(s) added, ${calendar?.updated ?? 0} updated, and ${calendar?.removed ?? 0} removed.`
      );
      router.refresh();
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimers();
    };
  }, [router]);

  function syncFromSchedulePop() {
    if (working) return;
    setError("");
    setMessage("");
    setWorking(true);
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activeRequestId.current = requestId;
    window.postMessage(
      { source: PAGE_SOURCE, type: "PULL_SCHEDULEPOP_PTO", requestId },
      window.location.origin
    );
    ackTimer.current = window.setTimeout(() => {
      setWorking(false);
      activeRequestId.current = null;
      setError("GolfOps extension 1.5.0 was not detected. Install or reload the current extension, then try again.");
    }, 1500);
    resultTimer.current = window.setTimeout(() => {
      setWorking(false);
      activeRequestId.current = null;
      setError("TEAM PTO synchronization timed out. Keep SchedulePop open and try again.");
    }, 125000);
  }

  async function retryCalendars() {
    if (working) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/team-pto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateStart, dateEnd }),
      });
      const result = (await response.json()) as SyncResult;
      if (!response.ok || !result.ok) throw new Error(result.error || "Calendar reconciliation failed.");
      const calendar = result.calendar;
      setMessage(
        calendar?.configured === false
          ? "Google Calendar credentials have not been configured."
          : `Calendar reconciliation complete. ${calendar?.created ?? 0} added, ${calendar?.updated ?? 0} updated, ${calendar?.removed ?? 0} removed, ${calendar?.failed ?? 0} failed.`
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Calendar reconciliation failed.");
    } finally {
      setWorking(false);
    }
  }

  async function setRouting(employeeId: string, routingOverride: string) {
    setError("");
    setMessage("");
    const response = await fetch("/api/team-pto", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        routingOverride: routingOverride === "PRIMARY" ? null : routingOverride,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setError(result.error || "Unable to update employee routing.");
      return;
    }
    setMessage("Employee PTO routing updated. Use Retry Calendar Sync to apply the change.");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-5 sm:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--golfops-accent-text)]">
            SchedulePop Integration
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">TEAM PTO</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--golfops-text-muted)]">
            Approved time off for Inside and Outside Operations. SchedulePop remains the approval system of record.
          </p>
          <p className="mt-2 text-xs text-[var(--golfops-text-dim)]">
            {lastImportedAt
              ? `Last synchronized ${new Date(lastImportedAt).toLocaleString("en-US", { timeZone: "America/New_York" })}.`
              : "No SchedulePop PTO synchronization has been completed yet."}
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={syncFromSchedulePop}
              disabled={working}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              {working ? "Working..." : "Sync from SchedulePop"}
            </button>
            <button
              type="button"
              onClick={retryCalendars}
              disabled={working}
              className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] px-4 py-2.5 text-sm font-bold hover:bg-[var(--golfops-surface-muted)] disabled:opacity-60"
            >
              Retry Calendar Sync
            </button>
          </div>
        )}
      </div>

      {!calendarConfigured && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          TEAM PTO can be imported now. Google Calendar credentials still need to be configured before calendar events are created.
        </div>
      )}
      {message && <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{message}</div>}
      {error && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">{error}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4 shadow-[var(--golfops-shadow)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--golfops-text-muted)]">Approved PTO</div>
          <div className="mt-1 text-3xl font-black">{blocks.length}</div>
        </div>
        <div className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4 shadow-[var(--golfops-shadow)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--golfops-text-muted)]">Needs Review</div>
          <div className="mt-1 text-3xl font-black text-amber-600">{blocks.filter((block) => block.department === "REVIEW").length}</div>
        </div>
        <div className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4 shadow-[var(--golfops-shadow)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--golfops-text-muted)]">Calendar Errors</div>
          <div className="mt-1 text-3xl font-black text-red-600">{blocks.filter((block) => block.syncStatus === "ERROR").length}</div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4 shadow-[var(--golfops-shadow)]">
        <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-[var(--golfops-border)] bg-white px-3 py-2 text-sm">
            <option value="ALL">All departments</option>
            <option value="INSIDE">Inside Operations</option>
            <option value="OUTSIDE">Outside Operations</option>
            <option value="REVIEW">Needs Review</option>
          </select>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee" className="rounded-lg border border-[var(--golfops-border)] bg-white px-3 py-2 text-sm" />
        </div>
      </section>

      <div className="mt-6 space-y-7">
        {grouped.length ? grouped.map(([month, rows]) => (
          <section key={month}>
            <h2 className="mb-3 text-xl font-bold">{month}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {rows.map((block) => (
                <article key={block.groupKey} className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4 shadow-[var(--golfops-shadow)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold">{block.employeeName}</h3>
                      <p className="mt-1 text-sm font-semibold text-[var(--golfops-accent-text)]">{displayDateRange(block.startDate, block.endDate)}</p>
                      <p className="mt-1 text-xs text-[var(--golfops-text-muted)]">{block.allDay ? "All day" : `${block.startLocal.slice(11, 16)}–${block.endLocal.slice(11, 16)}`}</p>
                    </div>
                    <span className={[
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      block.department === "INSIDE" ? "bg-indigo-100 text-indigo-800" : block.department === "OUTSIDE" ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-900",
                    ].join(" ")}>{departmentLabel(block.department)}</span>
                  </div>
                  <div className="mt-3 border-t border-[var(--golfops-border)] pt-3 text-xs text-[var(--golfops-text-muted)]">
                    {block.department === "REVIEW"
                      ? "Calendar routing is waiting for an administrator."
                      : block.syncStatus === "SYNCED"
                        ? "Google Calendar synchronized"
                        : block.syncStatus === "ERROR"
                          ? `Calendar error: ${block.syncError || "Unknown error"}`
                          : "Waiting for Google Calendar synchronization"}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )) : (
          <div className="rounded-xl border border-dashed border-[var(--golfops-border)] bg-[var(--golfops-surface)] px-6 py-12 text-center text-[var(--golfops-text-muted)]">
            No approved PTO matches these filters.
          </div>
        )}
      </div>

      {isAdmin && (
        <details className="mt-8 rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-5 shadow-[var(--golfops-shadow)]">
          <summary className="cursor-pointer text-lg font-bold">Employee calendar routing</summary>
          <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">
            Primary duty determines the default. Use an override only for employees who need a different calendar.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-[var(--golfops-border)] text-xs uppercase tracking-wide text-[var(--golfops-text-muted)]"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Primary duty</th><th className="px-3 py-2">Routing</th></tr></thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-[var(--golfops-border)] last:border-0">
                    <td className="px-3 py-3 font-semibold">{employee.name}</td>
                    <td className="px-3 py-3 text-[var(--golfops-text-muted)]">{employee.primaryDuty || "Not supplied"}</td>
                    <td className="px-3 py-3">
                      <select
                        value={employee.routingOverride || "PRIMARY"}
                        onChange={(event) => setRouting(employee.id, event.target.value)}
                        className="rounded-lg border border-[var(--golfops-border)] bg-white px-3 py-2 text-sm"
                      >
                        <option value="PRIMARY">Primary duty ({departmentLabel(employee.resolvedDepartment)})</option>
                        <option value="INSIDE">Override: Inside Operations</option>
                        <option value="OUTSIDE">Override: Outside Operations</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </main>
  );
}
