"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TeeSheetDateSelectorProps = {
  selectedDate: string;
  availableDates: string[];
  today: string;
};

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function dateStatus(value: string, today: string) {
  const tomorrow = addDays(today, 1);
  if (value === today) return "TODAY";
  if (value === tomorrow) return "TOMORROW";
  if (value < today) return "HISTORY";
  return "";
}

export default function TeeSheetDateSelector({
  selectedDate,
  availableDates,
  today,
}: TeeSheetDateSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const status = dateStatus(selectedDate, today);

  function chooseDate(date: string) {
    setOpen(false);
    router.push(`/dashboard?date=${date}`);
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 sm:flex-none">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-[var(--golfops-text-secondary)] transition hover:bg-[var(--golfops-surface-soft)] sm:min-w-[320px] sm:gap-2 sm:px-4"
      >
        <span className="truncate text-sm font-semibold sm:text-base">
          {displayDate(selectedDate)}
        </span>

        {status && (
          <span
            className={[
              "hidden shrink-0 text-xs font-bold min-[430px]:inline",
              status === "HISTORY"
                ? "text-[var(--golfops-text-dim)]"
                : "text-[var(--golfops-accent)]",
            ].join(" ")}
          >
            {status}
          </span>
        )}

        <svg
          className={["h-4 w-4 shrink-0 transition-transform", open ? "rotate-180" : ""].join(" ")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 w-[min(340px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] shadow-xl">
          <div className="max-h-[min(360px,60vh)] overflow-y-auto" role="listbox">
            {availableDates.map((date) => {
              const itemStatus = dateStatus(date, today);
              const selected = date === selectedDate;

              return (
                <button
                  type="button"
                  key={date}
                  onClick={() => chooseDate(date)}
                  className={[
                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition sm:px-5",
                    selected
                      ? "bg-[var(--golfops-accent)] text-white"
                      : "text-[var(--golfops-text-secondary)] hover:bg-[var(--golfops-surface-soft)]",
                  ].join(" ")}
                  role="option"
                  aria-selected={selected}
                >
                  <span className="text-sm font-medium sm:text-base">
                    {displayDate(date)}
                  </span>

                  {itemStatus && (
                    <span
                      className={[
                        "shrink-0 text-[10px] font-bold sm:text-xs",
                        selected
                          ? "text-white/75"
                          : itemStatus === "HISTORY"
                            ? "text-[var(--golfops-text-dim)]"
                            : "text-[var(--golfops-accent)]",
                      ].join(" ")}
                    >
                      {itemStatus}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
