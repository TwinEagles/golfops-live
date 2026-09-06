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

/*
  Give ForeTees a moment to finish
  rendering the Print/Report page.
*/

window.setTimeout(
  sendTeeSheet,
  1500
);
