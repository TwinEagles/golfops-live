const SCHEDULEPOP_EVENT =
  "golfops-schedulepop-report";

const processedReports =
  new Set();

let lastReportUrl = "";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function showSchedulePopStatus(
  message,
  type = "normal"
) {
  let box =
    document.getElementById(
      "golfops-schedulepop-status"
    );

  if (!box) {
    box =
      document.createElement(
        "div"
      );

    box.id =
      "golfops-schedulepop-status";

    Object.assign(
      box.style,
      {
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: "2147483647",
        padding: "14px 18px",
        borderRadius: "10px",
        fontFamily:
          "Arial, sans-serif",
        fontSize: "14px",
        fontWeight: "600",
        color: "white",
        boxShadow:
          "0 4px 16px rgba(0,0,0,0.25)",
        maxWidth: "420px"
      }
    );

    document.documentElement
      .appendChild(box);
  }

  box.textContent =
    message;

  box.style.background =
    type === "success"
      ? "#15803d"
      : type === "error"
        ? "#b91c1c"
        : "#334155";
}

function isoDate(
  header,
  year
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
    ).padStart(2, "0")
  ].join("-");
}

function parseSchedulePopHtml(
  rawHtml,
  reportUrl
) {
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

  const url =
    new URL(reportUrl);

  const urlYear =
    url.searchParams
      .get("startDate")
      ?.match(/^(20\d{2})/);

  const titleYear =
    title.match(
      /\b(20\d{2})\b/
    );

  const year =
    Number(
      urlYear?.[1] ??
      titleYear?.[1] ??
      new Date().getFullYear()
    );

  const shifts = [];
  const dates =
    new Set();

  for (
    const table of
    documentNode.querySelectorAll(
      "table.report.schedule"
    )
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
            header.textContent,
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

    for (
      const row of
      table.querySelectorAll(
        "tbody tr"
      )
    ) {
      const cells =
        Array.from(
          row.children
        ).filter(
          (node) =>
            node.tagName === "TD"
        );

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
        index < cells.length &&
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
          cells[index]
            .querySelectorAll(
              ".job-info"
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
              block.querySelector(
                ".start-end"
              )?.textContent
            );

          if (!rangeText) {
            const lower =
              allText
                .toLowerCase();

            const status =
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
              notes: allText
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
                : null
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
      "No staffing rows were found in the SchedulePop report."
    );
  }

  return {
    shifts,

    dateStart:
      sortedDates[0],

    dateEnd:
      sortedDates[
        sortedDates.length - 1
      ]
  };
}

function sendMessage(
  message
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      chrome.runtime.sendMessage(
        message,
        (response) => {
          if (
            chrome.runtime
              .lastError
          ) {
            reject(
              new Error(
                chrome.runtime
                  .lastError
                  .message
              )
            );

            return;
          }

          resolve(response);
        }
      );
    }
  );
}

async function importSchedule(
  reportUrl,
  force = false
) {
  let url;

  try {
    url =
      new URL(
        reportUrl
      );
  } catch {
    return;
  }

  if (
    url.hostname !==
      "api.schedulepop.com" ||
    !url.pathname.includes(
      "/printableSchedule"
    ) ||
    url.searchParams.get(
      "printJob"
    ) !== "schedule"
  ) {
    return;
  }

  const format =
    (
      url.searchParams.get(
        "format"
      ) || ""
    ).toUpperCase();

  if (
    format !== "PDF" &&
    format !== "HTML"
  ) {
    return;
  }

  lastReportUrl =
    url.toString();

  const reportKey = [
    url.searchParams.get(
      "scheduleId"
    ),

    url.searchParams.get(
      "startDate"
    ),

    url.searchParams.get(
      "endDate"
    )
  ].join("|");

  if (
    !force &&
    processedReports.has(
      reportKey
    )
  ) {
    return;
  }

  processedReports.add(
    reportKey
  );

  try {
    showSchedulePopStatus(
      "Sending published schedule to GolfOps Live..."
    );

    url.searchParams.set(
      "format",
      "HTML"
    );

    const fetched =
      await sendMessage({
        type:
          "FETCH_SCHEDULEPOP_REPORT",

        payload: {
          url:
            url.toString()
        }
      });

    if (
      !fetched?.ok ||
      !fetched.html
    ) {
      throw new Error(
        fetched?.error ||
        "SchedulePop did not return the printable schedule."
      );
    }

    const parsed =
      parseSchedulePopHtml(
        fetched.html,
        url.toString()
      );

    const result =
      await sendMessage({
        type:
          "SEND_SCHEDULEPOP",

        payload: {
          fileName:
            `SchedulePop ${parsed.dateStart} to ${parsed.dateEnd}`,

          ...parsed
        }
      });

    if (!result?.ok) {
      throw new Error(
        result?.error ||
        "SchedulePop import failed."
      );
    }

    showSchedulePopStatus(
      `GolfOps updated — ${result.rowsImported} staffing records imported for ${parsed.dateStart} through ${parsed.dateEnd}.`,
      "success"
    );
  } catch (error) {
    processedReports.delete(
      reportKey
    );

    showSchedulePopStatus(
      error instanceof Error
        ? error.message
        : "Unable to import the SchedulePop schedule.",
      "error"
    );
  }
}

function addSyncButton() {
  if (
    document.getElementById(
      "golfops-schedulepop-sync"
    )
  ) {
    return;
  }

  const button =
    document.createElement(
      "button"
    );

  button.id =
    "golfops-schedulepop-sync";

  button.type =
    "button";

  button.textContent =
    "Send to GolfOps";

  Object.assign(
    button.style,
    {
      position: "fixed",
      right: "20px",
      bottom: "74px",
      zIndex:
        "2147483646",
      padding:
        "11px 16px",
      border: "0",
      borderRadius:
        "8px",
      background:
        "#2563eb",
      color: "white",
      fontFamily:
        "Arial, sans-serif",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow:
        "0 4px 14px rgba(0,0,0,0.22)"
    }
  );

  button.addEventListener(
    "click",
    () => {
      if (!lastReportUrl) {
        showSchedulePopStatus(
          "Use SchedulePop Print and choose PDF or HTML once. GolfOps will then import that schedule automatically.",
          "error"
        );

        return;
      }

      importSchedule(
        lastReportUrl,
        true
      );
    }
  );

  document.documentElement
    .appendChild(button);
}

window.addEventListener(
  SCHEDULEPOP_EVENT,
  (event) => {
    if (
      typeof event.detail ===
      "string"
    ) {
      importSchedule(
        event.detail
      );
    }
  }
);

const observer =
  new PerformanceObserver(
    (list) => {
      for (
        const entry of
        list.getEntries()
      ) {
        importSchedule(
          entry.name
        );
      }
    }
  );

observer.observe({
  type: "resource",
  buffered: true
});

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    addSyncButton,
    {
      once: true
    }
  );
} else {
  addSyncButton();
}
/*
  Receive SchedulePop report URLs
  detected by the background worker.
*/

chrome.runtime.onMessage
  .addListener(
    (
      message,
      sender,
      sendResponse
    ) => {
      if (
        message?.type !==
        "SCHEDULEPOP_REPORT_DETECTED"
      ) {
        return false;
      }

      if (
        typeof message.url ===
        "string"
      ) {
        importSchedule(
          message.url
        );
      }

      sendResponse({
        ok: true
      });

      return false;
    }
  );