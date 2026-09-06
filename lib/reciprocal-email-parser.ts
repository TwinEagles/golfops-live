export type ParsedReciprocalEmail = {
  firstName: string;
  lastName: string;
  memberNumber: string;
  emailAddress: string;
  numberOfPlayers:
    | number
    | null;
  preferredDate:
    | string
    | null;
  preferredTime:
    | string
    | null;
  timeRange:
    | string
    | null;
  courseChoices: string[];

  groups: Array<{
    group: number;
    players: string[];
  }>;
};

function decodeHtml(
  value: string
) {
  return value
    .replace(
      /&nbsp;|&#160;/gi,
      " "
    )
    .replace(/&amp;/gi, "&")
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;|&apos;/gi,
      "'"
    )
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(
      /&#(\d+);/g,
      (
        _,
        code: string
      ) =>
        String.fromCharCode(
          Number(code)
        )
    )
    .trim();
}

function normalizeLine(
  value: string
) {
  return decodeHtml(value)
    .replace(
      /[’‘]/g,
      "'"
    )
    .replace(/\s+/g, " ")
    .trim();
}

function emailLines(
  value: string
) {
  /*
    Add line breaks at the end of
    elements that commonly contain
    reciprocal form labels and values.

    This works with:
      - the original website HTML
      - Outlook-forwarded HTML
      - Postmark's plain-text body
  */

  const text =
    value
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<\/(?:td|tr|h6|div|p|li)>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      );

  return text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);
}

function normalizedKey(
  value: string
) {
  return normalizeLine(value)
    .toLowerCase();
}

function isKnownLabel(
  value: string
) {
  const key =
    normalizedKey(value);

  return (
    key === "first name" ||
    key === "last name" ||
    key === "member number" ||
    key === "email address" ||
    key === "number of players" ||
    key === "preferred date" ||
    key === "preferred time" ||
    key ===
      "time range (i.e. 8-10 am)" ||
    key === "time range" ||
    /^course choice #\d+$/
      .test(key) ||
    /^group \d+$/
      .test(key) ||
    key === "player's name" ||
    key === "players name"
  );
}

function fieldValue(
  lines: string[],
  label: string
) {
  const wanted =
    normalizedKey(label);

  const index =
    lines.findIndex(
      (line) =>
        normalizedKey(line) ===
        wanted
    );

  if (
    index < 0 ||
    index + 1 >=
      lines.length
  ) {
    return "";
  }

  const candidate =
    lines[index + 1];

  if (
    isKnownLabel(candidate)
  ) {
    return "";
  }

  return candidate;
}

function firstMatchingField(
  lines: string[],
  labels: string[]
) {
  for (
    const label
    of labels
  ) {
    const value =
      fieldValue(
        lines,
        label
      );

    if (value) {
      return value;
    }
  }

  return "";
}

function parseUsDate(
  value: string
) {
  const match =
    value
      .trim()
      .match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      );

  if (!match) {
    return null;
  }

  const month =
    Number(match[1]);

  const day =
    Number(match[2]);

  const year =
    Number(match[3]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 2000
  ) {
    return null;
  }

  const candidate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    candidate
      .getUTCFullYear() !==
      year ||
    candidate
      .getUTCMonth() !==
      month - 1 ||
    candidate
      .getUTCDate() !==
      day
  ) {
    return null;
  }

  return [
    year,

    String(month)
      .padStart(2, "0"),

    String(day)
      .padStart(2, "0"),
  ].join("-");
}

function groupPlayers(
  lines: string[],
  group: number
) {
  const groupLabel =
    `group ${group}`;

  const start =
    lines.findIndex(
      (line) =>
        normalizedKey(line) ===
        groupLabel
    );

  if (start < 0) {
    return [];
  }

  let end =
    lines.length;

  for (
    let index = start + 1;
    index < lines.length;
    index++
  ) {
    if (
      /^group \d+$/.test(
        normalizedKey(
          lines[index]
        )
      )
    ) {
      end = index;
      break;
    }
  }

  const players:
    string[] = [];

  for (
    let index = start + 1;
    index < end;
    index++
  ) {
    const key =
      normalizedKey(
        lines[index]
      );

    if (
      key !==
        "player's name" &&
      key !==
        "players name"
    ) {
      continue;
    }

    const candidate =
      lines[index + 1];

    if (
      !candidate ||
      isKnownLabel(
        candidate
      )
    ) {
      continue;
    }

    players.push(
      candidate
    );

    index++;
  }

  return players
    .slice(0, 4);
}

export function parseReciprocalEmailHtml(
  html: string
): ParsedReciprocalEmail {
  const lines =
    emailLines(html);

  const firstName =
    fieldValue(
      lines,
      "First Name"
    );

  const lastName =
    fieldValue(
      lines,
      "Last Name"
    );

  const memberNumber =
    fieldValue(
      lines,
      "Member Number"
    );

  const emailAddress =
    fieldValue(
      lines,
      "Email Address"
    );

  const numberOfPlayersText =
    fieldValue(
      lines,
      "Number of Players"
    );

  const numberOfPlayersValue =
    Number.parseInt(
      numberOfPlayersText,
      10
    );

  const preferredDateText =
    fieldValue(
      lines,
      "Preferred Date"
    );

  const preferredTime =
    fieldValue(
      lines,
      "Preferred Time"
    );

  const timeRange =
    firstMatchingField(
      lines,
      [
        "Time Range (i.e. 8-10 AM)",
        "Time Range",
      ]
    );

  const courseChoices =
    [1, 2, 3, 4]
      .map(
        (index) =>
          fieldValue(
            lines,
            `Course Choice #${index}`
          )
      )
      .filter(Boolean);

  const groups =
    [1, 2, 3, 4]
      .map(
        (group) => ({
          group,

          players:
            groupPlayers(
              lines,
              group
            ),
        })
      )
      .filter(
        (group) =>
          group.players
            .length > 0
      );

  return {
    firstName,
    lastName,
    memberNumber,
    emailAddress,

    numberOfPlayers:
      Number.isFinite(
        numberOfPlayersValue
      )
        ? numberOfPlayersValue
        : null,

    preferredDate:
      parseUsDate(
        preferredDateText
      ),

    preferredTime:
      preferredTime ||
      null,

    timeRange:
      timeRange ||
      null,

    courseChoices,
    groups,
  };
}