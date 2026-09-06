"use client";

import { useEffect, useRef, useState } from "react";

type ChangesPrintMenuProps = {
  date: string;
};

export default function ChangesPrintMenu({
  date,
}: ChangesPrintMenuProps) {
  const [open, setOpen] = useState(false);

  const wrapperRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        className="
          flex h-10 items-center gap-2
          rounded-md border border-slate-200
          bg-white px-3
          text-sm font-medium text-slate-700
          shadow-sm
          hover:bg-slate-50
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect
            x="6"
            y="14"
            width="12"
            height="8"
          />
        </svg>

        Print

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[
            "h-4 w-4 transition-transform",
            open
              ? "rotate-180"
              : "",
          ].join(" ")}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="
            absolute right-0 top-12 z-50
            w-60 overflow-hidden
            rounded-lg border border-slate-200
            bg-white shadow-lg
          "
        >
          <a
            href={`/print/placards?mode=all&date=${date}`}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              setOpen(false)
            }
            className="
              flex items-start gap-3
              border-b border-slate-100
              px-4 py-3
              hover:bg-slate-50
            "
          >
            <span className="mt-0.5 text-slate-500">
              🖨
            </span>

            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Print All Cart Signs
              </span>

              <span className="mt-0.5 block text-xs text-slate-500">
                Print the full cart sign set for this date.
              </span>
            </span>
          </a>

          <a
            href={`/print/placards?mode=changes&date=${date}`}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              setOpen(false)
            }
            className="
              flex items-start gap-3
              px-4 py-3
              hover:bg-slate-50
            "
          >
            <span className="mt-0.5 text-slate-500">
              ↻
            </span>

            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Print Changes Only
              </span>

              <span className="mt-0.5 block text-xs text-slate-500">
                Print only cart signs affected by open changes.
              </span>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}