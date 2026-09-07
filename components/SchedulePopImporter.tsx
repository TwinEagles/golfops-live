"use client";

import {
  ChangeEvent,
  DragEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type ParsedShift = {
  employeeName: string;
  jobTitle: string;
  shiftDate: string;
  startTime: string | null;
  endTime: string | null;
  duty: string | null;
  zone: string | null;
  status:
    | "SCHEDULED"
    | "OFF"
    | "TIME_OFF"
    | "UNAVAILABLE";
  notes: string | null;
};

type PositionedText = {
  text: string;
  x: number;
  y: number;
};

function clean(
  value:
    | string
    | null
    | undefined
) {
  return (
    value ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(
  header: string,
  year: number
) {
  const match =
    clean(header).match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i
    );

  if (!match) {
    return null;
  }

  const date =
    new Date(
      `${match[1]} ${match[2]}, ${year} 12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

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

function parseSchedulePopHtml(
  rawHtml: string
) {
  /*
    Remove saved-source comments so an
    authenticated SchedulePop report URL
    is never retained or transmitted.
  */

  const html =
    rawHtml.replace(
      /<!--[\s\S]*?-->/g,
      ""
    );

  const documentNode =
    new DOMParser()
      .parseFromString(
        html,
        "text/html"
      );

  const title =
    clean(
      documentNode
        .querySelector("title")
        ?.textContent
    );

  const yearMatch =
    title.match(
      /\b(20\d{2})\b/
    );

  const year =
    yearMatch
      ? Number(yearMatch[1])
      : new Date()
          .getFullYear();

  const shifts:
    ParsedShift[] = [];

  const dates =
    new Set<string>();

  const tables =
    Array.from(
      documentNode
        .querySelectorAll(
          "table.report.schedule"
        )
    );

  for (
    const table of tables
  ) {
    const headers =
      Array.from(
        table.querySelectorAll(
          "thead th"
        )
      );

    if (
      headers.length < 2
    ) {
      continue;
    }

    const jobTitle =
      clean(
        headers[0]
          .textContent
      );

    const tableDates =
      headers
        .slice(1)
        .map((header) =>
          isoDate(
            header.textContent ??
              "",
            year
          )
        );

    tableDates.forEach(
      (date) => {
        if (date) {
          dates.add(date);
        }
      }
    );

    const rows =
      Array.from(
        table.querySelectorAll(
          "tbody tr"
        )
      );

    for (
      const row of rows
    ) {
      const cells =
        Array.from(
          row.children
        ).filter(
          (node) =>
            node.tagName ===
            "TD"
        ) as HTMLElement[];

      if (
        cells.length < 2
      ) {
        continue;
      }

      const employeeName =
        clean(
          cells[0]
            .textContent
        );

      if (
        !employeeName ||
        employeeName ===
          "Golf Shop" ||
        employeeName ===
          "Outside Operations" ||
        employeeName.startsWith(
          "Printed by"
        )
      ) {
        continue;
      }

      for (
        let index = 1;
        index <
          cells.length &&
        index <=
          tableDates.length;
        index += 1
      ) {
        const shiftDate =
          tableDates[
            index - 1
          ];

        if (!shiftDate) {
          continue;
        }

        const blocks =
          Array.from(
            cells[index]
              .querySelectorAll(
                ".job-info"
              )
          );

        for (
          const block of
            blocks
        ) {
          const allText =
            clean(
              block.textContent
            );

          if (!allText) {
            continue;
          }

          const rangeText =
            clean(
              block
                .querySelector(
                  ".start-end"
                )
                ?.textContent
            );

          if (!rangeText) {
            const lower =
              allText
                .toLowerCase();

            const status:
              ParsedShift["status"] =
              lower.includes(
                "unavailable"
              )
                ? "UNAVAILABLE"
                : lower.includes(
                    "time off"
                  )
                  ? "TIME_OFF"
                  : "OFF";

            shifts.push({
              employeeName,
              jobTitle,
              shiftDate,
              startTime: null,
              endTime: null,
              duty: null,
              zone: null,
              status,
              notes: allText,
            });

            continue;
          }

          const rangeMatch =
            rangeText.match(
              /(.+?)\s*-\s*(.+)/
            );

          const children =
            Array.from(
              block.children
            )
              .map((child) =>
                clean(
                  child.textContent
                )
              )
              .filter(Boolean);

          const details =
            children.filter(
              (value) =>
                value !==
                rangeText
            );

          shifts.push({
            employeeName,
            jobTitle,
            shiftDate,

            startTime:
              rangeMatch
                ? clean(
                    rangeMatch[1]
                  )
                : null,

            endTime:
              rangeMatch
                ? clean(
                    rangeMatch[2]
                  )
                : null,

            duty:
              details[0] ??
              null,

            zone:
              details[1] ??
              null,

            status:
              "SCHEDULED",

            notes:
              details.length > 2
                ? details
                    .slice(2)
                    .join(" • ")
                : null,
          });
        }
      }
    }
  }

  const sortedDates =
    Array.from(dates)
      .sort();

  if (
    !shifts.length ||
    !sortedDates.length
  ) {
    throw new Error(
      "No SchedulePop staffing rows were found in this HTML report."
    );
  }

  return {
    shifts,

    dateStart:
      sortedDates[0],

    dateEnd:
      sortedDates[
        sortedDates.length -
          1
      ],
  };
}

function parsePdfCell(
  text: string,
  employeeName: string,
  jobTitle: string,
  shiftDate: string
): ParsedShift | null {
  const normalized =
    clean(text);

  if (!normalized) {
    return null;
  }

  const range =
    normalized.match(
      /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i
    );

  if (!range) {
    const lower =
      normalized
        .toLowerCase();

    const status:
      ParsedShift["status"] =
      lower.includes(
        "unavailable"
      )
        ? "UNAVAILABLE"
        : lower.includes(
            "time off"
          )
          ? "TIME_OFF"
          : "OFF";

    return {
      employeeName,
      jobTitle,
      shiftDate,
      startTime: null,
      endTime: null,
      duty: null,
      zone: null,
      status,
      notes: normalized,
    };
  }

  const details =
    clean(
      normalized.replace(
        range[0],
        ""
      )
    );

  const knownZones = [
    "Starter/Player Assistant",
    "Outside Operations",
    "Range Attendent",
    "Range Attendant",
    "Golf Shop",
  ];

  const zone =
    knownZones.find(
      (value) =>
        details
          .toLowerCase()
          .includes(
            value.toLowerCase()
          )
    ) ?? null;

  let duty =
    details;

  let notes:
    string | null =
    null;

  if (zone) {
    const index =
      details
        .toLowerCase()
        .indexOf(
          zone.toLowerCase()
        );

    duty =
      clean(
        details.slice(
          0,
          index
        )
      );

    notes =
      clean(
        details.slice(
          index +
            zone.length
        )
      ) || null;
  }

  return {
    employeeName,
    jobTitle,
    shiftDate,

    startTime:
      clean(range[1]),

    endTime:
      clean(range[2]),

    duty:
      duty || null,

    zone,
    status:
      "SCHEDULED",
    notes,
  };
}

async function parseSchedulePopPdf(
  file: File
) {
  const pdfjs =
    await import(
      "pdfjs-dist/webpack.mjs"
    );

  const pdf =
    await pdfjs
      .getDocument({
        data:
          new Uint8Array(
            await file.arrayBuffer()
          ),
      })
      .promise;

  const metadata =
    await pdf
      .getMetadata()
      .catch(() => null);

  const metadataTitle =
    metadata &&
    "info" in metadata &&
    metadata.info &&
    typeof metadata.info ===
      "object" &&
    "Title" in metadata.info
      ? String(
          metadata.info
            .Title ?? ""
        )
      : "";

  const yearMatch =
    `${metadataTitle} ${file.name}`
      .match(
        /\b(20\d{2})\b/
      );

  const year =
    yearMatch
      ? Number(yearMatch[1])
      : new Date()
          .getFullYear();

  const shifts:
    ParsedShift[] = [];

  const dateSet =
    new Set<string>();

  for (
    let pageNumber = 1;
    pageNumber <=
      pdf.numPages;
    pageNumber += 1
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );

    const content =
      await page
        .getTextContent();

    const contentItems =
      content.items as unknown[];

    const positioned:
      PositionedText[] =
      contentItems
        .filter(
          (
            item
          ): item is {
            str: string;
            transform: number[];
          } => {
            if (
              typeof item !==
                "object" ||
              item === null
            ) {
              return false;
            }

            const candidate =
              item as {
                str?: unknown;
                transform?: unknown;
              };

            return (
              typeof candidate
                .str ===
                "string" &&
              Array.isArray(
                candidate
                  .transform
              )
            );
          }
        )
        .map(
          (
            item
          ): PositionedText => ({
            text:
              clean(item.str),

            x:
              item.transform[4],

            y:
              item.transform[5],
          })
        )
        .filter(
          (
            item:
              PositionedText
          ) =>
            Boolean(
              item.text
            )
        );

    const dateHeaders =
      positioned
        .map((item) => ({
          ...item,

          date:
            isoDate(
              item.text,
              year
            ),
        }))
        .filter(
          (
            item
          ): item is
            PositionedText & {
              date: string;
            } =>
            Boolean(
              item.date
            )
        )
        .sort(
          (a, b) =>
            a.x - b.x
        )
        .slice(0, 7);

    if (
      dateHeaders.length !==
      7
    ) {
      continue;
    }

    dateHeaders.forEach(
      (item) =>
        dateSet.add(
          item.date
        )
    );

    const firstDateX =
      dateHeaders[0].x;

    const headerFloor =
      Math.min(
        ...dateHeaders.map(
          (item) => item.y
        )
      ) - 2;

    const jobTitle =
      clean(
        positioned
          .filter(
            (item) =>
              item.x <
                firstDateX -
                  5 &&
              item.y >=
                headerFloor &&
              item.text !==
                "+"
          )
          .sort(
            (a, b) =>
              b.y - a.y ||
              a.x - b.x
          )
          .map(
            (item) =>
              item.text
          )
          .join(" ")
      );

    if (!jobTitle) {
      continue;
    }

    const operationsLabels =
      positioned.filter(
        (item) =>
          item.x <
            firstDateX -
              5 &&
          item.text ===
            "Operations"
      );

    const employeeCeiling =
      operationsLabels.length
        ? Math.min(
            ...operationsLabels.map(
              (item) =>
                item.y
            )
          ) - 15
        : headerFloor - 70;

    const footer =
      positioned.find(
        (item) =>
          item.text.startsWith(
            "Printed by"
          )
      );

    const footerY =
      footer?.y ?? 0;

    const excluded =
      new Set([
        "+",
        "Golf Shop",
        "Outside",
        "Operations",
      ]);

    const employees =
      positioned
        .filter(
          (item) =>
            item.x <
              firstDateX -
                5 &&
            item.y <
              employeeCeiling &&
            item.y >
              footerY + 10 &&
            !excluded.has(
              item.text
            ) &&
            !item.text.startsWith(
              "Printed by"
            )
        )
        .sort(
          (a, b) =>
            b.y - a.y
        );

    for (
      let employeeIndex =
        0;
      employeeIndex <
        employees.length;
      employeeIndex += 1
    ) {
      const employee =
        employees[
          employeeIndex
        ];

      const nextEmployee =
        employees[
          employeeIndex +
            1
        ];

      const topY =
        employee.y + 5;

      const bottomY =
        nextEmployee
          ? nextEmployee.y +
            5
          : footerY + 8;

      for (
        let dateIndex = 0;
        dateIndex <
          dateHeaders.length;
        dateIndex += 1
      ) {
        const left =
          dateHeaders[
            dateIndex
          ].x - 2;

        const right =
          dateIndex <
          dateHeaders.length -
            1
            ? dateHeaders[
                dateIndex + 1
              ].x - 2
            : Number
                .POSITIVE_INFINITY;

        const cellText =
          positioned
            .filter(
              (item) =>
                item.x >=
                  left &&
                item.x <
                  right &&
                item.y <=
                  topY &&
                item.y >
                  bottomY
            )
            .sort(
              (a, b) =>
                b.y -
                  a.y ||
                a.x -
                  b.x
            )
            .map(
              (item) =>
                item.text
            )
            .join(" ");

        const parsed =
          parsePdfCell(
            cellText,
            employee.text,
            jobTitle,
            dateHeaders[
              dateIndex
            ].date
          );

        if (parsed) {
          shifts.push(
            parsed
          );
        }
      }
    }
  }

  const dates =
    Array.from(
      dateSet
    ).sort();

  if (
    !shifts.length ||
    !dates.length
  ) {
    throw new Error(
      "No SchedulePop staffing rows were found in this PDF report."
    );
  }

  return {
    shifts,

    dateStart:
      dates[0],

    dateEnd:
      dates[
        dates.length - 1
      ],
  };
}

export default function SchedulePopImporter() {
  const router =
    useRouter();

  const [
    fileName,
    setFileName,
  ] =
    useState("");

  const [
    summary,
    setSummary,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    dragging,
    setDragging,
  ] =
    useState(false);

  async function importSelectedFile(
    file:
      | File
      | undefined
  ) {
    if (!file) {
      return;
    }

    setFileName(
      file.name
    );

    setSummary("");
    setError("");
    setUploading(true);

    try {
      const parsed =
        file.name
          .toLowerCase()
          .endsWith(".pdf")
          ? await parseSchedulePopPdf(
              file
            )
          : parseSchedulePopHtml(
              await file.text()
            );

      const response =
        await fetch(
          "/api/schedulepop/import",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                fileName:
                  file.name,

                ...parsed,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.error ||
            "Unable to import the SchedulePop report."
        );
      }

      setSummary(
        `${result.rowsImported} staffing records imported for ${parsed.dateStart} through ${parsed.dateEnd}.`
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to import the SchedulePop report."
      );
    } finally {
      setUploading(false);
    }
  }

  async function importFile(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    event.target.value =
      "";

    await importSelectedFile(
      file
    );
  }

  async function dropFile(
    event:
      DragEvent<HTMLLabelElement>
  ) {
    event.preventDefault();

    setDragging(false);

    await importSelectedFile(
      event.dataTransfer
        .files?.[0]
    );
  }

  return (
    <section className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] p-4 shadow-[var(--golfops-shadow)] sm:p-5">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--golfops-text-muted)]">
        Admin
      </div>

      <h2 className="mt-1 text-xl font-bold">
        SchedulePop Import
      </h2>

      <p className="mt-2 text-sm leading-6 text-[var(--golfops-text-muted)]">
        Upload the PDF you
        normally print from
        SchedulePop. HTML reports
        remain supported as a
        fallback. Parsing happens
        on this device and only
        normalized staffing
        records are sent to
        GolfOps.
      </p>

      <label
        onDragEnter={(
          event
        ) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(
          event
        ) =>
          event.preventDefault()
        }
        onDragLeave={() =>
          setDragging(false)
        }
        onDrop={dropFile}
        className={`mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-6 text-center transition ${
          dragging
            ? "border-[var(--golfops-accent)] bg-blue-50"
            : "border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] hover:border-[var(--golfops-accent)]"
        }`}
      >
        <span className="text-sm font-bold">
          {uploading
            ? "Importing..."
            : "Drop SchedulePop PDF here"}
        </span>

        {!uploading && (
          <span className="mt-1 text-xs text-[var(--golfops-text-muted)]">
            or click to choose a
            PDF or HTML report
          </span>
        )}

        <input
          type="file"
          accept=".pdf,.html,.htm,application/pdf,text/html"
          disabled={uploading}
          onChange={importFile}
          className="sr-only"
        />
      </label>

      {fileName && (
        <div className="mt-3 text-xs text-[var(--golfops-text-dim)]">
          {fileName}
        </div>
      )}

      {summary && (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {summary}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}