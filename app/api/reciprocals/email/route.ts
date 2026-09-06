import { createClient } from "@supabase/supabase-js";
import { parseReciprocalEmailHtml } from "@/lib/reciprocal-email-parser";

type ClubRow = {
  id: number;
  name: string;
  advance_days: number | null;
  aliases: string[] | null;
  courses: string[] | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeMemberNumber(value: string | null | undefined) {
  const cleaned = (value ?? "").trim();
  const withoutLeadingZeroes = cleaned.replace(/^0+/, "");
  return withoutLeadingZeroes || cleaned;
}

function subtractDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() - Math.max(0, days));

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function clubMatchScore(choice: string, club: ClubRow) {
  const target = normalize(choice);
  if (!target) return 0;

  const candidates = [
    club.name,
    ...(club.aliases ?? []),
    ...(club.courses ?? []).map((course) => `${club.name} ${course}`),
    ...(club.courses ?? []),
  ].map(normalize);

  let best = 0;

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (candidate === target) {
      best = Math.max(best, 100);
      continue;
    }

    if (candidate.includes(target) || target.includes(candidate)) {
      best = Math.max(best, 80);
    }

    const targetWords = new Set(target.split(" "));
    const candidateWords = new Set(candidate.split(" "));
    const overlap = [...targetWords].filter((word) =>
      candidateWords.has(word)
    ).length;

    if (overlap > 0) {
      best = Math.max(
        best,
        Math.round(
          (overlap / Math.max(targetWords.size, candidateWords.size)) * 60
        )
      );
    }
  }

  return best;
}

function pickClub(choice: string, clubs: ClubRow[]) {
  let best: { club: ClubRow; score: number } | null = null;

  for (const club of clubs) {
    const score = clubMatchScore(choice, club);

    if (!best || score > best.score) {
      best = { club, score };
    }
  }

  return best && best.score >= 40 ? best.club : null;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.GOLFOPS_RECIPROCAL_EMAIL_SECRET;
  const suppliedSecret = request.headers.get("x-golfops-email-secret");

  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      {
        ok: false,
        error: "Server email-ingestion credentials are not configured.",
      },
      { status: 500 }
    );
  }

  const body = (await request.json()) as Record<string, unknown>;

  const html = typeof body.html === "string" ? body.html : "";
  const messageId =
    typeof body.message_id === "string" ? body.message_id.trim() : "";
  const receivedAt =
    typeof body.received_at === "string" && body.received_at.trim()
      ? body.received_at.trim()
      : new Date().toISOString();

  if (!html || !messageId) {
    return Response.json(
      {
        ok: false,
        error: "html and message_id are required.",
      },
      { status: 400 }
    );
  }

  if (!/Golf Reciprocal Request Form/i.test(html)) {
    return Response.json(
      {
        ok: false,
        ignored: true,
        error: "Email is not a Golf Reciprocal Request Form submission.",
      },
      { status: 200 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id")
    .or("name.ilike.%TwinEagles%,name.ilike.%Twin Eagles%")
    .limit(1)
    .maybeSingle();

  if (clubError || !club?.id) {
    console.error("Email import club lookup error:", clubError);

    return Response.json(
      { ok: false, error: "TwinEagles club record could not be found." },
      { status: 500 }
    );
  }

  const clubId = club.id;

  const { data: duplicate } = await supabase
    .from("reciprocal_requests")
    .select("id")
    .eq("club_id", clubId)
    .eq("email_message_id", messageId)
    .maybeSingle();

  if (duplicate?.id) {
    return Response.json({
      ok: true,
      duplicate: true,
      request_id: duplicate.id,
    });
  }

  const parsed = parseReciprocalEmailHtml(html);

  if (
    !parsed.firstName ||
    !parsed.lastName ||
    !parsed.preferredDate ||
    parsed.courseChoices.length === 0
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "The reciprocal email was recognized, but required form fields could not be parsed.",
        parsed,
      },
      { status: 422 }
    );
  }

  const [{ data: members, error: membersError }, { data: reciprocalClubs, error: clubsError }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, full_name, first_name, last_name, member_number, bag_number")
        .eq("club_id", clubId),

      supabase
        .from("reciprocal_clubs")
        .select("id, name, advance_days, aliases, courses")
        .eq("club_id", clubId)
        .eq("active", true),
    ]);

  if (membersError || clubsError) {
    console.error("Email import lookup error:", {
      membersError,
      clubsError,
    });

    return Response.json(
      { ok: false, error: "Unable to load GolfOps lookup data." },
      { status: 500 }
    );
  }

  const requestedMemberNumber = normalizeMemberNumber(parsed.memberNumber);
  const requestedName = normalize(`${parsed.firstName} ${parsed.lastName}`);

  const member =
    (members ?? []).find(
      (row) =>
        normalizeMemberNumber(row.member_number) === requestedMemberNumber
    ) ??
    (members ?? []).find((row) => {
      const name = normalize(
        row.full_name || `${row.first_name ?? ""} ${row.last_name ?? ""}`
      );

      return name === requestedName;
    }) ??
    null;

  const clubs = (reciprocalClubs ?? []) as ClubRow[];
  const primaryChoice = parsed.courseChoices[0];
  const matchedClub = pickClub(primaryChoice, clubs);

  const advanceDays = matchedClub?.advance_days ?? 0;
  const callDueDate = subtractDays(parsed.preferredDate, advanceDays);

  const enteredPlayerCount =
    parsed.groups.reduce((total, group) => total + group.players.length, 0) ||
    parsed.numberOfPlayers ||
    0;

  const { data: created, error: insertError } = await supabase
    .from("reciprocal_requests")
    .insert({
      club_id: clubId,
      member_id: member?.id ?? null,
      member_name: `${parsed.firstName} ${parsed.lastName}`.trim(),
      member_number: normalizeMemberNumber(parsed.memberNumber) || null,
      member_email: parsed.emailAddress || null,
      member_phone: null,
      reciprocal_club_id: matchedClub?.id ?? null,
      course_choice_text: primaryChoice,
      course_pick: null,
      course_alternates: parsed.courseChoices.slice(1),
      preferred_date: parsed.preferredDate,
      preferred_time: parsed.preferredTime,
      time_range: parsed.timeRange,
      number_of_players: parsed.numberOfPlayers ?? enteredPlayerCount,
      group_members: parsed.groups,
      status: "PENDING_CALL",
      source: "EMAIL_FORM",
      call_due_at: `${callDueDate}T12:00:00Z`,
      email_message_id: messageId,
      email_received_at: receivedAt,
      raw_email_body: html,
    })
    .select(
      "id, member_name, reciprocal_club_id, course_choice_text, preferred_date, call_due_at"
    )
    .single();

  if (insertError || !created) {
    console.error("Reciprocal email insert error:", insertError);

    return Response.json(
      {
        ok: false,
        error:
          insertError?.message || "Unable to create the reciprocal request.",
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    request: created,
    matched_member: Boolean(member),
    matched_club: Boolean(matchedClub),
  });
}
