const APP_URL =
  "https://golfops-live.vercel.app";

const STORAGE_KEYS = [
  "access_token",
  "refresh_token",
  "expires_at",
  "user_email"
];

function getStoredSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      STORAGE_KEYS,
      (result) =>
        resolve(result || {})
    );
  });
}

function saveSession(session) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        access_token:
          session.access_token,

        refresh_token:
          session.refresh_token,

        expires_at:
          session.expires_at,

        user_email:
          session.user_email ??
          null
      },
      resolve
    );
  });
}

function clearSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      STORAGE_KEYS,
      resolve
    );
  });
}

function tokenExpiresSoon(
  expiresAt
) {
  if (!expiresAt) {
    return true;
  }

  const expiresAtMs =
    Number(expiresAt) * 1000;

  if (
    Number.isNaN(
      expiresAtMs
    )
  ) {
    return true;
  }

  return (
    Date.now() >=
    expiresAtMs -
      5 * 60 * 1000
  );
}

async function parseResponse(
  response
) {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    try {
      return await response.json();
    } catch {
      return {
        error:
          `GolfOps Live returned invalid JSON (${response.status}).`
      };
    }
  }

  const responseText =
    await response.text();

  if (
    responseText
      .trim()
      .startsWith("<")
  ) {
    return {
      error:
        `GolfOps Live returned an HTML response (${response.status}). Check that the API route exists.`
    };
  }

  return {
    error:
      responseText ||
      `Request failed (${response.status}).`
  };
}

async function refreshSession(
  refreshToken
) {
  if (!refreshToken) {
    throw new Error(
      "GolfOps Live extension is not signed in."
    );
  }

  const response =
    await fetch(
      `${APP_URL}/api/extension/refresh`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            refresh_token:
              refreshToken
          })
      }
    );

  const result =
    await parseResponse(
      response
    );

  if (
    !response.ok ||
    !result?.access_token ||
    !result?.refresh_token
  ) {
    throw new Error(
      result?.error ||
        `Unable to refresh GolfOps Live session (${response.status}).`
    );
  }

  const previousSession =
    await getStoredSession();

  await saveSession({
    access_token:
      result.access_token,

    refresh_token:
      result.refresh_token,

    expires_at:
      result.expires_at,

    user_email:
      result.user_email ??
      previousSession.user_email ??
      null
  });

  return result;
}

async function getValidAccessToken() {
  let session =
    await getStoredSession();

  if (
    !session.refresh_token
  ) {
    throw new Error(
      "GolfOps Live extension is not signed in."
    );
  }

  if (
    !session.access_token ||
    tokenExpiresSoon(
      session.expires_at
    )
  ) {
    session =
      await refreshSession(
        session.refresh_token
      );
  }

  return {
    accessToken:
      session.access_token,

    refreshToken:
      session.refresh_token
  };
}

async function sendAuthenticatedRequest(
  endpoint,
  payload
) {
  let session =
    await getStoredSession();

  if (
    !session.refresh_token
  ) {
    return {
      ok: false,
      error:
        "GolfOps Live extension is not signed in. Open Extension Options and sign in."
    };
  }

  let accessToken;

  try {
    const validSession =
      await getValidAccessToken();

    accessToken =
      validSession.accessToken;

    session =
      await getStoredSession();
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to refresh GolfOps Live extension login."
    };
  }

  function makeRequest(token) {
    return fetch(
      `${APP_URL}${endpoint}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );
  }

  let response =
    await makeRequest(
      accessToken
    );

  if (
    response.status === 401
  ) {
    try {
      const refreshed =
        await refreshSession(
          session.refresh_token
        );

      response =
        await makeRequest(
          refreshed.access_token
        );
    } catch {
      await clearSession();

      return {
        ok: false,
        error:
          "Your GolfOps Live extension session expired. Please sign in again."
      };
    }
  }

  const result =
    await parseResponse(
      response
    );

  if (!response.ok) {
    return {
      ok: false,
      error:
        result?.error ||
        `Import failed (${response.status}).`
    };
  }

  return {
    ok: true,
    ...result
  };
}

function isTrustedPaceSender(
  sender
) {
  const sourceUrl =
    sender?.url ||
    sender?.tab?.url ||
    "";

  try {
    const url =
      new URL(sourceUrl);

    return (
      url.protocol ===
        "https:" &&
      (
        url.hostname ===
          "www.tekgps.net" ||
        url.hostname ===
          "tekgps.net"
      )
    );
  } catch {
    return false;
  }
}

async function fetchSchedulePopReport(
  payload
) {
  try {
    const url =
      new URL(
        payload?.url || ""
      );

    if (
      url.protocol !==
        "https:" ||
      url.hostname !==
        "api.schedulepop.com" ||
      !url.pathname.includes(
        "/printableSchedule"
      )
    ) {
      return {
        ok: false,
        error:
          "Invalid SchedulePop report address."
      };
    }

    url.searchParams.set(
      "format",
      "HTML"
    );

    const response =
      await fetch(
        url.toString(),
        {
          method: "GET",
          cache: "no-store"
        }
      );

    if (!response.ok) {
      return {
        ok: false,
        error:
          `SchedulePop returned ${response.status}.`
      };
    }

    const html =
      await response.text();

    if (
      !html ||
      !html
        .toLowerCase()
        .includes(
          "schedule"
        )
    ) {
      return {
        ok: false,
        error:
          "SchedulePop did not return a printable schedule."
      };
    }

    return {
      ok: true,
      html
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve SchedulePop."
    };
  }
}

function isTrustedGolfOpsSender(
  sender
) {
  const sourceUrl =
    sender?.url ||
    sender?.tab?.url ||
    "";

  try {
    const url =
      new URL(sourceUrl);

    return (
      url.protocol === "https:" &&
      url.hostname ===
        "golfops-live.vercel.app"
    );
  } catch {
    return false;
  }
}

function isTrustedSchedulePopSender(sender) {
  const sourceUrl = sender?.url || sender?.tab?.url || "";
  try {
    const url = new URL(sourceUrl);
    return url.protocol === "https:" && url.hostname === "app.schedulepop.com";
  } catch {
    return false;
  }
}

function findSchedulePopTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: ["https://app.schedulepop.com/*"] }, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve(tabs || []);
    });
  });
}

function askSchedulePopTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "START_SCHEDULEPOP_PTO_SYNC" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, handled: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve({
        handled: true,
        ...(response || { ok: false, error: "SchedulePop did not return a TEAM PTO result." })
      });
    });
  });
}

async function pullSchedulePopPto() {
  const tabs = await findSchedulePopTabs();
  if (!tabs.length) {
    return {
      ok: false,
      error: "Open SchedulePop in Chrome, then try Sync from SchedulePop again."
    };
  }

  for (const tab of tabs) {
    if (!Number.isInteger(tab.id)) continue;
    const result = await askSchedulePopTab(tab.id);
    if (result?.handled) return result;
  }

  return {
    ok: false,
    error: "Reload the open SchedulePop tab so the current GolfOps extension can connect, then try again."
  };
}

function findForeTeesTabs() {
  return new Promise(
    (resolve) => {
      chrome.tabs.query(
        {
          url: [
            "https://web.foretees.com/*",
            "https://*.foretees.com/*"
          ]
        },
        (tabs) => {
          if (
            chrome.runtime.lastError
          ) {
            resolve([]);
            return;
          }

          resolve(tabs || []);
        }
      );
    }
  );
}

function askForeTeesTab(
  tabId,
  message
) {
  return new Promise(
    (resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        message,
        (response) => {
          if (
            chrome.runtime.lastError
          ) {
            resolve(null);
            return;
          }

          resolve(response || null);
        }
      );
    }
  );
}

async function collectOpenForeTeesNotes(
  sheetDate,
  suppliedTabs = null
) {
  const tabs =
    suppliedTabs ||
    await findForeTeesTabs();

  const responses =
    await Promise.all(
      tabs
        .filter(
          (tab) =>
            typeof tab.id === "number"
        )
        .map((tab) =>
          askForeTeesTab(
            tab.id,
            {
              type:
                "COLLECT_FORETEES_TEE_TIME_NOTES",
              sheetDate
            }
          )
        )
    );

  const handledResponses =
    responses.filter(
      (response) =>
        response?.handled
    );
  const successfulResponses =
    handledResponses.filter(
      (response) =>
        response?.ok
    );
  const notesByGroup = new Map();

  for (const response of successfulResponses) {
    for (const note of response.notes || []) {
      const teeTime =
        String(note?.teeTime || "").trim();
      const course =
        String(note?.course || "").trim();
      const text =
        String(note?.note || "").trim();

      if (!teeTime || !course || !text) {
        continue;
      }

      notesByGroup.set(
        `${teeTime}|${course.toLowerCase()}`,
        {
          teeTime,
          course,
          note: text
        }
      );
    }
  }

  return {
    hasMatchingTabs:
      handledResponses.length > 0,
    notes: Array.from(
      notesByGroup.values()
    ),
    complete:
      handledResponses.length > 0 &&
      handledResponses.every(
        (response) =>
          response?.ok &&
          response.complete === true
      ),
    markersFound:
      successfulResponses.reduce(
        (total, response) =>
          total +
          Number(
            response.markersFound || 0
          ),
        0
      ),
    candidatesFound:
      successfulResponses.reduce(
        (total, response) =>
          total +
          Number(
            response.candidatesFound || 0
          ),
        0
      ),
    documentsScanned:
      successfulResponses.reduce(
        (total, response) =>
          total +
          Number(
            response.documentsScanned || 0
          ),
        0
      )
  };
}

async function sendTeeSheetWithOpenNotes(
  payload
) {
  const openTabCapture =
    await collectOpenForeTeesNotes(
      payload?.sheetDate
    );

  const enhancedPayload =
    openTabCapture.hasMatchingTabs
      ? {
          ...payload,
          teeTimeNotes:
            openTabCapture.notes,
          teeTimeNotesComplete:
            openTabCapture.complete
        }
      : payload;

  return sendAuthenticatedRequest(
    "/api/import/extension",
    enhancedPayload
  );
}

async function pullForeTeesTeeSheet(
  sheetDate
) {
  const tabs =
    await findForeTeesTabs();

  if (tabs.length === 0) {
    return {
      ok: false,
      error:
        "Open the matching live tee sheet in ForeTees on this computer, then try again."
    };
  }

  const teeTimeNoteCapture =
    await collectOpenForeTeesNotes(
      sheetDate,
      tabs
    );

  for (const tab of tabs) {
    if (
      typeof tab.id !== "number"
    ) {
      continue;
    }

    const result =
      await askForeTeesTab(
        tab.id,
        {
          type:
            "PULL_FORETEES_TEE_SHEET",
          sheetDate,
          teeTimeNoteCapture:
            teeTimeNoteCapture
              .hasMatchingTabs
              ? teeTimeNoteCapture
              : null
        }
      );

    if (result?.handled) {
      return result;
    }
  }

  return {
    ok: false,
    error:
      "Open the live ForeTees tee sheet for the selected GolfOps date, then try again."
  };
}

chrome.runtime.onMessage.addListener(
  (
    message,
    sender,
    sendResponse
  ) => {
    let operation = null;

    if (
      message?.type ===
      "SEND_TEE_SHEET"
    ) {
      operation =
        sendTeeSheetWithOpenNotes(
          message.payload
        );
    } else if (
      message?.type ===
      "PULL_FORETEES_TEE_SHEET"
    ) {
      if (
        !isTrustedGolfOpsSender(
          sender
        )
      ) {
        operation =
          Promise.resolve({
            ok: false,
            error:
              "The manual ForeTees refresh request was rejected."
          });
      } else {
        operation =
          pullForeTeesTeeSheet(
            message.sheetDate
          );
      }
    } else if (
      message?.type ===
      "SEND_LESSONS"
    ) {
      operation =
        sendAuthenticatedRequest(
          "/api/lessons/import",
          message.payload
        );
    } else if (
      message?.type ===
      "SEND_SCHEDULEPOP"
    ) {
      operation =
        sendAuthenticatedRequest(
          "/api/schedulepop/extension",
          message.payload
        );
    } else if (
      message?.type ===
      "SEND_SCHEDULEPOP_PTO"
    ) {
      if (
        !isTrustedSchedulePopSender(
          sender
        )
      ) {
        operation =
          Promise.resolve({
            ok: false,
            error:
              "TEAM PTO was rejected because it did not originate from SchedulePop."
          });
      } else {
        operation =
          sendAuthenticatedRequest(
            "/api/schedulepop/pto/extension",
            message.payload
          );
      }
    } else if (
      message?.type ===
      "PULL_SCHEDULEPOP_PTO"
    ) {
      if (
        !isTrustedGolfOpsSender(
          sender
        )
      ) {
        operation =
          Promise.resolve({
            ok: false,
            error:
              "The TEAM PTO sync request was rejected."
          });
      } else {
        operation =
          pullSchedulePopPto();
      }
    } else if (
      message?.type ===
      "SEND_FORETEES_BAG_MEMBER"
    ) {
      operation =
        sendAuthenticatedRequest(
          "/api/bag-finder/foretees-sync",
          message.payload
        );
    } else if (
      message?.type ===
      "SEND_PACE_STATUS"
    ) {
      if (
        !isTrustedPaceSender(
          sender
        )
      ) {
        operation =
          Promise.resolve({
            ok: false,
            error:
              "PACE update was rejected because it did not originate from PACE."
          });
      } else {
        operation =
          sendAuthenticatedRequest(
            "/api/pace/extension",
            message.payload
          );
      }
    } else if (
      message?.type ===
      "FETCH_SCHEDULEPOP_REPORT"
    ) {
      operation =
        fetchSchedulePopReport(
          message.payload
        );
    } else if (
      message?.type ===
      "CHECK_AUTH"
    ) {
      operation =
        getStoredSession()
          .then(
            (session) => ({
              ok: true,

              signedIn:
                Boolean(
                  session
                    .refresh_token
                ),

              user_email:
                session.user_email ||
                null,

              expires_at:
                session.expires_at ||
                null
            })
          );
    }

    if (!operation) {
      return false;
    }

    operation
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,

          error:
            error instanceof Error
              ? error.message
              : "Unknown extension error."
        });
      });

    return true;
  }
);

/*
  Detect SchedulePop printable
  schedule requests directly
  through Chrome.
*/

chrome.webRequest
  .onBeforeRequest
  .addListener(
    (details) => {
      if (
        details.tabId < 0
      ) {
        return;
      }

      chrome.tabs.sendMessage(
        details.tabId,
        {
          type:
            "SCHEDULEPOP_REPORT_DETECTED",

          url:
            details.url
        },
        () => {
          /*
            Ignore pages that do not
            contain the SchedulePop
            content script.
          */

          void chrome.runtime
            .lastError;
        }
      );
    },
    {
      urls: [
        "https://api.schedulepop.com/api/rest/admin/locations/*/printableSchedule*"
      ]
    }
  );
