export type ParsedReciprocalEmail = {
  firstName: string;
  lastName: string;
  memberNumber: string;
  emailAddress: string;
  numberOfPlayers: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  timeRange: string | null;
  courseChoices: string[];
  groups: Array<{
    group: number;
    players: string[];
  }>;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code))
    )
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldValue(html: string, label: string) {
  const labelPattern = escapeRegex(label);

  const pattern = new RegExp(
    `<td[^>]*>\\s*${labelPattern}\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
    "i"
  );

  const match = html.match(pattern);
  return match ? stripTags(match[1]) : "";
}

function firstMatchingField(html: string, labels: string[]) {
  for (const label of labels) {
    const value = fieldValue(html, label);
    if (value) return value;
  }

  return "";
}

function parseUsDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 2000
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function parsePlayersFromGroup(section: string) {
  const players: string[] = [];

  const pattern =
    /<td[^>]*>\s*Player(?:'|&#39;|&apos;)?s Name\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;

  for (const match of section.matchAll(pattern)) {
    const player = stripTags(match[1]);

    if (player) {
      players.push(player);
    }
  }

  return players.slice(0, 4);
}

function groupSection(html: string, group: number) {
  const startPattern = new RegExp(
    `<h6>\\s*Group\\s+${group}\\s*<\\/h6>`,
    "i"
  );

  const start = html.search(startPattern);
  if (start < 0) return "";

  const remainder = html.slice(start);
  const nextPattern =
    group < 4
      ? new RegExp(`<h6>\\s*Group\\s+${group + 1}\\s*<\\/h6>`, "i")
      : /<\/body>/i;

  const next = remainder.search(nextPattern);

  return next > 0 ? remainder.slice(0, next) : remainder;
}

export function parseReciprocalEmailHtml(
  html: string
): ParsedReciprocalEmail {
  const firstName = fieldValue(html, "First Name");
  const lastName = fieldValue(html, "Last Name");
  const memberNumber = fieldValue(html, "Member Number");
  const emailAddress = fieldValue(html, "Email Address");

  const numberOfPlayersText = fieldValue(html, "Number of Players");
  const numberOfPlayersValue = Number.parseInt(numberOfPlayersText, 10);

  const preferredDateText = fieldValue(html, "Preferred Date");
  const preferredTime = fieldValue(html, "Preferred Time");

  const timeRange = firstMatchingField(html, [
    "Time Range (i.e. 8-10 AM)",
    "Time Range",
  ]);

  const courseChoices = [1, 2, 3, 4]
    .map((index) => fieldValue(html, `Course Choice #${index}`))
    .filter(Boolean);

  const groups = [1, 2, 3, 4]
    .map((group) => ({
      group,
      players: parsePlayersFromGroup(groupSection(html, group)),
    }))
    .filter((group) => group.players.length > 0);

  return {
    firstName,
    lastName,
    memberNumber,
    emailAddress,
    numberOfPlayers: Number.isFinite(numberOfPlayersValue)
      ? numberOfPlayersValue
      : null,
    preferredDate: parseUsDate(preferredDateText),
    preferredTime: preferredTime || null,
    timeRange: timeRange || null,
    courseChoices,
    groups,
  };
}
