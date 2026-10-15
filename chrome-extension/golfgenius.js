const GOLFGENIUS_MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

function golfGeniusClean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function golfGeniusAbsoluteUrl(value) {
  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return "";
  }
}

function golfGeniusDateFromText(value) {
  const text = golfGeniusClean(value);
  let match = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i);
  if (!match) {
    match = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,)?\s+(20\d{2})\b/i);
  }
  if (!match) return null;
  const month = GOLFGENIUS_MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
}

function golfGeniusTime(value) {
  const match = golfGeniusClean(value).match(/\b(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M\.?\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || "0");
  const meridiem = match[3].toUpperCase();
  if (hour === 12) hour = 0;
  if (meridiem === "P") hour += 12;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function golfGeniusTimes(value) {
  const text = golfGeniusClean(value);
  const labeled = text.match(/\b(?:event\s+time|start\s+time|clinic\s+time|fitting\s+time|time)\s*:?\s*(\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?)(?:\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?))?/i);
  const range = text.match(/\b(\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?)\b/i);
  const match = labeled || range;
  return {
    startTime: match ? golfGeniusTime(match[1]) : null,
    endTime: match?.[2] ? golfGeniusTime(match[2]) : null
  };
}

function golfGeniusExternalId(value) {
  try {
    const url = new URL(value, window.location.href);
    const numeric = url.pathname.match(/\/(?:leagues|pages|events)\/(\d{8,})/i)?.[1];
    if (numeric) return numeric;
    const ggid = url.pathname.match(/\/ggid\/([^/?#]+)/i)?.[1];
    if (ggid) return `ggid-${ggid.toLowerCase()}`;
    return `${url.hostname}${url.pathname}${url.search}`.toLowerCase();
  } catch {
    return golfGeniusClean(value).toLowerCase();
  }
}

function golfGeniusEventContainer(anchor) {
  let node = anchor;
  for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
    const text = golfGeniusClean(node.innerText);
    if (text.length >= 20 && text.length <= 1600 && golfGeniusDateFromText(text)) return node;
  }
  return anchor.closest("tr") || anchor.parentElement;
}

function golfGeniusNameFromContainer(container, fallback) {
  const candidates = Array.from(container.querySelectorAll("a[href], h1, h2, h3, h4"))
    .map((element) => golfGeniusClean(element.textContent))
    .filter((text) => text && !/^(view|register|results?|pairings?|details?|information)$/i.test(text))
    .filter((text) => !golfGeniusDateFromText(text) && text.length <= 250);
  return candidates[0] || fallback;
}

function golfGeniusStatus(value) {
  const text = golfGeniusClean(value);
  if (/\bwaitlist\b/i.test(text)) return "WAITLIST";
  if (/\bopening soon\b|\bopens\b/i.test(text)) return "OPENING SOON";
  if (/\bclosed\b/i.test(text)) return "CLOSED";
  if (/\bopen\b/i.test(text)) return "OPEN";
  return null;
}

function golfGeniusLocation(value) {
  const lines = String(value || "").split(/\n+/).map(golfGeniusClean).filter(Boolean);
  return lines.find((line) => /\b(course|learning center|range|fitting|practice)\b/i.test(line) && line.length <= 250) || null;
}

async function golfGeniusExpandDirectory() {
  let previousHeight = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    const height = document.documentElement.scrollHeight;
    if (height === previousHeight) break;
    previousHeight = height;
  }
  window.scrollTo(0, 0);
}

async function golfGeniusParseDirectory() {
  await golfGeniusExpandDirectory();
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const viewAnchors = anchors.filter((anchor) => /^view$/i.test(golfGeniusClean(anchor.textContent)));
  const candidates = viewAnchors.length > 0
    ? viewAnchors
    : anchors.filter((anchor) => {
        const container = golfGeniusEventContainer(anchor);
        return Boolean(container && golfGeniusDateFromText(container.innerText));
      });
  const byId = new Map();

  for (const anchor of candidates) {
    const sourceUrl = golfGeniusAbsoluteUrl(anchor.getAttribute("href"));
    if (!sourceUrl || !/golfgenius\.com$/i.test(new URL(sourceUrl).hostname)) continue;
    const container = golfGeniusEventContainer(anchor);
    if (!container) continue;
    const sourceText = String(container.innerText || "").trim();
    const date = golfGeniusDateFromText(sourceText);
    if (!date) continue;
    const fallbackName = golfGeniusClean(anchor.textContent);
    const name = golfGeniusNameFromContainer(container, fallbackName);
    if (!name || /^view$/i.test(name)) continue;
    const externalId = golfGeniusExternalId(sourceUrl);
    byId.set(externalId, {
      externalId,
      name,
      date,
      location: golfGeniusLocation(sourceText),
      registrationStatus: golfGeniusStatus(sourceText),
      sourceUrl,
      sourceText: golfGeniusClean(sourceText).slice(0, 4000)
    });
  }

  return {
    ok: byId.size > 0,
    events: Array.from(byId.values()),
    pageTitle: document.title,
    error: byId.size > 0 ? null : "No Golf Genius event cards were found on the directory page."
  };
}

function golfGeniusParticipantUrl() {
  const link = Array.from(document.querySelectorAll("a[href]"))
    .find((anchor) => /participants?|player roster/i.test(golfGeniusClean(anchor.textContent)));
  return link ? golfGeniusAbsoluteUrl(link.getAttribute("href")) : null;
}

function golfGeniusParseEvent() {
  const text = String(document.body?.innerText || "");
  const heading = Array.from(document.querySelectorAll("h1, h2, h3, .page-title, [class*='title']"))
    .map((element) => golfGeniusClean(element.textContent))
    .find((value) => value && value.length <= 250) || null;
  return {
    ok: Boolean(text.trim()),
    name: heading,
    date: golfGeniusDateFromText(text),
    ...golfGeniusTimes(text),
    location: golfGeniusLocation(text),
    participantUrl: golfGeniusParticipantUrl(),
    sourceText: golfGeniusClean(text).slice(0, 4000)
  };
}

function golfGeniusLikelyParticipantName(value) {
  const text = golfGeniusClean(value);
  if (!text || text.length > 200) return false;
  if (/^(handle|name|player|golfer|division|filter players|player roster|print|actions?|entry|email|ghin|h\.i\.)$/i.test(text)) return false;
  if (/\d{4}|@|registration|weather|information|policies|procedures/i.test(text)) return false;
  return /[a-z]/i.test(text) && (text.includes(",") || text.split(/\s+/).length >= 2);
}

function golfGeniusParseParticipants() {
  const participants = [];
  const rows = Array.from(document.querySelectorAll("tbody tr, table tr, [role='row']"));
  for (const row of rows) {
    const rowText = golfGeniusClean(row.innerText);
    if (!rowText) continue;
    const links = Array.from(row.querySelectorAll("a[href]"))
      .map((anchor) => golfGeniusClean(anchor.textContent))
      .filter(golfGeniusLikelyParticipantName);
    const cells = Array.from(row.querySelectorAll("td, [role='cell']"))
      .map((cell) => golfGeniusClean(cell.textContent))
      .filter(golfGeniusLikelyParticipantName);
    const name = links[0] || cells[0];
    if (!name) continue;
    participants.push({ name, appointmentTime: golfGeniusTime(rowText), status: "CONFIRMED" });
  }

  if (participants.length === 0) {
    const links = Array.from(document.querySelectorAll("a[href]"));
    for (const link of links) {
      const name = golfGeniusClean(link.textContent);
      if (!golfGeniusLikelyParticipantName(name)) continue;
      const containerText = golfGeniusClean(link.closest("tr, li, [role='row']")?.innerText || name);
      participants.push({ name, appointmentTime: golfGeniusTime(containerText), status: "CONFIRMED" });
    }
  }

  const unique = new Map();
  for (const participant of participants) {
    const key = `${participant.name.toLowerCase()}|${participant.appointmentTime || ""}`;
    if (!unique.has(key)) unique.set(key, participant);
  }

  return { ok: true, participants: Array.from(unique.values()) };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GOLFGENIUS_PARSE_DIRECTORY") {
    golfGeniusParseDirectory().then(sendResponse).catch((error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read the Golf Genius directory."
    }));
    return true;
  }
  if (message?.type === "GOLFGENIUS_PARSE_EVENT") {
    sendResponse(golfGeniusParseEvent());
    return false;
  }
  if (message?.type === "GOLFGENIUS_PARSE_PARTICIPANTS") {
    sendResponse(golfGeniusParseParticipants());
    return false;
  }
  return false;
});
