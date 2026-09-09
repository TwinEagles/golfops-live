(() => {
  const INSTALL_KEY =
    "__golfOpsPaceBridgeInstalled";

  const EXPECTED_SOURCE =
    "golfops-live-pace-main";

  const EXPECTED_TYPE =
    "GOLFOPS_PACE_STATUS";

  const MIN_SEND_INTERVAL_MS =
    20 * 1000;

  const HEARTBEAT_INTERVAL_MS =
    60 * 1000;

  if (window[INSTALL_KEY]) {
    return;
  }

  window[INSTALL_KEY] = true;

  let pendingPayload = null;
  let sendTimer = null;
  let sending = false;

  let lastSentAt = 0;
  let lastSignature = "";

  let showedSuccess = false;
  let showedError = false;

  function cleanText(
    value,
    maximumLength = 100
  ) {
    if (
      typeof value !==
        "string" &&
      typeof value !==
        "number"
    ) {
      return null;
    }

    const cleaned =
      String(value)
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (!cleaned) {
      return null;
    }

    return cleaned.slice(
      0,
      maximumLength
    );
  }

  function cleanCartNumber(
    value
  ) {
    const cleaned =
      cleanText(value, 40)
        ?.replace(
          /^cart\s*/i,
          ""
        )
        .trim()
        .toUpperCase() ?? "";

    if (
      !cleaned ||
      !/^[A-Z0-9_-]+$/.test(
        cleaned
      )
    ) {
      return null;
    }

    return cleaned;
  }

  function cleanNumber(
    value
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const numberValue =
      Number(value);

    if (
      !Number.isFinite(
        numberValue
      )
    ) {
      return null;
    }

    return numberValue;
  }

  function cleanInteger(
    value
  ) {
    const numberValue =
      cleanNumber(value);

    if (
      numberValue === null
    ) {
      return null;
    }

    return Math.trunc(
      numberValue
    );
  }

  function cleanBoolean(
    value
  ) {
    if (
      typeof value ===
      "boolean"
    ) {
      return value;
    }

    if (
      value === 1 ||
      value === "1" ||
      value === "true"
    ) {
      return true;
    }

    if (
      value === 0 ||
      value === "0" ||
      value === "false"
    ) {
      return false;
    }

    return null;
  }

  function cleanTimestamp(
    value
  ) {
    if (
      typeof value !==
        "string" ||
      !value.trim()
    ) {
      return null;
    }

    const timestamp =
      new Date(value);

    if (
      Number.isNaN(
        timestamp.getTime()
      )
    ) {
      return null;
    }

    return timestamp
      .toISOString();
  }

  function cleanPaceValue(
    value
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    try {
      const serialized =
        JSON.stringify(value);

      if (
        serialized.length >
        2000
      ) {
        return null;
      }

      return JSON.parse(
        serialized
      );
    } catch {
      return null;
    }
  }

  function sanitizeVehicle(
    vehicle
  ) {
    if (
      !vehicle ||
      typeof vehicle !==
        "object"
    ) {
      return null;
    }

    const cartNumber =
      cleanCartNumber(
        vehicle.cart_number
      );

    if (!cartNumber) {
      return null;
    }

    return {
      vehicle_id:
        cleanInteger(
          vehicle.vehicle_id
        ),

      cart_number:
        cartNumber,

      pace_label:
        cleanText(
          vehicle.pace_label,
          100
        ),

      course_id:
        cleanInteger(
          vehicle.course_id
        ),

      course_name:
        cleanText(
          vehicle.course_name,
          100
        ),

      hole_name:
        cleanText(
          vehicle.hole_name,
          100
        ),

      hole_short_name:
        cleanText(
          vehicle.hole_short_name,
          50
        ),

      hole_sequence:
        cleanInteger(
          vehicle.hole_sequence
        ),

      current_pace:
        cleanPaceValue(
          vehicle.current_pace
        ),

      pace_minutes:
        cleanInteger(
          vehicle.pace_minutes
        ),

      start_time:
        cleanTimestamp(
          vehicle.start_time
        ),

      estimated_finish_at:
        cleanTimestamp(
          vehicle
            .estimated_finish_at
        ),

      thru_holes:
        cleanInteger(
          vehicle.thru_holes
        ),

      is_online:
        cleanBoolean(
          vehicle.is_online
        ),

      is_in_play:
        cleanBoolean(
          vehicle.is_in_play
        ),

      is_available:
        cleanBoolean(
          vehicle.is_available
        ),

      is_charging:
        cleanBoolean(
          vehicle.is_charging
        ),

      gps_valid:
        cleanBoolean(
          vehicle.gps_valid
        ),

      needs_service:
        cleanBoolean(
          vehicle.needs_service
        ),

      position_at:
        cleanTimestamp(
          vehicle.position_at
        )
    };
  }

  function sanitizePayload(
    payload
  ) {
    if (
      !payload ||
      typeof payload !==
        "object" ||
      !Array.isArray(
        payload.vehicles
      )
    ) {
      return null;
    }

    const vehicles =
      payload.vehicles
        .slice(0, 250)
        .map(
          sanitizeVehicle
        )
        .filter(Boolean);

    if (
      vehicles.length === 0
    ) {
      return null;
    }

    return {
      source: "pace",

      site_id:
        cleanInteger(
          payload.site_id
        ),

      captured_at:
        cleanTimestamp(
          payload.captured_at
        ) ||
        new Date()
          .toISOString(),

      vehicles
    };
  }

  function createSignature(
    payload
  ) {
    return JSON.stringify(
      payload.vehicles.map(
        (vehicle) => [
          vehicle.cart_number,
          vehicle.pace_label,
          vehicle.course_id,
          vehicle.course_name,
          vehicle.hole_name,
          vehicle.hole_short_name,
          vehicle.hole_sequence,
          vehicle.current_pace,
          vehicle.start_time,
          vehicle.thru_holes,
          vehicle.is_online,
          vehicle.is_in_play,
          vehicle.is_available,
          vehicle.is_charging,
          vehicle.gps_valid,
          vehicle.needs_service,
          vehicle.position_at
        ]
      )
    );
  }

  function showStatus(
    message,
    kind
  ) {
    const existing =
      document.getElementById(
        "golfops-pace-status"
      );

    if (existing) {
      existing.remove();
    }

    const status =
      document.createElement(
        "div"
      );

    status.id =
      "golfops-pace-status";

    status.textContent =
      message;

    const isError =
      kind === "error";

    Object.assign(
      status.style,
      {
        position: "fixed",
        right: "18px",
        bottom: "18px",
        zIndex: "2147483647",
        maxWidth: "360px",
        padding:
          "13px 17px",
        borderRadius:
          "10px",
        background:
          isError
            ? "#b91c1c"
            : "#15803d",
        color: "#ffffff",
        fontFamily:
          "Arial, sans-serif",
        fontSize: "14px",
        fontWeight: "700",
        lineHeight: "1.35",
        boxShadow:
          "0 8px 24px rgba(0, 0, 0, 0.28)"
      }
    );

    document.documentElement
      .appendChild(
        status
      );

    window.setTimeout(
      () => {
        status.remove();
      },
      isError
        ? 10000
        : 6000
    );
  }

  function scheduleSend() {
    if (
      sendTimer ||
      sending ||
      !pendingPayload
    ) {
      return;
    }

    const elapsed =
      Date.now() -
      lastSentAt;

    const delay =
      Math.max(
        0,
        MIN_SEND_INTERVAL_MS -
          elapsed
      );

    sendTimer =
      window.setTimeout(
        () => {
          sendTimer = null;
          void sendPending();
        },
        delay
      );
  }

  async function sendPending() {
    if (
      sending ||
      !pendingPayload
    ) {
      return;
    }

    const payload =
      pendingPayload;

    pendingPayload = null;

    const signature =
      createSignature(
        payload
      );

    const unchanged =
      signature ===
      lastSignature;

    const heartbeatDue =
      Date.now() -
        lastSentAt >=
      HEARTBEAT_INTERVAL_MS;

    if (
      unchanged &&
      !heartbeatDue
    ) {
      return;
    }

    sending = true;

    try {
      const response =
        await new Promise(
          (resolve) => {
            chrome.runtime
              .sendMessage(
                {
                  type:
                    "SEND_PACE_STATUS",

                  payload
                },
                (result) => {
                  if (
                    chrome.runtime
                      .lastError
                  ) {
                    resolve({
                      ok: false,

                      error:
                        chrome.runtime
                          .lastError
                          .message
                    });

                    return;
                  }

                  resolve(
                    result || {
                      ok: false,
                      error:
                        "GolfOps Live did not respond."
                    }
                  );
                }
              );
          }
        );

      if (!response.ok) {
        throw new Error(
          response.error ||
            "Unable to send PACE status."
        );
      }

      lastSentAt =
        Date.now();

      lastSignature =
        signature;

      showedError = false;

      if (!showedSuccess) {
        showedSuccess = true;

        showStatus(
          `GolfOps connected to PACE · ${response.updated ?? payload.vehicles.length} carts synchronized.`,
          "success"
        );
      }
    } catch (error) {
      console.error(
        "GolfOps PACE sync error:",
        error
      );

      if (!showedError) {
        showedError = true;

        showStatus(
          error instanceof Error
            ? `GolfOps PACE sync failed: ${error.message}`
            : "GolfOps PACE sync failed.",
          "error"
        );
      }
    } finally {
      sending = false;

      if (pendingPayload) {
        scheduleSend();
      }
    }
  }

  window.addEventListener(
    "message",
    (event) => {
      if (
        event.source !== window ||
        event.origin !==
          window.location.origin
      ) {
        return;
      }

      const message =
        event.data;

      if (
        !message ||
        message.source !==
          EXPECTED_SOURCE ||
        message.type !==
          EXPECTED_TYPE
      ) {
        return;
      }

      const payload =
        sanitizePayload(
          message.payload
        );

      if (!payload) {
        return;
      }

      pendingPayload =
        payload;

      scheduleSend();
    }
  );
})();
