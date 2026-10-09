const PAGE_SOURCE =
  "golfops-live-page";

const EXTENSION_SOURCE =
  "golfops-live-extension";

window.addEventListener(
  "message",
  (event) => {
    if (
      event.source !== window ||
      event.origin !==
        window.location.origin ||
      event.data?.source !==
        PAGE_SOURCE ||
      event.data?.type !==
        "PULL_FORETEES_TEE_SHEET"
    ) {
      return;
    }

    const requestId =
      event.data.requestId;

    const sheetDate =
      event.data.sheetDate;

    if (
      typeof requestId !== "string" ||
      typeof sheetDate !== "string"
    ) {
      return;
    }

    window.postMessage(
      {
        source:
          EXTENSION_SOURCE,
        type:
          "FORETEES_REFRESH_ACK",
        requestId
      },
      window.location.origin
    );

    chrome.runtime.sendMessage(
      {
        type:
          "PULL_FORETEES_TEE_SHEET",
        sheetDate
      },
      (response) => {
        const result =
          chrome.runtime.lastError
            ? {
                ok: false,
                error:
                  chrome.runtime
                    .lastError
                    .message ||
                  "Unable to contact the GolfOps extension."
              }
            : response || {
                ok: false,
                error:
                  "The GolfOps extension did not return a refresh result."
              };

        window.postMessage(
          {
            source:
              EXTENSION_SOURCE,
            type:
              "FORETEES_REFRESH_RESULT",
            requestId,
            result
          },
          window.location.origin
        );
      }
    );
  }
);

window.addEventListener(
  "message",
  (event) => {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      event.data?.source !== PAGE_SOURCE ||
      event.data?.type !== "PULL_SCHEDULEPOP_PTO" ||
      typeof event.data?.requestId !== "string"
    ) {
      return;
    }

    const requestId = event.data.requestId;

    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        type: "SCHEDULEPOP_PTO_SYNC_ACK",
        requestId
      },
      window.location.origin
    );

    chrome.runtime.sendMessage(
      {
        type: "PULL_SCHEDULEPOP_PTO"
      },
      (response) => {
        const result = chrome.runtime.lastError
          ? {
              ok: false,
              error: chrome.runtime.lastError.message || "Unable to contact the GolfOps extension."
            }
          : response || {
              ok: false,
              error: "The GolfOps extension did not return a TEAM PTO result."
            };

        window.postMessage(
          {
            source: EXTENSION_SOURCE,
            type: "SCHEDULEPOP_PTO_SYNC_RESULT",
            requestId,
            result
          },
          window.location.origin
        );
      }
    );
  }
);
