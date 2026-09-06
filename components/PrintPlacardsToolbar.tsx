"use client";

import { useRouter, useSearchParams } from "next/navigation";

type PrintPlacardsToolbarProps = {
  date: string;
  mode: string;
  placardCount: number;
  cutStack: boolean;
  holeOrder: "asc" | "desc";
  design: "bold" | "clean";
};

export default function PrintPlacardsToolbar({
  date,
  mode,
  placardCount,
  cutStack,
  holeOrder,
  design,
}: PrintPlacardsToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromTime =
    searchParams.get("from") ?? "";

  const toTime =
    searchParams.get("to") ?? "";

  const pageCount =
    Math.ceil(placardCount / 2);

  function updateParam(
    key: string,
    value: string | null
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString()
      );

    params.set("date", date);
    params.set("mode", mode);

    if (
      value === null ||
      value === ""
    ) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.push(
      `/print/placards?${params.toString()}`
    );
  }

  return (
    <div className="print-toolbar">
      <div className="toolbar-left">
        <button
          type="button"
          onClick={() =>
            window.print()
          }
          className="toolbar-control toolbar-print"
        >
          🖨 Print
        </button>

        <button
          type="button"
          onClick={() =>
            updateParam(
              "cutStack",
              cutStack
                ? "0"
                : "1"
            )
          }
          className="toolbar-control"
        >
          ✂ Cut & Stack{" "}
          <strong>
            {cutStack
              ? "ON"
              : "OFF"}
          </strong>
        </button>

        <button
          type="button"
          onClick={() =>
            updateParam(
              "holes",
              holeOrder ===
                "asc"
                ? "desc"
                : "asc"
            )
          }
          className="toolbar-control"
        >
          ⛳ Holes{" "}
          {holeOrder === "asc"
            ? "1→18"
            : "18→1"}
        </button>

        <label className="time-control">
          <span>From</span>

          <input
            type="time"
            value={fromTime}
            onChange={(event) =>
              updateParam(
                "from",
                event.target.value
              )
            }
          />
        </label>

        <label className="time-control">
          <span>To</span>

          <input
            type="time"
            value={toTime}
            onChange={(event) =>
              updateParam(
                "to",
                event.target.value
              )
            }
          />
        </label>

        <label className="design-control">
          <span>Design</span>

          <select
            value={design}
            onChange={(event) =>
              updateParam(
                "design",
                event.target.value
              )
            }
          >
            <option value="bold">
              Bold Design
            </option>

            <option value="clean">
              Clean Design
            </option>
          </select>
        </label>

        <span className="sign-count">
          {placardCount} cart{" "}
          {placardCount === 1
            ? "sign"
            : "signs"}{" "}
          · {pageCount}{" "}
          {pageCount === 1
            ? "page"
            : "pages"}
        </span>
      </div>

      <a
        href={`/dashboard?date=${date}`}
        className="toolbar-close"
      >
        Close
      </a>
    </div>
  );
}
