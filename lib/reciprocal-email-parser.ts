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
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(
  value: string
) {
  return decodeHtml(
    value
      .replace(
        /<br\s*\/?>/gi,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  );
}

function normalizedLabel(
  value: string
) {
  return stripTags(value)
    .toLowerCase()
    .replace(
      /[’‘]/g,
      "'"
    )
    .replace(/\s+/g, " ")
    .trim();
}

function allFieldValues(
  html: string,
  label: string
) {
  const values: string[] = [];

  const wanted =
    normalizedLabel(label);

  /*
    This deliberately scans every table
    cell rather than requiring the label
    to be plain text.

    Outlook may wrap forwarded labels in
    spans or other formatting elements.
  */

  const cellPattern =
    /<td\b[^>]*>([\s\S]*?)<\/td>/gi;

  for (
    const match
    of html.matchAll(
      cellPattern
    )
  ) {
    const labelText =
      normalizedLabel(
        match[1]
      );

    if (
      labelText !== wanted
    ) {
      continue;
    }

    const matchIndex =
      match.index ?? 0;

    const afterLabel =
      html.slice(
        matchIndex +
          match[0].length
      );

    const valueMatch =
      afterLabel.match(
        /^\s*<td\b[^>]*>([\s\S]*?)<\/td>/i
      );

    if (!valueMatch) {
      continue;
    }

    values.push(
      stripTags(
        valueMatch[1]
      )
    );
  }

  return values;
}

function fieldValue(
  html: string,
  label: string
) {
  return (
    allFieldValues(
      html,
      label
    )[0] ?? ""
  );
}

function firstMatchingField(
  html: string,
  labels: string[]
) {
  for (
    const label
    of labels
  ) {
    const value =
      fieldValue(
        html,
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

function headingPositions(
  html: string
) {
  const headings: Array<{
    text: string;
    index: number;
  }> = [];

  const pattern =
    /<h6\b[^>]*>([\s\S]*?)<\/h6>/gi;

  for (
    const match
    of html.matchAll(pattern)
  ) {
    headings.push({
      text:
        normalizedLabel(
          match[1]
        ),

      index:
        match.index ?? 0,
    });
  }

  return headings;
}

function groupSection(
  html: string,
  group: number
) {
  const headings =
    headingPositions(html);

  const wanted =
    `group ${group}`;

  const startPosition =
    headings.findIndex(
      (heading) =>
        heading.text ===
        wanted
    );

  if (
    startPosition < 0
  ) {
    return "";
  }

  const start =
    headings[
      startPosition
    ].index;

  const nextGroup =
    headings
      .slice(
        startPosition + 1
      )
      .find(
        (heading) =>
          /^group \d+$/
            .test(
              heading.text
            )
      );

  const end =
    nextGroup
      ? nextGroup.index
      : html.length;

  return html.slice(
    start,
    end
  );
}

function parsePlayersFromGroup(
  section: string
) {
  const labels = [
    "Player's Name",
    "Players Name",
  ];

  for (
    const label
    of labels
  ) {
    const players =
      allFieldValues(
        section,
        label
      )
        .map(
          (player) =>
            player.trim()
        )
        .filter(Boolean)
        .slice(0, 4);

    if (
      players.length > 0
    ) {
      return players;
    }
  }

  return [];
}

export function parseReciprocalEmailHtml(
  html: string
): ParsedReciprocalEmail {
  const firstName =
    fieldValue(
      html,
      "First Name"
    );

  const lastName =
    fieldValue(
      html,
      "Last Name"
    );

  const memberNumber =
    fieldValue(
      html,
      "Member Number"
    );

  const emailAddress =
    fieldValue(
      html,
      "Email Address"
    );

  const numberOfPlayersText =
    fieldValue(
      html,
      "Number of Players"
    );

  const numberOfPlayersValue =
    Number.parseInt(
      numberOfPlayersText,
      10
    );

  const preferredDateText =
    fieldValue(
      html,
      "Preferred Date"
    );

  const preferredTime =
    fieldValue(
      html,
      "Preferred Time"
    );

  const timeRange =
    firstMatchingField(
      html,
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
            html,
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
            parsePlayersFromGroup(
              groupSection(
                html,
                group
              )
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