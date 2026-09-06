export type ForeTeesPlayer = {
  playerName: string;
  memberNumber: string | null;
  cw: string;
};

export type ForeTeesTeeTime = {
  teeTime: string;
  course: string;
  startingHole: number;
  players: ForeTeesPlayer[];
};

export type ForeTeesParseResult = {
  sheetDate: string | null;
  teeTimes: ForeTeesTeeTime[];
  occupiedPlayers: number;
};

function cleanText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlayer(value: string) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return {
      playerName: "",
      memberNumber: null,
    };
  }

  const match = cleaned.match(/^(.*?)(?:\s+(\d+))$/);

  if (match) {
    return {
      playerName: match[1].trim(),
      memberNumber: match[2],
    };
  }

  return {
    playerName: cleaned,
    memberNumber: null,
  };
}

function parseSheetDate(text: string) {
  const match = text.match(
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/
  );

  if (!match) {
    return null;
  }

  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function parseStartingHole(value: string) {
  const normalized = cleanText(value).toUpperCase();

  if (normalized.startsWith("B")) {
    return 10;
  }

  return 1;
}

export function parseForeTeesHtml(
  html: string
): ForeTeesParseResult {
  const parser = new DOMParser();
  const document = parser.parseFromString(
    html,
    "text/html"
  );

  const bodyText = cleanText(
    document.body?.textContent
  );

  const sheetDate = parseSheetDate(bodyText);

  const teeTimes: ForeTeesTeeTime[] = [];
  let occupiedPlayers = 0;

  const rows = Array.from(
    document.querySelectorAll("tr")
  );

  for (const row of rows) {
    const cells = Array.from(
      row.querySelectorAll(":scope > td")
    );

    if (cells.length === 0) {
      continue;
    }

    const values = cells.map((cell) =>
      cleanText(cell.textContent)
    );

    const teeTime = values[0] ?? "";

    if (
      !/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(
        teeTime
      )
    ) {
      continue;
    }

    /*
      Current -ALL- Bag Report:
      Time, Course, F/B,
      Player, Bag#, C/W x4
    */
    if (values.length >= 15) {
      const course = values[1];
      const startingHole =
        parseStartingHole(values[2]);

      const players: ForeTeesPlayer[] = [];

      const positions = [
        [3, 5],
        [6, 8],
        [9, 11],
        [12, 14],
      ];

      for (const [
        playerColumn,
        cwColumn,
      ] of positions) {
        const playerName = cleanText(
          values[playerColumn]
        );

        const cw = cleanText(
          values[cwColumn]
        );

        if (playerName) {
          occupiedPlayers += 1;
        }

        players.push({
          playerName,
          memberNumber: null,
          cw,
        });
      }

      teeTimes.push({
        teeTime,
        course,
        startingHole,
        players,
      });

      continue;
    }

    /*
      Earlier report format.
    */
    if (values.length >= 11) {
      const course = values[1];
      const startingHole =
        parseStartingHole(values[2]);

      const players: ForeTeesPlayer[] = [];

      const positions = [
        [3, 4],
        [5, 6],
        [7, 8],
        [9, 10],
      ];

      for (const [
        playerColumn,
        cwColumn,
      ] of positions) {
        const parsedPlayer = extractPlayer(
          values[playerColumn]
        );

        const cw = cleanText(
          values[cwColumn]
        );

        if (parsedPlayer.playerName) {
          occupiedPlayers += 1;
        }

        players.push({
          playerName:
            parsedPlayer.playerName,
          memberNumber:
            parsedPlayer.memberNumber,
          cw,
        });
      }

      teeTimes.push({
        teeTime,
        course,
        startingHole,
        players,
      });
    }
  }

  return {
    sheetDate,
    teeTimes,
    occupiedPlayers,
  };
}