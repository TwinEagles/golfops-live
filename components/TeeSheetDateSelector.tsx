"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TeeSheetDateSelectorProps = {
  selectedDate: string;
  availableDates: string[];
  today: string;
};

function addDays(
  value: string,
  days: number
) {
  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  date.setDate(
    date.getDate() + days
  );

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0"),
  ].join("-");
}

function displayDate(
  value: string
) {
  const [year, month, day] =
    value.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "numeric",
      day: "numeric",
      year: "numeric",
    }
  );
}

function dateStatus(
  value: string,
  today: string
) {
  const tomorrow =
    addDays(today, 1);

  if (value === today) {
    return "TODAY";
  }

  if (value === tomorrow) {
    return "TOMORROW";
  }

  if (value < today) {
    return "HISTORY";
  }

  return "";
}

export default function TeeSheetDateSelector({
  selectedDate,
  availableDates,
  today,
}: TeeSheetDateSelectorProps) {
  const router =
    useRouter();

  const [open, setOpen] =
    useState(false);

  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
  }, []);

  const status =
    dateStatus(
      selectedDate,
      today
    );

  function chooseDate(
    date: string
  ) {
    setOpen(false);

    router.push(
      `/dashboard?date=${date}`
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-[320px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-[var(--golfops-text-secondary)] transition hover:bg-[var(--golfops-surface-soft)]"
      >
        <span className="font-semibold">
          {displayDate(
            selectedDate
          )}
        </span>

        {status && (
          <span
            className={[
              "text-xs font-bold",
              status ===
              "HISTORY"
                ? "text-[var(--golfops-text-dim)]"
                : "text-[var(--golfops-accent)]",
            ].join(" ")}
          >
            {status}
          </span>
        )}

        <svg
          className={[
            "h-4 w-4 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m6 9 6 6 6-6"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 w-[340px] -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] shadow-xl">
          <div
            className="max-h-[360px] overflow-y-auto"
            role="listbox"
          >
            {availableDates.map(
              (date) => {
                const itemStatus =
                  dateStatus(
                    date,
                    today
                  );

                const selected =
                  date ===
                  selectedDate;

                return (
                  <button
                    type="button"
                    key={date}
                    onClick={() =>
                      chooseDate(
                        date
                      )
                    }
                    className={[
                      "flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition",
                      selected
                        ? "bg-[var(--golfops-accent)] text-white"
                        : "text-[var(--golfops-text-secondary)] hover:bg-[var(--golfops-surface-soft)]",
                    ].join(" ")}
                    role="option"
                    aria-selected={
                      selected
                    }
                  >
                    <span className="font-medium">
                      {displayDate(
                        date
                      )}
                    </span>

                    {itemStatus && (
                      <span
                        className={[
                          "text-xs font-bold",
                          selected
                            ? "text-white/75"
                            : itemStatus ===
                              "HISTORY"
                            ? "text-[var(--golfops-text-dim)]"
                            : "text-[var(--golfops-accent)]",
                        ].join(" ")}
                      >
                        {
                          itemStatus
                        }
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
}
