export type PaceCartStatus = {
  cart_number: string;
  pace_vehicle_id:
    | number
    | null;

  course_id:
    | number
    | null;

  course_name:
    | string
    | null;

  hole_name:
    | string
    | null;

  hole_short_name:
    | string
    | null;

  hole_sequence:
    | number
    | null;

  current_pace:
    | unknown
    | null;

  pace_minutes:
    | number
    | null;

  start_time:
    | string
    | null;

  estimated_finish_at:
    | string
    | null;

  thru_holes:
    | number
    | null;

  is_online: boolean;
  is_in_play: boolean;

  is_available:
    | boolean
    | null;

  is_charging:
    | boolean
    | null;

  gps_valid:
    | boolean
    | null;

  needs_service:
    | boolean
    | null;

  position_at:
    | string
    | null;

  last_seen_at: string;
};

type TeeTimePaceRowProps = {
  cartNumbers: string[];
  statuses: PaceCartStatus[];
  course: string;
  holes: number;
};

type PaceTone =
  | "green"
  | "yellow"
  | "red"
  | "gray";

function normalizeCartNumber(
  value: string | null
) {
  return (value ?? "")
    .trim()
    .replace(
      /^cart\s*/i,
      ""
    )
    .trim()
    .toUpperCase();
}

function validDate(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function formatClockTime(
  value: string | null
) {
  const date =
    validDate(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/New_York",

      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function numericValue(
  value: unknown
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

  return Math.round(
    numberValue
  );
}

function paceMinutesFromValue(
  value: unknown
): number | null {
  const directNumber =
    numericValue(value);

  if (
    directNumber !== null
  ) {
    return directNumber;
  }

  if (
    typeof value ===
    "string"
  ) {
    const cleaned =
      value.trim();

    const match =
      cleaned.match(
        /-?\d+(?:\.\d+)?/
      );

    if (!match) {
      return null;
    }

    const parsed =
      Math.round(
        Number(match[0])
      );

    if (
      !Number.isFinite(
        parsed
      )
    ) {
      return null;
    }

    if (
      /\bahead\b/i.test(
        cleaned
      )
    ) {
      return -Math.abs(
        parsed
      );
    }

    if (
      /\bbehind\b/i.test(
        cleaned
      )
    ) {
      return Math.abs(
        parsed
      );
    }

    return parsed;
  }

  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const paceObject =
    value as Record<
      string,
      unknown
    >;

  const behindCandidates = [
    paceObject.minutesBehind,
    paceObject.MinutesBehind,
    paceObject.behindMinutes,
    paceObject.BehindMinutes,
  ];

  for (
    const candidate of
      behindCandidates
  ) {
    const parsed =
      numericValue(
        candidate
      );

    if (
      parsed !== null
    ) {
      return Math.abs(
        parsed
      );
    }
  }

  const aheadCandidates = [
    paceObject.minutesAhead,
    paceObject.MinutesAhead,
    paceObject.aheadMinutes,
    paceObject.AheadMinutes,
  ];

  for (
    const candidate of
      aheadCandidates
  ) {
    const parsed =
      numericValue(
        candidate
      );

    if (
      parsed !== null
    ) {
      return -Math.abs(
        parsed
      );
    }
  }

  const generalCandidates = [
    paceObject.paceMinutes,
    paceObject.PaceMinutes,
    paceObject.minutes,
    paceObject.Minutes,
    paceObject.value,
    paceObject.Value,
    paceObject.pace,
    paceObject.Pace,
    paceObject.description,
    paceObject.Description,
    paceObject.display,
    paceObject.Display,
    paceObject.text,
    paceObject.Text,
  ];

  for (
    const candidate of
      generalCandidates
  ) {
    const parsed =
      paceMinutesFromValue(
        candidate
      );

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return null;
}

function getPaceMinutes(
  status: PaceCartStatus
) {
  if (
    status.pace_minutes !==
    null
  ) {
    return status.pace_minutes;
  }

  return paceMinutesFromValue(
    status.current_pace
  );
}

function paceTone(
  minutes: number | null
): PaceTone {
  if (
    minutes === null ||
    minutes <= 0
  ) {
    return "green";
  }

  if (minutes <= 9) {
    return "yellow";
  }

  return "red";
}

function paceText(
  minutes: number | null
) {
  if (minutes === null) {
    return "Pace calculating";
  }

  if (minutes === 0) {
    return "On pace";
  }

  if (minutes < 0) {
    return `${Math.abs(
      minutes
    )} min ahead`;
  }

  return `${minutes} min behind`;
}

function holeText(
  status: PaceCartStatus
) {
  const rawValue =
    status.hole_short_name ||
    status.hole_name ||
    (
      status.hole_sequence
        ? String(
            status.hole_sequence
          )
        : ""
    );

  const cleaned =
    rawValue.trim();

  if (!cleaned) {
    if (
      status.thru_holes !==
        null &&
      status.thru_holes > 0
    ) {
      return `Thru ${status.thru_holes}`;
    }

    return "On course";
  }

  if (
    /^hole\b/i.test(
      cleaned
    )
  ) {
    return cleaned;
  }

  return `Hole ${cleaned}`;
}

function courseTargetMinutes(
  course: string,
  holes: number
) {
  const normalized =
    course
      .trim()
      .toLowerCase();

  /*
    Current PACE targets shown
    for TwinEagles:

    Eagle: 4 hours 5 minutes
    Talon: 4 hours
  */

  let fullRoundMinutes =
    240;

  if (
    normalized.includes(
      "eagle"
    )
  ) {
    fullRoundMinutes =
      245;
  }

  if (
    normalized.includes(
      "talon"
    )
  ) {
    fullRoundMinutes =
      240;
  }

  if (holes <= 9) {
    return Math.round(
      fullRoundMinutes / 2
    );
  }

  return fullRoundMinutes;
}

function estimatedFinishTime(
  status: PaceCartStatus,
  course: string,
  holes: number,
  minutes:
    | number
    | null
) {
  const paceEstimate =
    formatClockTime(
      status
        .estimated_finish_at
    );

  if (paceEstimate) {
    return paceEstimate;
  }

  const start =
    validDate(
      status.start_time
    );

  if (!start) {
    return null;
  }

  const targetMinutes =
    courseTargetMinutes(
      course,
      holes
    );

  const paceAdjustment =
    minutes ?? 0;

  const finish =
    new Date(
      start.getTime() +
        (
          targetMinutes +
          paceAdjustment
        ) *
          60 *
          1000
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/New_York",

      hour: "numeric",
      minute: "2-digit",
    }
  ).format(finish);
}

function ageInMilliseconds(
  value: string | null
) {
  const date =
    validDate(value);

  if (!date) {
    return null;
  }

  return (
    Date.now() -
    date.getTime()
  );
}

function formatFreshness(
  value: string | null
) {
  const age =
    ageInMilliseconds(
      value
    );

  if (
    age === null ||
    age < 0
  ) {
    return null;
  }

  const seconds =
    Math.floor(
      age / 1000
    );

  if (seconds < 60) {
    return `${Math.max(
      seconds,
      1
    )} sec ago`;
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  return `${hours} hr ago`;
}

function toneClasses(
  tone: PaceTone
) {
  if (tone === "red") {
    return {
      dot:
        "bg-red-500",

      text:
        "text-red-700 dark:text-red-300",
    };
  }

  if (tone === "yellow") {
    return {
      dot:
        "bg-amber-400",

      text:
        "text-amber-700 dark:text-amber-300",
    };
  }

  if (tone === "green") {
    return {
      dot:
        "bg-emerald-500",

      text:
        "text-emerald-700 dark:text-emerald-300",
    };
  }

  return {
    dot:
      "bg-slate-400",

    text:
      "text-[var(--golfops-text-muted)]",
  };
}

function CartPaceStatus({
  cartNumber,
  status,
  course,
  holes,
}: {
  cartNumber: string;
  status:
    | PaceCartStatus
    | undefined;
  course: string;
  holes: number;
}) {
  if (!status) {
    const colors =
      toneClasses("gray");

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-nowrap md:whitespace-nowrap">
        <span
          className={[
            "h-2 w-2 shrink-0 rounded-full",
            colors.dot,
          ].join(" ")}
        />

        <span className="font-semibold text-[var(--golfops-text-secondary)]">
          Cart {cartNumber}
        </span>

        <span className="text-[var(--golfops-text-muted)]">
          No PACE status
        </span>
      </div>
    );
  }

  const feedAge =
    ageInMilliseconds(
      status.last_seen_at
    );

  const feedIsStale =
    feedAge === null ||
    feedAge >
      3 * 60 * 1000;

  if (feedIsStale) {
    const colors =
      toneClasses("gray");

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-nowrap md:whitespace-nowrap">
        <span
          className={[
            "h-2 w-2 shrink-0 rounded-full",
            colors.dot,
          ].join(" ")}
        />

        <span className="font-semibold text-[var(--golfops-text-secondary)]">
          Cart {cartNumber}
        </span>

        <span className="text-[var(--golfops-text-muted)]">
          PACE feed unavailable
        </span>
      </div>
    );
  }

  const onCourse =
    status.is_in_play ||
    (
      Boolean(
        status.start_time
      ) &&
      Boolean(
        status.hole_name ||
        status.hole_short_name ||
        status.hole_sequence
      )
    );

  if (!onCourse) {
    const colors =
      toneClasses("gray");

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-nowrap md:whitespace-nowrap">
        <span
          className={[
            "h-2 w-2 shrink-0 rounded-full",
            colors.dot,
          ].join(" ")}
        />

        <span className="font-semibold text-[var(--golfops-text-secondary)]">
          Cart {cartNumber}
        </span>

        <span className="text-[var(--golfops-text-muted)]">
          Not on course
        </span>
      </div>
    );
  }

  /*
    PACE can publish a current online/in-play
    status while its PositionTimestamp retains
    an older value. Feed freshness is already
    validated above using last_seen_at, so the
    vehicle's position timestamp must not hide
    otherwise valid hole and pace information.
  */

  if (
    status.is_online === false
  ) {
    const colors =
      toneClasses("gray");

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-nowrap md:whitespace-nowrap">
        <span
          className={[
            "h-2 w-2 shrink-0 rounded-full",
            colors.dot,
          ].join(" ")}
        />

        <span className="font-semibold text-[var(--golfops-text-secondary)]">
          Cart {cartNumber}
        </span>

        <span className="text-[var(--golfops-text-muted)]">
          Signal unavailable
        </span>
      </div>
    );
  }

  const minutes =
    getPaceMinutes(
      status
    );

  const tone =
    paceTone(minutes);

  const colors =
    toneClasses(tone);

  const finishTime =
    estimatedFinishTime(
      status,
      course,
      holes,
      minutes
    );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-nowrap md:whitespace-nowrap">
      <span
        className={[
          "h-2 w-2 shrink-0 rounded-full",
          colors.dot,
        ].join(" ")}
      />

      <span className="font-semibold text-[var(--golfops-text-secondary)]">
        Cart {cartNumber}
      </span>

      <span className="text-[var(--golfops-text-muted)]">
        {holeText(status)}
      </span>

      <span
        className={[
          "font-semibold",
          colors.text,
        ].join(" ")}
      >
        {paceText(minutes)}
      </span>

      {finishTime && (
        <span className="text-[var(--golfops-text-muted)]">
          Est. {finishTime}
        </span>
      )}
    </div>
  );
}

export default function TeeTimePaceRow({
  cartNumbers,
  statuses,
  course,
  holes,
}: TeeTimePaceRowProps) {
  const uniqueCartNumbers =
    Array.from(
      new Set(
        cartNumbers
          .map(
            normalizeCartNumber
          )
          .filter(Boolean)
      )
    );

  const statusMap =
    new Map(
      statuses.map(
        (status) => [
          normalizeCartNumber(
            status.cart_number
          ),
          status,
        ]
      )
    );

  const matchingStatuses =
    uniqueCartNumbers
      .map(
        (cartNumber) =>
          statusMap.get(
            cartNumber
          )
      )
      .filter(
        (
          status
        ): status is PaceCartStatus =>
          Boolean(status)
      );

  const newestUpdate =
    matchingStatuses
      .map(
        (status) =>
          validDate(
            status.last_seen_at
          )
      )
      .filter(
        (
          value
        ): value is Date =>
          Boolean(value)
      )
      .sort(
        (a, b) =>
          b.getTime() -
          a.getTime()
      )[0];

  const freshness =
    formatFreshness(
      newestUpdate
        ?.toISOString() ??
        null
    );

  return (
    <div className="flex min-h-[34px] w-full flex-col justify-center gap-2 border-t border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-3 py-2 text-[11px] md:col-start-2 md:col-end-6 md:row-start-2 md:flex-row md:items-center md:justify-between md:gap-3 md:py-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-center md:gap-4">
        <span className="shrink-0 font-bold uppercase tracking-[0.12em] text-[var(--golfops-text-dim)]">
          Live PACE
        </span>

        {uniqueCartNumbers.length >
        0 ? (
          uniqueCartNumbers.map(
            (cartNumber) => (
              <CartPaceStatus
                key={
                  cartNumber
                }
                cartNumber={
                  cartNumber
                }
                status={statusMap.get(
                  cartNumber
                )}
                course={course}
                holes={holes}
              />
            )
          )
        ) : (
          <span className="text-[var(--golfops-text-muted)]">
            Assign a cart number to enable tracking
          </span>
        )}
      </div>

      {freshness && (
        <span className="shrink-0 text-[var(--golfops-text-dim)]">
          Updated {freshness}
        </span>
      )}
    </div>
  );
}
