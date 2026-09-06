import * as cheerio from "cheerio";

export type ForeTeesPlayer = {
  playerName: string;
  bagNumber: string | null;
  memberNumber: string | null;
  cw: string;
};

export type ForeTeesTeeTime = {
  teeTime: string;
  course: string;
  startingHole: number;
  startingPosition: string;
  players: ForeTeesPlayer[];
};

export type ForeTeesParseResult = {
  sheetDate: string | null;
  eventName: string | null;
  teeTimes: ForeTeesTeeTime[];
  occupiedPlayers: number;
};

function cleanText(
  value: string | null | undefined
) {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeeTime(
  value: string
) {
  const cleaned =
    cleanText(value);

  const match =
    cleaned.match(
      /(\d{1,2}:\d{2}\s*(?:AM|PM))/i
    );

  return match
    ? cleanText(match[1]).toUpperCase()
    : "";
}

function parseSheetDate(
  text: string
) {
  const match =
    text.match(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/
    );

  if (!match) {
    return null;
  }

  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function normalizeStartingPosition(
  value: string
) {
  return cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, "");
}

function makeStorageStartingPosition(
  rawStartingPosition: string,
  teeTime: string,
  course: string,
  standbyCounts: Map<string, number>
) {
  const position =
    normalizeStartingPosition(
      rawStartingPosition
    );

  if (position !== "S") {
    return position;
  }

  /*
    ForeTees uses "S" for standby / unassigned
    shotgun groups. Multiple S rows can exist at
    the same shotgun time, so give each one a
    stable internal position (S1, S2, S3, ...).

    GolfOps can still display these as simply "S"
    or "OPEN"; the suffix exists only so the rows
    remain distinct in the database.
  */
  const key = [
    teeTime,
    course.trim().toLowerCase(),
  ].join("|");

  const next =
    (standbyCounts.get(key) ?? 0) + 1;

  standbyCounts.set(
    key,
    next
  );

  return `S${next}`;
}

function parseStartingHole(
  startingPosition: string
) {
  const position =
    normalizeStartingPosition(
      startingPosition
    );

  const shotgunMatch =
    position.match(/^(\d{1,2})[A-Z]?$/);

  if (shotgunMatch) {
    return Number(
      shotgunMatch[1]
    );
  }

  if (
    position === "B" ||
    position === "B9" ||
    position === "B9/18"
  ) {
    return 10;
  }

  if (
    position === "F" ||
    position === "F9" ||
    position === "F9/18"
  ) {
    return 1;
  }

  const numeric =
    position.match(/\d{1,2}/);

  return numeric
    ? Number(numeric[0])
    : 1;
}

function extractPlayer(
  value: string
) {
  const cleaned =
    cleanText(value);

  if (!cleaned) {
    return {
      playerName: "",
      memberNumber: null,
    };
  }

  const match =
    cleaned.match(
      /^(.*?)(?:\s+(\d+))$/
    );

  if (match) {
    return {
      playerName:
        match[1].trim(),
      memberNumber:
        match[2],
    };
  }

  return {
    playerName: cleaned,
    memberNumber: null,
  };
}

function findEventName(
  $: cheerio.CheerioAPI
) {
  const bodyText =
    cleanText(
      $("body").text()
    );

  const match =
    bodyText.match(
      /Today's Events:\s*(.+?)(?=\s+(?:Time|Course|Player 1|Print Report|Close)\b)/i
    );

  return match
    ? cleanText(match[1])
    : null;
}

function detectCourseFromRow(
  $: cheerio.CheerioAPI,
  row: any
) {
  const rowText =
    cleanText(
      $(row).text()
    );

  const match =
    rowText.match(
      /\b(Talon|Eagle)\b/i
    );

  if (match) {
    const value =
      match[1].toLowerCase();

    return value === "talon"
      ? "Talon"
      : "Eagle";
  }

  const rowHtml =
    $.html(row);

  const htmlMatch =
    rowHtml.match(
      /\b(Talon|Eagle)\b/i
    );

  if (htmlMatch) {
    const value =
      htmlMatch[1].toLowerCase();

    return value === "talon"
      ? "Talon"
      : "Eagle";
  }

  return "";
}

export function parseForeTeesServerHtml(
  html: string
): ForeTeesParseResult {
  const $ =
    cheerio.load(html);

  const bodyText =
    cleanText(
      $("body").text()
    );

  const sheetDate =
    parseSheetDate(
      bodyText
    );

  const eventName =
    findEventName($);

  const teeTimes:
    ForeTeesTeeTime[] = [];

  let occupiedPlayers =
    0;

  let lastDetectedCourse =
    "";

  /*
    Tracks duplicate ForeTees "S" shotgun rows
    so every standby/open group gets a distinct
    internal starting_position.
  */
  const standbyCounts =
    new Map<string, number>();

  $("tr").each(
    (_, row) => {
      /*
        Some ForeTees reports render the
        Course cell differently from the
        other data cells. Include both TD
        and TH children so the visible
        report structure is preserved.
      */

      const cells =
        $(row)
          .children("td, th")
          .toArray();

      if (
        cells.length === 0
      ) {
        return;
      }

      const values =
        cells.map(
          (cell) =>
            cleanText(
              $(cell).text()
            )
        );

      const teeTime =
        normalizeTeeTime(
          values[0] ?? ""
        );

      if (!teeTime) {
        return;
      }

      const rowCourse =
        detectCourseFromRow(
          $,
          row
        );

      if (rowCourse) {
        lastDetectedCourse =
          rowCourse;
      }

      /*
        CURRENT 15-CELL FORMAT

        Time
        Course
        F/B / shotgun position
        Player 1, Bag, C/W
        Player 2, Bag, C/W
        Player 3, Bag, C/W
        Player 4, Bag, C/W
      */

      if (
        values.length >= 15
      ) {
        const course =
          cleanText(
            values[1]
          ) ||
          rowCourse ||
          lastDetectedCourse;

        const rawStartingPosition =
          normalizeStartingPosition(
            values[2]
          );

        if (
          !rawStartingPosition
        ) {
          return;
        }

        const startingPosition =
          makeStorageStartingPosition(
            rawStartingPosition,
            teeTime,
            course,
            standbyCounts
          );

        const startingHole =
          parseStartingHole(
            rawStartingPosition
          );

        const players:
          ForeTeesPlayer[] = [];

        const positions = [
          [3, 4, 5],
          [6, 7, 8],
          [9, 10, 11],
          [12, 13, 14],
        ];

        for (
          const [
            playerColumn,
            bagColumn,
            cwColumn,
          ] of positions
        ) {
          const playerName =
            cleanText(
              values[
                playerColumn
              ]
            );

          const bagNumber =
            cleanText(
              values[
                bagColumn
              ]
            ) || null;

          const cw =
            cleanText(
              values[
                cwColumn
              ]
            );

          if (playerName) {
            occupiedPlayers +=
              1;
          }

          players.push({
            playerName,
            bagNumber,
            memberNumber:
              null,
            cw,
          });
        }

        teeTimes.push({
          teeTime,
          course,
          startingHole,
          startingPosition,
          players,
        });

        return;
      }

      /*
        SHOTGUN 14-CELL FORMAT OBSERVED
        ON FORETEES:

        Time
        F/B / shotgun position
        Player 1, Bag, C/W
        Player 2, Bag, C/W
        Player 3, Bag, C/W
        Player 4, Bag, C/W

        In this layout the visible course
        cell is not included in the TD list.
      */

      if (
        values.length === 14
      ) {
        const rawStartingPosition =
          normalizeStartingPosition(
            values[1]
          );

        if (
          !rawStartingPosition
        ) {
          return;
        }

        const course =
          rowCourse ||
          lastDetectedCourse ||
          (
            /\bTalon\b/i.test(
              bodyText
            )
              ? "Talon"
              : /\bEagle\b/i.test(
                  bodyText
                )
                ? "Eagle"
                : ""
          );

        /*
          IMPORTANT:
          ForeTees "S" rows are real shotgun
          standby/open groups, not separators.
          Preserve every one of them.
        */
        const startingPosition =
          makeStorageStartingPosition(
            rawStartingPosition,
            teeTime,
            course,
            standbyCounts
          );

        const startingHole =
          parseStartingHole(
            rawStartingPosition
          );

        const players:
          ForeTeesPlayer[] = [];

        const positions = [
          [2, 3, 4],
          [5, 6, 7],
          [8, 9, 10],
          [11, 12, 13],
        ];

        for (
          const [
            playerColumn,
            bagColumn,
            cwColumn,
          ] of positions
        ) {
          const playerName =
            cleanText(
              values[
                playerColumn
              ]
            );

          const bagNumber =
            cleanText(
              values[
                bagColumn
              ]
            ) || null;

          const cw =
            cleanText(
              values[
                cwColumn
              ]
            );

          if (playerName) {
            occupiedPlayers +=
              1;
          }

          players.push({
            playerName,
            bagNumber,
            memberNumber:
              null,
            cw,
          });
        }

        teeTimes.push({
          teeTime,
          course,
          startingHole,
          startingPosition,
          players,
        });

        return;
      }

      /*
        EARLIER REPORT FORMAT
      */

      if (
        values.length >= 11
      ) {
        const course =
          cleanText(
            values[1]
          ) ||
          rowCourse ||
          lastDetectedCourse;

        const rawStartingPosition =
          normalizeStartingPosition(
            values[2]
          );

        if (
          !rawStartingPosition
        ) {
          return;
        }

        const startingPosition =
          makeStorageStartingPosition(
            rawStartingPosition,
            teeTime,
            course,
            standbyCounts
          );

        const startingHole =
          parseStartingHole(
            rawStartingPosition
          );

        const players:
          ForeTeesPlayer[] = [];

        const positions = [
          [3, 4],
          [5, 6],
          [7, 8],
          [9, 10],
        ];

        for (
          const [
            playerColumn,
            cwColumn,
          ] of positions
        ) {
          const parsedPlayer =
            extractPlayer(
              values[
                playerColumn
              ]
            );

          const cw =
            cleanText(
              values[
                cwColumn
              ]
            );

          if (
            parsedPlayer.playerName
          ) {
            occupiedPlayers +=
              1;
          }

          players.push({
            playerName:
              parsedPlayer.playerName,
            bagNumber:
              null,
            memberNumber:
              parsedPlayer.memberNumber,
            cw,
          });
        }

        teeTimes.push({
          teeTime,
          course,
          startingHole,
          startingPosition,
          players,
        });
      }
    }
  );

  return {
    sheetDate,
    eventName,
    teeTimes,
    occupiedPlayers,
  };
}
