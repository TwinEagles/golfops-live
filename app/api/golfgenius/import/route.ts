import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

type GolfGeniusEventType = "CLINIC" | "FITTING";

type GolfGeniusParticipant = {
  name?: unknown;
  appointmentTime?: unknown;
  status?: unknown;
};

type GolfGeniusEvent = {
  externalId?: unknown;
  directoryGgid?: unknown;
  type?: unknown;
  name?: unknown;
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  location?: unknown;
  registrationStatus?: unknown;
  sourceUrl?: unknown;
  sourceText?: unknown;
  participants?: unknown;
};

type GolfGeniusDirectory = {
  ggid?: unknown;
  type?: unknown;
  complete?: unknown;
  error?: unknown;
};

type ImportRequestBody = {
  trigger?: unknown;
  events?: unknown;
  directories?: unknown;
};

function cleanText(value: unknown, maximum = 500) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function optionalText(value: unknown, maximum = 500) {
  const text = cleanText(value, maximum);
  return text || null;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

function eventType(value: unknown): GolfGeniusEventType | null {
  return value === "CLINIC" || value === "FITTING" ? value : null;
}

function registrationKey(name: string, appointmentTime: string | null, index: number) {
  const normalized = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${normalized || "participant"}:${appointmentTime ?? "open"}:${index}`;
}

async function authenticatedClient(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const accessToken = authHeader.slice("Bearer ".length).trim();
    if (!accessToken) return { supabase: null, user: null, error: "Missing authorization token." };

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return { supabase: null, user: null, error: "Invalid or expired GolfOps Live login." };
    return { supabase, user, error: null };
  }

  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase: null, user: null, error: "Not authenticated." };
  return { supabase, user, error: null };
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedClient(request);
    if (!auth.supabase || !auth.user) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }

    const { data: profile, error: profileError } = await auth.supabase
      .from("profiles")
      .select("club_id, role")
      .eq("id", auth.user.id)
      .single();

    if (profileError || !profile?.club_id) {
      console.error("Golf Genius profile lookup failed:", profileError);
      return NextResponse.json(
        { ok: false, error: "Your GolfOps account is not assigned to a club." },
        { status: 403 }
      );
    }

    if (profile.role !== "admin") {
      const { data: permission, error: permissionError } = await auth.supabase
        .from("user_permissions")
        .select("tee_sheet")
        .eq("user_id", auth.user.id)
        .eq("club_id", profile.club_id)
        .maybeSingle();

      if (permissionError) {
        console.error("Golf Genius permission lookup failed:", permissionError);
        return NextResponse.json({ ok: false, error: "Unable to verify your GolfOps permissions." }, { status: 500 });
      }
      if (permission?.tee_sheet !== true) {
        return NextResponse.json({ ok: false, error: "You do not have permission to sync Golf Genius." }, { status: 403 });
      }
    }

    let body: ImportRequestBody;
    try {
      body = await request.json() as ImportRequestBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 });
    }

    const incomingEvents = Array.isArray(body.events) ? body.events as GolfGeniusEvent[] : [];
    const incomingDirectories = Array.isArray(body.directories) ? body.directories as GolfGeniusDirectory[] : [];
    if (incomingEvents.length > 200) {
      return NextResponse.json({ ok: false, error: "Golf Genius returned too many events in one sync." }, { status: 400 });
    }

    const directories = incomingDirectories
      .map((directory) => ({
        ggid: cleanText(directory.ggid, 40).toLowerCase(),
        type: eventType(directory.type),
        complete: directory.complete === true,
        error: optionalText(directory.error, 500),
      }))
      .filter((directory): directory is { ggid: string; type: GolfGeniusEventType; complete: boolean; error: string | null } =>
        Boolean(directory.ggid && directory.type)
      );

    const events = incomingEvents.flatMap((event) => {
      const type = eventType(event.type);
      const externalId = cleanText(event.externalId, 180);
      const directoryGgid = cleanText(event.directoryGgid, 40).toLowerCase();
      const name = cleanText(event.name, 250);
      const date = validDate(event.date) ? event.date : null;
      const sourceUrl = cleanText(event.sourceUrl, 1500);
      if (!type || !externalId || !directoryGgid || !name || !date || !sourceUrl) return [];

      const participants = Array.isArray(event.participants)
        ? (event.participants as GolfGeniusParticipant[]).slice(0, 500).flatMap((participant, index) => {
            const participantName = cleanText(participant.name, 200);
            if (!participantName) return [];
            const appointmentTime = validTime(participant.appointmentTime) ? participant.appointmentTime : null;
            return [{
              name: participantName,
              appointmentTime,
              status: cleanText(participant.status, 40).toUpperCase() || "CONFIRMED",
              key: registrationKey(participantName, appointmentTime, index),
            }];
          })
        : [];

      return [{
        externalId,
        directoryGgid,
        type,
        name,
        date,
        startTime: validTime(event.startTime) ? event.startTime : null,
        endTime: validTime(event.endTime) ? event.endTime : null,
        location: optionalText(event.location, 300),
        registrationStatus: optionalText(event.registrationStatus, 80),
        sourceUrl,
        sourceText: optionalText(event.sourceText, 4000),
        participants,
      }];
    });

    const syncToken = crypto.randomUUID();
    const importedAt = new Date().toISOString();
    const eventRows = events.map((event) => ({
      club_id: profile.club_id,
      external_event_id: event.externalId,
      directory_ggid: event.directoryGgid,
      event_type: event.type,
      event_name: event.name,
      event_date: event.date,
      start_time: event.startTime,
      end_time: event.endTime,
      location: event.location,
      registration_status: event.registrationStatus,
      source_url: event.sourceUrl,
      source_text: event.sourceText,
      active: true,
      sync_token: syncToken,
      imported_at: importedAt,
      updated_at: importedAt,
    }));

    let savedEvents: Array<{ id: string; external_event_id: string; event_type: GolfGeniusEventType }> = [];
    if (eventRows.length > 0) {
      const { data, error } = await auth.supabase
        .from("golfgenius_events")
        .upsert(eventRows, { onConflict: "club_id,event_type,external_event_id" })
        .select("id, external_event_id, event_type");
      if (error) {
        console.error("Golf Genius event upsert failed:", error);
        return NextResponse.json({ ok: false, error: "Golf Genius events could not be saved." }, { status: 500 });
      }
      savedEvents = (data ?? []) as typeof savedEvents;
    }

    for (const directory of directories.filter((item) => item.complete)) {
      const { error } = await auth.supabase
        .from("golfgenius_events")
        .update({ active: false, updated_at: importedAt })
        .eq("club_id", profile.club_id)
        .eq("event_type", directory.type)
        .eq("directory_ggid", directory.ggid)
        .neq("sync_token", syncToken);
      if (error) console.error("Golf Genius stale event update failed:", error);
    }

    const savedByKey = new Map(
      savedEvents.map((event) => [`${event.event_type}:${event.external_event_id}`, event.id])
    );
    const savedIds = Array.from(savedByKey.values());
    if (savedIds.length > 0) {
      const { error } = await auth.supabase
        .from("golfgenius_registrations")
        .delete()
        .eq("club_id", profile.club_id)
        .in("event_id", savedIds);
      if (error) {
        console.error("Golf Genius registration replacement failed:", error);
        return NextResponse.json({ ok: false, error: "Existing Golf Genius registrations could not be replaced." }, { status: 500 });
      }
    }

    const registrationRows = events.flatMap((event) => {
      const eventId = savedByKey.get(`${event.type}:${event.externalId}`);
      if (!eventId) return [];
      return event.participants.map((participant) => ({
        club_id: profile.club_id,
        event_id: eventId,
        external_registration_key: participant.key,
        participant_name: participant.name,
        appointment_time: participant.appointmentTime,
        registration_status: participant.status,
        imported_at: importedAt,
        updated_at: importedAt,
      }));
    });

    if (registrationRows.length > 0) {
      const { error } = await auth.supabase.from("golfgenius_registrations").insert(registrationRows);
      if (error) {
        console.error("Golf Genius registration insert failed:", error);
        return NextResponse.json({ ok: false, error: "Golf Genius events were saved, but registrations could not be saved." }, { status: 500 });
      }
    }

    const directoryErrors = directories
      .filter((directory) => !directory.complete || directory.error)
      .map((directory) => ({ ggid: directory.ggid, type: directory.type, error: directory.error ?? "Directory was incomplete." }));
    const completeCount = directories.filter((directory) => directory.complete).length;
    const status = directoryErrors.length === 0 && directories.length > 0
      ? "SUCCESS"
      : completeCount > 0 || events.length > 0
        ? "PARTIAL"
        : "ERROR";

    const { error: runError } = await auth.supabase.from("golfgenius_sync_runs").insert({
      club_id: profile.club_id,
      sync_token: syncToken,
      trigger_type: body.trigger === "DAILY" ? "DAILY" : "MANUAL",
      status,
      event_count: events.length,
      registration_count: registrationRows.length,
      directory_errors: directoryErrors,
      imported_by: auth.user.id,
      imported_at: importedAt,
    });
    if (runError) console.error("Golf Genius sync history insert failed:", runError);

    return NextResponse.json({
      ok: status !== "ERROR",
      status,
      error: status === "ERROR"
        ? directoryErrors.map((item) => `${item.type}: ${item.error}`).join(" ") || "Golf Genius directories could not be read."
        : undefined,
      eventCount: events.length,
      registrationCount: registrationRows.length,
      directoryErrors,
      importedAt,
    }, { status: status === "ERROR" ? 422 : 200 });
  } catch (error) {
    console.error("Unexpected Golf Genius import error:", error);
    return NextResponse.json({ ok: false, error: "Unexpected error importing Golf Genius programs." }, { status: 500 });
  }
}
