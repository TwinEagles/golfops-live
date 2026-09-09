(() => {
  const INSTALL_KEY =
    "__golfOpsPaceMainInstalled";

  const VEHICLES_PATH =
    "/api/MainDataVeh/VehiclesData";

  const PACE_SITE_ID = 1809;

  const REFRESH_CHECK_MS =
    30 * 1000;

  const MAX_DATA_AGE_MS =
    60 * 1000;

  if (window[INSTALL_KEY]) {
    return;
  }

  window[INSTALL_KEY] = true;

  let lastCaptureAt = 0;
  let refreshInProgress = false;

  function isVehiclesDataUrl(
    value
  ) {
    if (!value) {
      return false;
    }

    try {
      const url =
        new URL(
          String(value),
          window.location.href
        );

      return (
        url.origin ===
          window.location.origin &&
        url.pathname ===
          VEHICLES_PATH
      );
    } catch {
      return false;
    }
  }

  function firstDefined(
    ...values
  ) {
    for (
      const value of values
    ) {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    return null;
  }

  function cleanCartNumber(
    vehicle
  ) {
    const rawValue =
      firstDefined(
        vehicle?.ShortName,
        vehicle?.ShLbl,
        vehicle?.Label,
        vehicle?.Name
      );

    if (
      typeof rawValue !==
        "string" &&
      typeof rawValue !==
        "number"
    ) {
      return null;
    }

    const cleaned =
      String(rawValue)
        .trim()
        .replace(
          /^cart\s*/i,
          ""
        )
        .trim()
        .toUpperCase();

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
        vehicle
      );

    if (!cartNumber) {
      return null;
    }

    return {
      vehicle_id:
        firstDefined(
          vehicle.Id,
          vehicle.VehicleId
        ),

      cart_number:
        cartNumber,

      pace_label:
        firstDefined(
          vehicle.Label,
          vehicle.DriverName,
          vehicle.PassengerName
        ),

      course_id:
        firstDefined(
          vehicle.CurrentCourseId,
          vehicle
            .CurrentHoleDetailsName_CourseId,
          vehicle.CourseId
        ),

      course_name:
        firstDefined(
          vehicle.CurrentCourseName,
          vehicle.CourseName,
          vehicle
            .CurrentHoleDetailsCourseName,
          vehicle
            .CurrentCourse
            ?.Name
        ),

      hole_name:
        firstDefined(
          vehicle
            .CurrentHoleDetailsName,
          vehicle.CurrentHoleName
        ),

      hole_short_name:
        firstDefined(
          vehicle
            .CurrentHoleDetailsShortName,
          vehicle
            .CurrentHoleShortName
        ),

      hole_sequence:
        firstDefined(
          vehicle
            .CurrentHoleDetailsName_Sequence,
          vehicle.CurrentHoleSequence
        ),

      /*
        The precise live shape
        will be confirmed when a
        cart is on the course.
      */

      current_pace:
        firstDefined(
          vehicle.CurrentPace,
          vehicle.Pace
        ),

      pace_minutes: null,

      start_time:
        firstDefined(
          vehicle.StartTime,
          vehicle.StartTimeTS
        ),

      estimated_finish_at:
        firstDefined(
          vehicle
            .EstimatedFinishTime,
          vehicle
            .EstimatedFinishAt
        ),

      thru_holes:
        firstDefined(
          vehicle.ThruHoles,
          vehicle.HolesCompleted
        ),

      is_online:
        cleanBoolean(
          vehicle.IsOnline
        ),

      is_in_play:
        cleanBoolean(
          firstDefined(
            vehicle.GroupIsInPlay,
            vehicle.IsInPlay
          )
        ),

      is_available:
        cleanBoolean(
          vehicle.IsAvailable
        ),

      is_charging:
        cleanBoolean(
          vehicle.IsCharging
        ),

      gps_valid:
        cleanBoolean(
          firstDefined(
            vehicle.IsGpsValid,
            vehicle.IsGPSValid
          )
        ),

      needs_service:
        cleanBoolean(
          firstDefined(
            vehicle.NeedService,
            vehicle.NeedsService
          )
        ),

      position_at:
        firstDefined(
          vehicle.PositionTimestamp,
          vehicle.PositionTimestampG,
          vehicle.TimestampLocal
        )
    };
  }

  function findVehicleArray(
    response
  ) {
    const candidates = [
      response?.results?.Vehicles,
      response?.results?.vehicles,
      response?.Vehicles,
      response?.vehicles
    ];

    for (
      const candidate of
        candidates
    ) {
      if (
        Array.isArray(
          candidate
        )
      ) {
        return candidate;
      }
    }

    return null;
  }

  function processResponse(
    response
  ) {
    const vehicleArray =
      findVehicleArray(
        response
      );

    if (
      !vehicleArray ||
      vehicleArray.length === 0
    ) {
      return;
    }

    const vehicles =
      vehicleArray
        .map(
          sanitizeVehicle
        )
        .filter(Boolean);

    if (
      vehicles.length === 0
    ) {
      return;
    }

    lastCaptureAt =
      Date.now();

    /*
      postMessage crosses from
      the MAIN execution world
      to pace.js in the isolated
      extension world.

      Only sanitized operational
      fields are included.
    */

    window.postMessage(
      {
        source:
          "golfops-live-pace-main",

        type:
          "GOLFOPS_PACE_STATUS",

        payload: {
          source:
            "pace",

          site_id:
            PACE_SITE_ID,

          captured_at:
            new Date()
              .toISOString(),

          vehicles
        }
      },
      window.location.origin
    );
  }

  function processResponseText(
    responseText
  ) {
    if (
      typeof responseText !==
        "string" ||
      !responseText.trim()
    ) {
      return;
    }

    try {
      processResponse(
        JSON.parse(
          responseText
        )
      );
    } catch {
      /*
        Ignore HTML login pages,
        incomplete responses and
        non-JSON responses.
      */
    }
  }

  /*
    Capture the VehiclesData
    request that PACE already
    makes through jQuery/XHR.
  */

  const originalOpen =
    XMLHttpRequest
      .prototype
      .open;

  const originalSend =
    XMLHttpRequest
      .prototype
      .send;

  XMLHttpRequest
    .prototype
    .open =
    function (
      method,
      url,
      ...rest
    ) {
      this
        .__golfOpsPaceUrl =
        url;

      return originalOpen.call(
        this,
        method,
        url,
        ...rest
      );
    };

  XMLHttpRequest
    .prototype
    .send =
    function (...args) {
      if (
        isVehiclesDataUrl(
          this
            .__golfOpsPaceUrl
        )
      ) {
        this.addEventListener(
          "load",
          () => {
            if (
              this.status < 200 ||
              this.status >= 300
            ) {
              return;
            }

            try {
              if (
                this.responseType ===
                  "json" &&
                this.response
              ) {
                processResponse(
                  this.response
                );

                return;
              }

              processResponseText(
                this.responseText
              );
            } catch {
              /*
                A response type may
                prevent access to
                responseText. Ignore
                it and allow the next
                refresh to run.
              */
            }
          },
          {
            once: true
          }
        );
      }

      return originalSend.apply(
        this,
        args
      );
    };

  /*
    If PACE has not refreshed
    VehiclesData during the last
    minute, make one same-origin,
    read-only status request.

    This is at most one request
    per minute while the PACE
    page remains open.
  */

  async function refreshVehicles() {
    if (
      refreshInProgress ||
      Date.now() -
        lastCaptureAt <
        MAX_DATA_AGE_MS
    ) {
      return;
    }

    refreshInProgress = true;

    try {
      const response =
        await fetch(
          VEHICLES_PATH,
          {
            method: "POST",

            credentials:
              "same-origin",

            cache:
              "no-store",

            headers: {
              "Accept":
                "application/json, text/javascript, */*; q=0.01",

              "Content-Type":
                "application/json; charset=UTF-8",

              "X-Requested-With":
                "XMLHttpRequest"
            },

            body:
              JSON.stringify({
                action:
                  "vehiclesData",

                siteId:
                  PACE_SITE_ID,

                siteHasADA:
                  false
              })
          }
        );

      if (!response.ok) {
        return;
      }

      const result =
        await response.json();

      processResponse(
        result
      );
    } catch {
      /*
        PACE may be signed out,
        offline or temporarily
        unavailable. The next
        interval will retry.
      */
    } finally {
      refreshInProgress = false;
    }
  }

  window.setInterval(
    refreshVehicles,
    REFRESH_CHECK_MS
  );

  /*
    Give the normal PACE page
    request time to run first.
  */

  window.setTimeout(
    refreshVehicles,
    15 * 1000
  );
})();
