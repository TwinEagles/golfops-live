function getForeTeesSheetPageDetails() {
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

  const isLiveSheet =
    isProshopSheet &&
    !printValue &&
    url.searchParams.has(
      "index"
    );

  /*
    GolfOps Live can import:
    - the -ALL- report
    - a specific-course report
    - shotgun reports
  */

  return {
    isPrintReport:
      isProshopSheet &&
      isPrintReport,
    isLiveSheet
  };
}

function isForeTeesReportPage() {
  return getForeTeesSheetPageDetails()
    .isPrintReport;
}

function isForeTeesLiveSheetPage() {
  return getForeTeesSheetPageDetails()
    .isLiveSheet;
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
  MANUAL FORETEES REFRESH

  GolfOps never polls ForeTees automatically. When a staff member clicks
  Update from ForeTees on the GolfOps Tee Sheet, the extension retrieves one
  authenticated -ALL- Bag Report from the matching live ForeTees tee sheet and
  sends that single snapshot through the normal import pipeline.
*/

function getLiveBagReportUrl() {
  if (
    !isForeTeesLiveSheetPage()
  ) {
    return null;
  }

  const candidates =
    Array.from(
      document.querySelectorAll(
        "a[href*='print=report']"
      )
    )
      .map((link) => {
        try {
          return new URL(
            link.getAttribute(
              "href"
            ) || "",
            window.location.origin
          );
        } catch {
          return null;
        }
      })
      .filter(Boolean);

  const preferred =
    candidates.find(
      (url) =>
        url.searchParams.get(
          "course"
        ) === "-ALL-" &&
        url.searchParams.get(
          "double_line"
        ) === "1" &&
        url.searchParams.get(
          "fsz"
        ) === "2"
    ) ||
    candidates.find(
      (url) =>
        url.searchParams.get(
          "course"
        ) === "-ALL-" &&
        url.searchParams.get(
          "double_line"
        ) === "1"
    ) ||
    candidates.find(
      (url) =>
        url.searchParams.get(
          "course"
        ) === "-ALL-"
    );

  return preferred
    ?.toString() ||
    null;
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

function teeTimeTo24Hour(
  hourText,
  minuteText,
  meridiem
) {
  let hour = Number(hourText);

  if (
    !Number.isFinite(hour) ||
    hour < 1 ||
    hour > 12
  ) {
    return null;
  }

  const suffix =
    String(meridiem || "")
      .trim()
      .toUpperCase();

  if (suffix === "PM" && hour < 12) {
    hour += 12;
  } else if (suffix === "AM" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${minuteText}`;
}

function noteUrlFromElement(
  element
) {
  const candidates = [
    element.getAttribute?.("href"),
    element.getAttribute?.("onclick"),
    element.closest?.("a")?.getAttribute("href"),
    element.closest?.("a")?.getAttribute("onclick"),
    element.parentElement?.innerHTML
  ].filter(Boolean);

  for (const candidate of candidates) {
    const decoded = String(candidate)
      .replace(/&amp;/gi, "&")
      .replace(/\\u0026/gi, "&");

    const match = decoded.match(
      /((?:\/v5\/servlet\/)?Proshop_sheet\?[^"'\s)]+)/i
    );

    if (!match) {
      continue;
    }

    try {
      return new URL(
        match[1],
        window.location.origin
      );
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function noteTextFromHtml(html) {
  const parsed = new DOMParser()
    .parseFromString(
      html,
      "text/html"
    );

  const bodyText =
    parsed.body?.innerText ||
    parsed.body?.textContent ||
    "";

  const match = bodyText.match(
    /\bNotes?\s*:\s*([\s\S]*?)(?:\s+Close\s*$|$)/i
  );

  return (match?.[1] || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function collectForeTeesTeeTimeNotes() {
  const noteMarkers = Array.from(
    document.querySelectorAll(
      "a, button, td, span"
    )
  ).filter(
    (element) =>
      (element.textContent || "")
        .trim()
        .toUpperCase() === "N"
  );

  const candidates = [];
  let complete = true;

  for (const marker of noteMarkers) {
    const row = marker.closest("tr");
    const rowText =
      row?.innerText ||
      row?.textContent ||
      "";

    const timeMatch = rowText.match(
      /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i
    );

    const noteUrl = noteUrlFromElement(marker);

    if (!timeMatch || !noteUrl) {
      complete = false;
      continue;
    }

    const teeTime = teeTimeTo24Hour(
      timeMatch[1],
      timeMatch[2],
      timeMatch[3]
    );

    const course =
      noteUrl.searchParams.get("course") ||
      rowText.match(/\b(Eagle|Talon)\b/i)?.[1] ||
      "";

    if (!teeTime || !course) {
      complete = false;
      continue;
    }

    const key = `${teeTime}|${course.toLowerCase()}`;

    if (
      !candidates.some(
        (candidate) => candidate.key === key
      )
    ) {
      candidates.push({
        key,
        teeTime,
        course,
        url: noteUrl.toString()
      });
    }
  }

  const notes = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const response = await fetch(
          candidate.url,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          complete = false;
          return null;
        }

        const note = noteTextFromHtml(
          await response.text()
        );

        return note
          ? {
              teeTime: candidate.teeTime,
              course: candidate.course,
              note
            }
          : null;
      } catch (error) {
        complete = false;
        console.warn(
          "GolfOps Live could not read a ForeTees tee-time note:",
          error
        );
        return null;
      }
    })
  );

  return {
    notes: notes.filter(Boolean),
    complete
  };
}

function sendManualSnapshot(
  html,
  sheetDate,
  reportUrl,
  teeTimeNoteCapture
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
              reportUrl,
            sheetDate,
            teeTimeNotes:
              teeTimeNoteCapture.notes,
            teeTimeNotesComplete:
              teeTimeNoteCapture.complete,
            timezone:
              "America/New_York"
          }
        },

        (response) => {
          if (
            chrome.runtime
              .lastError
          ) {
            console.error(
              "GolfOps Live manual refresh extension error:",
              chrome.runtime
                .lastError
                .message
            );

            resolve({
              ok: false,
              error:
                chrome.runtime
                  .lastError
                  .message ||
                "Unable to contact the GolfOps extension."
            });
            return;
          }

          if (!response?.ok) {
            console.error(
              "GolfOps Live manual refresh import error:",
              response?.error ||
                "Unknown import error."
            );

            resolve({
              ok: false,
              error:
                response?.error ||
                "Tee sheet import failed."
            });
            return;
          }

          const changes =
            typeof response
              .changesDetected ===
            "number"
              ? response
                  .changesDetected
              : 0;

          resolve({
            ...response,
            ok: true,
            changesDetected:
              changes
          });
        }
      );
    }
  );
}

async function pullTeeSheetOnce(
  requestedDate
) {
  try {
    if (!isForeTeesLiveSheetPage()) {
      return {
        handled: false,
        ok: false
      };
    }

    const sheetDate =
      detectTeeSheetDate();

    const normalizedRequestedDate =
      normalizeLessonDate(
        requestedDate
      );

    if (
      !sheetDate ||
      !normalizedRequestedDate ||
      sheetDate !==
        normalizedRequestedDate
    ) {
      return {
        handled: false,
        ok: false,
        sheetDate
      };
    }

    const reportUrl =
      getLiveBagReportUrl();

    if (!reportUrl) {
      return {
        handled: true,
        ok: false,
        error:
          "GolfOps could not find the -ALL- Bag Report link on the open ForeTees tee sheet."
      };
    }

    const [response, teeTimeNoteCapture] =
      await Promise.all([
        fetch(
        reportUrl,
        {
          method: "GET",
          credentials:
            "include",
          cache: "no-store"
        }
        ),
        collectForeTeesTeeTimeNotes()
      ]);

    if (
      !response.ok ||
      response.redirected
    ) {
      return {
        handled: true,
        ok: false,
        error:
          `ForeTees could not return the Bag Report (${response.status}).`
      };
    }

    const html =
      await response.text();

    if (
      !monitoredReportLooksValid(
        html
      )
    ) {
      return {
        handled: true,
        ok: false,
        error:
          "ForeTees returned an invalid or expired Bag Report. Sign in again and retry."
      };
    }

    const result =
      await sendManualSnapshot(
        html,
        sheetDate,
        reportUrl,
        teeTimeNoteCapture
      );

    if (result.ok) {
      const lessonResult =
        await syncLessonsForDate(
          sheetDate
        );

      const changes =
        result.changesDetected ??
        0;

      showStatus(
        `GolfOps updated — ${changes} tee-sheet change${changes === 1 ? "" : "s"}${lessonResult.ok ? ` • ${lessonResult.lessonCount ?? 0} lesson${lessonResult.lessonCount === 1 ? "" : "s"}` : ""}.`,
        "success"
      );

      return {
        handled: true,
        ...result,
        lessonResult,
        sheetDate
      };
    }

    return {
      handled: true,
      ...result,
      sheetDate
    };
  } catch (error) {
    console.error(
      "GolfOps Live manual refresh error:",
      error
    );

    return {
      handled: true,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve the ForeTees Bag Report."
    };
  }
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
    !isForeTeesReportPage()
  ) {
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

        const changeText =
          changes !== null
            ? ` • ${changes} changes`
            : "";

        showStatus(
          `Import Successful — ${response.teeTimesFound} tee times / ${response.playersFound} players${changeText} • ${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`,
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

chrome.runtime.onMessage.addListener(
  (
    message,
    _sender,
    sendResponse
  ) => {
    if (
      message?.type !==
      "PULL_FORETEES_TEE_SHEET"
    ) {
      return false;
    }

    if (!isForeTeesLiveSheetPage()) {
      return false;
    }

    pullTeeSheetOnce(
      message.sheetDate
    )
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          handled: true,
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to update the GolfOps Tee Sheet."
        });
      });

    return true;
  }
);

/*
  Give ForeTees a moment to finish
  rendering the Print/Report page.
*/

window.setTimeout(
  sendTeeSheet,
  1500
);

/* No automatic ForeTees monitoring or polling is started. */
