import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const DEFAULT_INSIDE_CALENDAR_ID =
  "f05fd4124bc1da51bdeb308b0e29d7384cbf77f722f3431993773f5a9063fcf3@group.calendar.google.com";
const DEFAULT_OUTSIDE_CALENDAR_ID =
  "ad5909f9ae778acf9d6b9028cc86f3ef78679f2ade168c0de1db962690a1429a@group.calendar.google.com";

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

type CalendarEventInput = {
  summary: string;
  description: string;
  startDate: string;
  endDateExclusive: string;
  allDay: boolean;
  startLocal?: string | null;
  endLocal?: string | null;
  groupKey: string;
  department: "INSIDE" | "OUTSIDE";
};

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description: string | null;
  status: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function calendarConfig() {
  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    .trim();
  const insideCalendarId =
    process.env.GOOGLE_CALENDAR_INSIDE_ID?.trim() || DEFAULT_INSIDE_CALENDAR_ID;
  const outsideCalendarId =
    process.env.GOOGLE_CALENDAR_OUTSIDE_ID?.trim() || DEFAULT_OUTSIDE_CALENDAR_ID;

  if (!clientEmail || !privateKey || !insideCalendarId || !outsideCalendarId) {
    return null;
  }

  return { clientEmail, privateKey, insideCalendarId, outsideCalendarId };
}

export function isGoogleCalendarConfigured() {
  return Boolean(calendarConfig());
}

async function accessToken() {
  const config = calendarConfig();
  if (!config) throw new Error("Google Calendar is not configured.");

  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: CALENDAR_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64Url(signer.sign(config.privateKey))}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  const result = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || `Google authorization failed (${response.status}).`);
  }
  cachedAccessToken = result.access_token;
  cachedAccessTokenExpiresAt = Date.now() + 55 * 60_000;
  return cachedAccessToken;
}

function calendarId(department: "INSIDE" | "OUTSIDE") {
  const config = calendarConfig();
  if (!config) throw new Error("Google Calendar is not configured.");
  return department === "INSIDE" ? config.insideCalendarId : config.outsideCalendarId;
}

function eventBody(input: CalendarEventInput) {
  const timeZone = "America/New_York";
  return {
    summary: input.summary,
    description: input.description,
    transparency: "opaque",
    start: input.allDay
      ? { date: input.startDate }
      : { dateTime: input.startLocal?.replace(" ", "T"), timeZone },
    end: input.allDay
      ? { date: input.endDateExclusive }
      : { dateTime: input.endLocal?.replace(" ", "T"), timeZone },
    extendedProperties: {
      private: {
        golfopsPtoGroupKey: input.groupKey,
        golfopsDepartment: input.department,
      },
    },
  };
}

async function calendarRequest(
  department: "INSIDE" | "OUTSIDE",
  path: string,
  init: RequestInit
) {
  const token = await accessToken();
  return fetch(
    `${GOOGLE_CALENDAR_URL}/calendars/${encodeURIComponent(calendarId(department))}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    }
  );
}

export async function createCalendarEvent(input: CalendarEventInput) {
  const response = await calendarRequest(input.department, "/events", {
    method: "POST",
    body: JSON.stringify(eventBody(input)),
  });
  const result = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !result.id) {
    throw new Error(result.error?.message || `Google event creation failed (${response.status}).`);
  }
  return result.id;
}

export async function updateCalendarEvent(eventId: string, input: CalendarEventInput) {
  const response = await calendarRequest(
    input.department,
    `/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(eventBody(input)) }
  );
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(result.error?.message || `Google event update failed (${response.status}).`);
  }
}

export async function deleteCalendarEvent(
  department: "INSIDE" | "OUTSIDE",
  eventId: string
) {
  const response = await calendarRequest(
    department,
    `/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const result = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(result.error?.message || `Google event removal failed (${response.status}).`);
  }
}

export async function listCalendarEvents(
  department: "INSIDE" | "OUTSIDE",
  dateStart: string,
  dateEndExclusive: string
) {
  const events: GoogleCalendarEvent[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      timeMin: `${dateStart}T00:00:00Z`,
      timeMax: `${dateEndExclusive}T00:00:00Z`,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      timeZone: "America/New_York",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await calendarRequest(department, `/events?${params.toString()}`, {
      method: "GET",
    });
    const result = (await response.json()) as {
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(result.error?.message || `Google Calendar read failed (${response.status}).`);
    }
    events.push(...(result.items ?? []).filter((event) => event.status !== "cancelled"));
    pageToken = result.nextPageToken ?? "";
  } while (pageToken);

  return events;
}
