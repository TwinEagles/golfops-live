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
        sendAuthenticatedRequest(
          "/api/import/extension",
          message.payload
        );
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