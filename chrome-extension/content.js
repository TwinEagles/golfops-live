function isForeTeesTeeSheetPage() {
  const url =
    new URL(
      window.location.href
    );

  const path =
    url.pathname
      .toLowerCase();

  const isProshopSheet =
    path.includes(
      "/servlet/proshop_sheet"
    );

  const printValue =
    (
      url.searchParams.get(
        "print"
      ) || ""
    )
      .trim()
      .toLowerCase();

  const isPrintReport =
    printValue === "report";

  /*
    GolfOps Live can import:
    - the -ALL- report
    - a specific-course report
    - shotgun reports
  */

  return (
    isProshopSheet &&
    isPrintReport
  );
}

function showStatus(
  message,
  type = "normal"
) {
  let box =
    document.getElementById(
      "golfops-live-status"
    );

  if (!box) {
    box =
      document.createElement(
        "div"
      );

    box.id =
      "golfops-live-status";

    Object.assign(
      box.style,
      {
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: "999999",
        padding: "14px 18px",
        borderRadius: "10px",
        fontFamily:
          "Arial, sans-serif",
        fontSize: "14px",
        fontWeight: "600",
        color: "white",
        boxShadow:
          "0 4px 16px rgba(0,0,0,0.2)",
        maxWidth: "420px"
      }
    );

    document.body.appendChild(
      box
    );
  }

  box.textContent =
    message;

  if (
    type === "success"
  ) {
    box.style.background =
      "#15803d";
  } else if (
    type === "error"
  ) {
    box.style.background =
      "#b91c1c";
  } else {
    box.style.background =
      "#334155";
  }
}

/*
  Convert several possible ForeTees
  date formats to M/D/YYYY.
*/

function normalizeLessonDate(
  value
) {
  if (!value) {
    return null;
  }

  const clean =
    String(value).trim();

  /*
    YYYY-MM-DD
  */

  let match =
    clean.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (match) {
    return (
      Number(match[2]) +
      "/" +
      Number(match[3]) +
      "/" +
      match[1]
    );
  }

  /*
    M/D/YYYY
  */

  match =
    clean.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (match) {
    return (
      Number(match[1]) +
      "/" +
      Number(match[2]) +
      "/" +
      match[3]
    );
  }

  /*
    YYYYMMDD
  */

  match =
    clean.match(
      /^(\d{4})(\d{2})(\d{2})$/
    );

  if (match) {
    return (
      Number(match[2]) +
      "/" +
      Number(match[3]) +
      "/" +
      match[1]
    );
  }

  return null;
}

function detectTeeSheetDate() {
  const url =
    new URL(
      window.location.href
    );

  /*
    First check common URL
    parameters ForeTees may use.
  */

  const possibleParams = [
    "calDate",
    "date",
    "sheetDate"
  ];

  for (
    const paramName
    of possibleParams
  ) {
    const value =
      url.searchParams.get(
        paramName
      );

    const normalized =
      normalizeLessonDate(
        value
      );

    if (normalized) {
      return normalized;
    }
  }

  const html =
    document.documentElement
      .outerHTML;

  const bodyText =
    document.body?.innerText ||
    "";

  /*
    Date: 9/5/2026
  */

  let match =
    bodyText.match(
      /Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
    );

  if (match) {
    return normalizeLessonDate(
      match[1]
    );
  }

  /*
    Search raw HTML for YYYYMMDD
    style ForeTees dates.
  */

  match =
    html.match(
      /(?:date|calDate)\s*[=:]\s*["']?(\d{8})/i
    );

  if (match) {
    return normalizeLessonDate(
      match[1]
    );
  }

  /*
    Search raw HTML for M/D/YYYY.
  */

  match =
    html.match(
      /(?:Date|calDate)\s*[=:]\s*["']?(\d{1,2}\/\d{1,2}\/\d{4})/i
    );

  if (match) {
    return normalizeLessonDate(
      match[1]
    );
  }

  return null;
}

/*
  DAY-OF FORETEES MONITOR

  The open ForeTees Print/Report page acts as
  the authenticated source. Beginning on the
  displayed date, GolfOps checks that same
  report once per minute and sends it only when
  its visible tee-sheet rows have changed.
*/

const DAY_OF_MONITOR_INTERVAL_MS =
  60 * 1000;

let dayOfMonitorInFlight =
  false;

let lastDayOfSignature =
  null;

function easternToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        year: "numeric",
        month: "numeric",
        day: "numeric"
      }
    ).formatToParts(
      new Date()
    );

  const value =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value
        ]
      )
    );

  return (
    Number(value.month) +
    "/" +
    Number(value.day) +
    "/" +
    value.year
  );
}

function stableTeeSheetText(
  html
) {
  const documentCopy =
    new DOMParser()
      .parseFromString(
        html,
        "text/html"
      );

  documentCopy
    .querySelectorAll(
      "script, style, noscript, svg, link, meta, input[type='hidden']"
    )
    .forEach(
      (element) =>
        element.remove()
    );

  const rows =
    Array.from(
      documentCopy
        .querySelectorAll(
          "tr"
        )
    )
      .map(
        (row) =>
          (
            row.innerText ||
            row.textContent ||
            ""
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim()
      )
      .filter(Boolean);

  if (rows.length > 0) {
    return rows.join("\n");
  }

  return (
    documentCopy.body
      ?.textContent ||
    ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function teeSheetSignature(
  html
) {
  const text =
    stableTeeSheetText(
      html
    );

  let hash =
    2166136261;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash = Math.imul(
      hash,
      16777619
    );
  }

  return `${text.length}:${(
    hash >>> 0
  ).toString(16)}`;
}

function monitoredReportLooksValid(
  html
) {
  if (
    typeof html !== "string" ||
    html.length < 1000
  ) {
    return false;
  }

  const parsed =
    new DOMParser()
      .parseFromString(
        html,
        "text/html"
      );

  const rows =
    parsed.querySelectorAll(
      "tr"
    ).length;

  const text =
    (
      parsed.body
        ?.textContent ||
      ""
    ).toLowerCase();

  const looksLikeLogin =
    text.includes(
      "session expired"
    ) ||
    (
      text.includes("password") &&
      text.includes("log in")
    );

  return (
    rows > 1 &&
    !looksLikeLogin
  );
}

function sendDayOfSnapshot(
  html,
  sheetDate
) {
  return new Promise(
    (resolve) => {
      chrome.runtime.sendMessage(
        {
          type:
            "SEND_TEE_SHEET",

          payload: {
            html,
            source: "A",
            url:
              window.location.href,
            sheetDate,
            timezone:
              "America/New_York",
            monitorMode: true
          }
        },

        (response) => {
          if (
            chrome.runtime
              .lastError
          ) {
            console.error(
              "GolfOps Live day-of monitor extension error:",
              chrome.runtime
                .lastError
                .message
            );

            resolve(false);
            return;
          }

          if (!response?.ok) {
            console.error(
              "GolfOps Live day-of monitor import error:",
              response?.error ||
                "Unknown import error."
            );

            resolve(false);
            return;
          }

          const changes =
            typeof response
              .changesDetected ===
            "number"
              ? response
                  .changesDetected
              : 0;

          if (changes > 0) {
            showStatus(
              `GolfOps Changes updated — ${changes} day-of change${changes === 1 ? "" : "s"}.`,
              "success"
            );
          }

          console.log(
            "GolfOps Live day-of monitor:",
            changes,
            "change(s) detected."
          );

          resolve(true);
        }
      );
    }
  );
}

async function checkForDayOfChanges() {
  if (
    dayOfMonitorInFlight ||
    !isForeTeesTeeSheetPage()
  ) {
    return;
  }

  const sheetDate =
    detectTeeSheetDate();

  if (
    !sheetDate ||
    normalizeLessonDate(
      sheetDate
    ) !== easternToday()
  ) {
    return;
  }

  dayOfMonitorInFlight =
    true;

  try {
    const response =
      await fetch(
        window.location.href,
        {
          method: "GET",
          credentials:
            "include",
          cache: "no-store"
        }
      );

    if (
      !response.ok ||
      response.redirected
    ) {
      console.warn(
        "GolfOps Live day-of monitor could not refresh ForeTees:",
        response.status
      );
      return;
    }

    const html =
      await response.text();

    if (
      !monitoredReportLooksValid(
        html
      )
    ) {
      console.warn(
        "GolfOps Live day-of monitor ignored an invalid or expired ForeTees response."
      );
      return;
    }

    const signature =
      teeSheetSignature(
        html
      );

    if (
      signature ===
      lastDayOfSignature
    ) {
      return;
    }

    const sent =
      await sendDayOfSnapshot(
        html,
        sheetDate
      );

    if (sent) {
      lastDayOfSignature =
        signature;
    }
  } catch (error) {
    console.error(
      "GolfOps Live day-of monitor error:",
      error
    );
  } finally {
    dayOfMonitorInFlight =
      false;
  }
}

function startDayOfMonitor() {
  if (
    !isForeTeesTeeSheetPage()
  ) {
    return;
  }

  const sheetDate =
    detectTeeSheetDate();

  if (!sheetDate) {
    console.log(
      "GolfOps Live day-of monitor: unable to detect the displayed report date."
    );
    return;
  }

  lastDayOfSignature =
    teeSheetSignature(
      document
        .documentElement
        .outerHTML
    );

  const activeToday =
    normalizeLessonDate(
      sheetDate
    ) === easternToday();

  console.log(
    activeToday
      ? "GolfOps Live day-of monitor active for"
      : "GolfOps Live day-of monitor standing by until the displayed date begins:",
    sheetDate
  );

  window.setInterval(
    checkForDayOfChanges,
    DAY_OF_MONITOR_INTERVAL_MS
  );
}

async function syncLessonsForDate(
  lessonDate
) {
  if (!lessonDate) {
    return {
      ok: false,
      error:
        "GolfOps could not determine the tee sheet date for Lessons."
    };
  }

  try {
    showStatus(
      `Tee sheet imported. Syncing Lessons for ${lessonDate}...`
    );

    const lessonUrl =
      new URL(
        "/v5/servlet/Proshop_lesson",
        window.location.origin
      );

    lessonUrl.searchParams.set(
      "proid",
      "-1"
    );

    lessonUrl.searchParams.set(
      "calDate",
      lessonDate
    );

    console.log(
      "GolfOps Live: Fetching ForeTees lessons:",
      lessonUrl.toString()
    );

    const response =
      await fetch(
        lessonUrl.toString(),
        {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        }
      );

    if (!response.ok) {
      return {
        ok: false,
        error:
          `ForeTees Lesson Book returned ${response.status}.`
      };
    }

    const lessonHtml =
      await response.text();

    if (
      !lessonHtml ||
      !lessonHtml
        .toLowerCase()
        .includes(
          "proshop lesson book"
        )
    ) {
      console.error(
        "GolfOps Live: ForeTees lesson response did not look like a Lesson Book page."
      );

      return {
        ok: false,
        error:
          "ForeTees did not return the Lesson Book."
      };
    }

    return await new Promise(
      (resolve) => {
        chrome.runtime.sendMessage(
          {
            type:
              "SEND_LESSONS",

            payload: {
              html:
                lessonHtml,

              url:
                lessonUrl.toString(),

              timezone:
                "America/New_York"
            }
          },

          (lessonResponse) => {
            if (
              chrome.runtime
                .lastError
            ) {
              resolve({
                ok: false,
                error:
                  chrome.runtime
                    .lastError
                    .message ||
                  "Lesson extension error."
              });

              return;
            }

            if (
              lessonResponse?.ok
            ) {
              resolve({
                ok: true,
                lessonCount:
                  typeof lessonResponse
                    .lessonCount ===
                  "number"
                    ? lessonResponse
                        .lessonCount
                    : 0,

                lessonDate:
                  lessonResponse
                    .lessonDate ||
                  lessonDate
              });

              return;
            }

            resolve({
              ok: false,
              error:
                lessonResponse?.error ||
                "Lesson import failed."
            });
          }
        );
      }
    );
  } catch (error) {
    console.error(
      "GolfOps Live lesson sync error:",
      error
    );

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve ForeTees Lessons."
    };
  }
}

function sendTeeSheet() {
  if (
    !isForeTeesTeeSheetPage()
  ) {
    console.log(
      "GolfOps Live: This page is not a ForeTees Proshop Print/Report tee sheet.",
      window.location.href
    );

    return;
  }

  console.log(
    "GolfOps Live: ForeTees tee sheet detected."
  );

  const detectedDate =
    detectTeeSheetDate();

  console.log(
    "GolfOps Live: Detected tee sheet date:",
    detectedDate
  );

  showStatus(
    "Sending tee sheet to GolfOps Live..."
  );

  chrome.runtime.sendMessage(
    {
      type:
        "SEND_TEE_SHEET",

      payload: {
        html:
          document
            .documentElement
            .outerHTML,

        source:
          "A",

        url:
          window.location.href,

        sheetDate:
          detectedDate,

        timezone:
          "America/New_York"
      }
    },

    async (response) => {
      if (
        chrome.runtime
          .lastError
      ) {
        const errorMessage =
          chrome.runtime
            .lastError
            .message ||
          "Unknown extension error.";

        console.error(
          "GolfOps Live extension error:",
          errorMessage
        );

        showStatus(
          `Extension error: ${errorMessage}`,
          "error"
        );

        return;
      }

      if (
        !response?.ok
      ) {
        console.error(
          "GolfOps Live import response:",
          response
        );

        showStatus(
          response?.error ||
            "Tee sheet import failed.",
          "error"
        );

        return;
      }

      const changes =
        typeof response
          .changesDetected ===
        "number"
          ? response.changesDetected
          : null;

      /*
        Prefer the date returned
        by GolfOps if available.
      */

      const lessonDate =
        normalizeLessonDate(
          response.sheetDate ||
          response.date ||
          response.sheet_date
        ) ||
        detectedDate;

      const lessonResult =
        await syncLessonsForDate(
          lessonDate
        );

      if (
        lessonResult.ok
      ) {
        const lessonCount =
          lessonResult.lessonCount;

        const monitorText =
          normalizeLessonDate(
            lessonDate
          ) === easternToday()
            ? " • Day-of monitoring active"
            : "";

        const changeText =
          changes !== null
            ? ` • ${changes} changes`
            : "";

        showStatus(
          `Import Successful — ${response.teeTimesFound} tee times / ${response.playersFound} players${changeText} • ${lessonCount} lesson${lessonCount === 1 ? "" : "s"}${monitorText}`,
          "success"
        );

        console.log(
          "GolfOps Live: Tee sheet and Lessons synced successfully."
        );
      } else {
        /*
          Tee sheet was still successful,
          so do not label the entire
          operation as failed.
        */

        showStatus(
          `Tee Sheet Imported — ${response.teeTimesFound} tee times / ${response.playersFound} players • Lesson sync issue: ${lessonResult.error}`,
          "error"
        );

        console.error(
          "GolfOps Live lesson sync failed:",
          lessonResult.error
        );
      }
    }
  );
}

/*
  Give ForeTees a moment to finish
  rendering the Print/Report page.
*/

window.setTimeout(
  sendTeeSheet,
  1500
);

window.setTimeout(
  startDayOfMonitor,
  3000
);
