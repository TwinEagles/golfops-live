const APP_URL =
  "http://localhost:3000";

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
      (result) => {
        resolve(result || {});
      }
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
          session.user_email ?? null
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

function tokenExpiresSoon(expiresAt) {
  if (!expiresAt) {
    return true;
  }

  const expiresAtMs =
    Number(expiresAt) * 1000;

  if (
    Number.isNaN(expiresAtMs)
  ) {
    return true;
  }

  const fiveMinutes =
    5 * 60 * 1000;

  return (
    Date.now() >=
    expiresAtMs - fiveMinutes
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

  const text =
    await response.text();

  if (
    text.trim().startsWith("<")
  ) {
    return {
      error:
        `GolfOps Live returned an HTML response (${response.status}). Check that the local app is running and the API route exists.`
    };
  }

  return {
    error:
      text ||
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

        body: JSON.stringify({
          refresh_token:
            refreshToken
        })
      }
    );

  const result =
    await parseResponse(response);

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

  if (!session.refresh_token) {
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

  if (!session.refresh_token) {
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
    console.error(
      "Unable to obtain GolfOps Live extension session:",
      error
    );

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to refresh GolfOps Live extension login."
    };
  }

  async function makeRequest(
    token
  ) {
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
          JSON.stringify(payload)
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
    } catch (error) {
      console.error(
        "GolfOps Live automatic login refresh failed:",
        error
      );

      await clearSession();

      return {
        ok: false,
        error:
          "Your GolfOps Live extension session expired. Please sign in again."
      };
    }
  }

  const result =
    await parseResponse(response);

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

async function sendTeeSheet(
  payload
) {
  return sendAuthenticatedRequest(
    "/api/import/extension",
    payload
  );
}

async function sendLessons(
  payload
) {
  return sendAuthenticatedRequest(
    "/api/lessons/import",
    payload
  );
}

chrome.runtime.onMessage.addListener(
  (
    message,
    sender,
    sendResponse
  ) => {
    if (
      message?.type ===
      "SEND_TEE_SHEET"
    ) {
      sendTeeSheet(
        message.payload
      )
        .then(sendResponse)
        .catch(
          (error) => {
            console.error(
              "GolfOps Live tee sheet background error:",
              error
            );

            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown extension error."
            });
          }
        );

      return true;
    }

    if (
      message?.type ===
      "SEND_LESSONS"
    ) {
      sendLessons(
        message.payload
      )
        .then(sendResponse)
        .catch(
          (error) => {
            console.error(
              "GolfOps Live lesson background error:",
              error
            );

            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown extension error."
            });
          }
        );

      return true;
    }

    if (
      message?.type ===
      "CHECK_AUTH"
    ) {
      getStoredSession()
        .then(
          (session) => {
            sendResponse({
              ok: true,

              signedIn:
                Boolean(
                  session.refresh_token
                ),

              user_email:
                session.user_email ||
                null,

              expires_at:
                session.expires_at ||
                null
            });
          }
        );

      return true;
    }

    return false;
  }
);