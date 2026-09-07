"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SchedulePopImporter from "@/components/SchedulePopImporter";

type Staff = {
  id: string;
  employee_name: string;
  job_title: string;
  start_time: string | null;
  end_time: string | null;
  duty: string | null;
  zone: string | null;
  status: string;
  notes: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  area: string;
  due_date: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
};

const areas = [
  ["OUTSIDE_OPERATIONS", "Outside Operations"],
  ["STARTER_PLAYER_ASSISTANT", "Starter / Player Assistant"],
  ["RANGE", "Range"],
  ["GOLF_SHOP", "Golf Shop"],
  ["INSTRUCTION", "Instruction / Player Development"],
  ["GENERAL", "General"],
] as const;

function areaLabel(value: string) {
  return areas.find(([key]) => key === value)?.[1] ?? value;
}

function formatTime(value: string | null) {
  if (!value) return "";

  const cleaned = value.trim();

  if (/AM|PM/i.test(cleaned)) {
    return cleaned;
  }

  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return cleaned;

  const hour = Number(match[1]);

  return `${hour % 12 || 12}:${match[2]} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function departmentFor(person: Staff) {
  const text = `${person.duty ?? ""} ${
    person.zone ?? ""
  } ${person.job_title ?? ""}`.toLowerCase();

  if (
    text.includes("golf shop") ||
    text.includes("golf professional") ||
    text.includes(" in ")
  ) {
    return "Golf Shop";
  }

  if (
    text.includes("range") ||
    text.includes("range attn")
  ) {
    return "Range";
  }

  if (
    text.includes("starter") ||
    text.includes("player assistant") ||
    text.includes("starter/pa")
  ) {
    return "Starter / Player Assistant";
  }

  if (
    text.includes("outside") ||
    text.includes("open-close") ||
    text.includes("bag drop")
  ) {
    return "Outside Operations";
  }

  if (
    text.includes("instruction") ||
    text.includes("player development") ||
    text.includes("teaching")
  ) {
    return "Instruction / Player Development";
  }

  return "General";
}

export default function StaffScheduleManager({
  date,
  staff,
  tasks,
  isAdmin,
  latestImport,
}: {
  date: string;
  staff: Staff[];
  tasks: Task[];
  isAdmin: boolean;
  latestImport: any;
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [area, setArea] = useState("OUTSIDE_OPERATIONS");
  const [dueDate, setDueDate] = useState(date);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/staff-tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Unable to save.");
    }

    return result;
  }

  function changeDate(days: number) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);

    router.push(
      `/outside-operations?date=${next
        .toISOString()
        .slice(0, 10)}`
    );
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await post({
        action: "add",
        title,
        area,
        dueDate,
        description,
      });

      setTitle("");
      setDescription("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save task."
      );
    }
  }

  async function updateStatus(
    id: string,
    status: string
  ) {
    setError("");

    try {
      await post({
        action: "status",
        id,
        status,
      });

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update task."
      );
    }
  }

  const groupedStaff = Array.from(
    staff
      .filter((person) => person.status === "SCHEDULED")
      .reduce((groups, person) => {
        const department = departmentFor(person);
        const people = groups.get(department) ?? [];

        people.push(person);
        groups.set(department, people);

        return groups;
      }, new Map<string, Staff[]>())
      .entries()
  );

  const isOverdue = (task: Task) =>
    task.status !== "COMPLETED" &&
    task.due_date < date;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Staff Schedule
          </div>

          <h1 className="text-3xl font-bold">
            {new Date(`${date}T12:00:00`).toLocaleDateString(
              "en-US",
              {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              }
            )}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeDate(-1)}
            aria-label="Previous day"
            className="rounded border px-4 py-2 text-2xl"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/outside-operations?date=${new Date()
                  .toISOString()
                  .slice(0, 10)}`
              )
            }
            className="rounded border px-3 py-2"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => changeDate(1)}
            aria-label="Next day"
            className="rounded border px-4 py-2 text-2xl"
          >
            ›
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              SchedulePop
            </p>

            <h2 className="text-2xl font-bold">
              Today’s Staff
            </h2>
          </div>

          {latestImport && (
            <p className="text-sm text-slate-500">
              Last imported{" "}
              {new Date(
                latestImport.imported_at
              ).toLocaleString()}
            </p>
          )}
        </div>

        {groupedStaff.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {groupedStaff.map(([department, people]) => (
              <div
                key={department}
                className="rounded-lg border p-4"
              >
                <h3 className="font-bold">
                  {department}
                </h3>

                {people.map((person) => (
                  <div
                    key={person.id}
                    className="mt-3 border-t pt-3"
                  >
                    <div className="font-semibold">
                      {person.employee_name}
                    </div>

                    <div className="text-sm text-blue-600">
                      {formatTime(person.start_time)}
                      {person.end_time &&
                        ` – ${formatTime(person.end_time)}`}
                    </div>

                    <div className="text-sm text-slate-500">
                      {person.duty || person.job_title}
                      {person.zone &&
                        ` • ${person.zone}`}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-slate-500">
            No scheduled staff imported for this date.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Task Log
        </p>

        <h2 className="text-2xl font-bold">
          Projects and follow-up
        </h2>

        <form
          onSubmit={addTask}
          className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <input
            required
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Add a project or task"
            className="rounded border px-3 py-2"
          />

          <select
            value={area}
            onChange={(event) =>
              setArea(event.target.value)
            }
            className="rounded border px-3 py-2"
          >
            {areas.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <input
            required
            type="date"
            value={dueDate}
            onChange={(event) =>
              setDueDate(event.target.value)
            }
            className="rounded border px-3 py-2"
          />

          <button className="rounded bg-blue-600 px-4 py-2 font-semibold text-white">
            Add Task
          </button>
        </form>

        <textarea
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          placeholder="Optional notes"
          className="mt-3 w-full rounded border px-3 py-2"
          rows={2}
        />

        {error && (
          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-3">
          {tasks.length === 0 ? (
            <p className="text-slate-500">
              No tasks yet.
            </p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`rounded-lg border p-4 ${
                  isOverdue(task)
                    ? "border-red-300 bg-red-50"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">
                      {task.title}
                    </div>

                    <div className="text-sm text-slate-500">
                      {areaLabel(task.area)} • Due{" "}
                      {task.due_date}

                      {isOverdue(task) && (
                        <span className="ml-2 font-bold text-red-600">
                          OVERDUE
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <div className="mt-1 text-sm">
                        {task.description}
                      </div>
                    )}
                  </div>

                  <select
                    value={task.status}
                    onChange={(event) =>
                      updateStatus(
                        task.id,
                        event.target.value
                      )
                    }
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">
                      In Progress
                    </option>
                    <option value="COMPLETED">
                      Completed
                    </option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-6">
        <SchedulePopImporter />
      </section>
    </main>
  );
}