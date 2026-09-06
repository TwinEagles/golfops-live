import { createClient } from "@/lib/supabase/server";
import { getGolfOpsAccess } from "@/lib/permissions";

type RawGroup = {
  players?: unknown;
};

type CleanGroup = {
  group: number;
  players: string[];
};

function subtractDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

async function requireReciprocalAccess() {
  const access = await getGolfOpsAccess();

  if (!access) {
    return {
      ok: false as const,
      response: Response.json(
        { ok: false, error: "You must be signed in." },
        { status: 401 }
      ),
    };
  }

  const allowed =
    access.isAdmin ||
    access.permissions.reciprocals === true;

  if (!allowed) {
    return {
      ok: false as const,
      response: Response.json(
        { ok: false, error: "You do not have access to Reciprocals." },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    access,
  };
}

export async function POST(request: Request) {
  const auth = await requireReciprocalAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = await createClient();

  const body = (await request.json()) as Record<string, unknown>;

  const memberId = Number(body.member_id);
  const reciprocalClubId = Number(body.reciprocal_club_id);
  const preferredDate =
    typeof body.preferred_date === "string" ? body.preferred_date : "";

  if (
    !Number.isInteger(memberId) ||
    !Number.isInteger(reciprocalClubId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
  ) {
    return Response.json(
      { ok: false, error: "Member, club, and preferred date are required." },
      { status: 400 }
    );
  }

  const [{ data: member }, { data: reciprocalClub }] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, first_name, last_name, member_number, bag_number")
      .eq("club_id", auth.access.clubId)
      .eq("id", memberId)
      .single(),

    supabase
      .from("reciprocal_clubs")
      .select("id, name, advance_days")
      .eq("club_id", auth.access.clubId)
      .eq("id", reciprocalClubId)
      .eq("active", true)
      .single(),
  ]);

  if (!member || !reciprocalClub) {
    return Response.json(
      {
        ok: false,
        error: "Unable to find the selected member or reciprocal club.",
      },
      { status: 404 }
    );
  }

  const memberName =
    member.full_name?.trim() ||
    `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();

  const rawGroups: RawGroup[] = Array.isArray(body.group_members)
    ? (body.group_members as RawGroup[])
    : [];

  const cleanGroups: CleanGroup[] = rawGroups
    .map((group: RawGroup, index: number): CleanGroup => {
      const players: string[] = Array.isArray(group?.players)
        ? group.players
            .filter(
              (value: unknown): value is string =>
                typeof value === "string"
            )
            .map((value: string) => value.trim())
            .filter((value: string) => Boolean(value))
            .slice(0, 4)
        : [];

      return {
        group: index + 1,
        players,
      };
    })
    .filter((group: CleanGroup) => group.players.length > 0)
    .slice(0, 4);

  const numberOfPlayers = cleanGroups.reduce(
    (total: number, group: CleanGroup) =>
      total + group.players.length,
    0
  );

  if (numberOfPlayers < 1) {
    return Response.json(
      { ok: false, error: "At least one player is required." },
      { status: 400 }
    );
  }

  const advanceDays = Math.max(
    0,
    Number(reciprocalClub.advance_days ?? 0)
  );
  const callDueDate = subtractDays(
    preferredDate,
    advanceDays
  );

  const courseAlternates: string[] = Array.isArray(body.course_alternates)
    ? body.course_alternates
        .filter(
          (value: unknown): value is string =>
            typeof value === "string"
        )
        .map((value: string) => value.trim())
        .filter((value: string) => Boolean(value))
        .slice(0, 3)
    : [];

  const { data: created, error } = await supabase
    .from("reciprocal_requests")
    .insert({
      club_id: auth.access.clubId,
      member_id: member.id,
      member_name: memberName,
      member_number:
        member.member_number ||
        member.bag_number ||
        null,
      member_email: null,
      member_phone: null,
      reciprocal_club_id: reciprocalClub.id,
      course_choice_text: reciprocalClub.name,
      course_pick:
        typeof body.course_pick === "string" &&
        body.course_pick.trim()
          ? body.course_pick.trim()
          : null,
      course_alternates: courseAlternates,
      preferred_date: preferredDate,
      preferred_time:
        typeof body.preferred_time === "string" &&
        body.preferred_time.trim()
          ? body.preferred_time.trim()
          : null,
      time_range:
        typeof body.time_range === "string" &&
        body.time_range.trim()
          ? body.time_range.trim()
          : null,
      number_of_players: numberOfPlayers,
      group_members: cleanGroups,
      status: "PENDING_CALL",
      source: "MANUAL",
      call_due_at: `${callDueDate}T12:00:00Z`,
    })
    .select("id, status, call_due_at")
    .single();

  if (error || !created) {
    console.error("Create reciprocal error:", error);

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to create reciprocal request.",
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    request: created,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireReciprocalAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = await createClient();

  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const status =
    typeof body.status === "string"
      ? body.status.toUpperCase()
      : "";

  if (
    !Number.isInteger(id) ||
    !["BOOKED", "DECLINED", "CANCELLED"].includes(status)
  ) {
    return Response.json(
      {
        ok: false,
        error: "A valid request and status are required.",
      },
      { status: 400 }
    );
  }

  const updates = {
    status,
    confirmed_tee_time:
      typeof body.confirmed_tee_time === "string" &&
      body.confirmed_tee_time.trim()
        ? body.confirmed_tee_time.trim()
        : null,
    confirmation_number:
      typeof body.confirmation_number === "string" &&
      body.confirmation_number.trim()
        ? body.confirmation_number.trim()
        : null,
    staff_initials:
      typeof body.staff_initials === "string" &&
      body.staff_initials.trim()
        ? body.staff_initials.trim()
        : null,
    call_notes:
      typeof body.call_notes === "string" &&
      body.call_notes.trim()
        ? body.call_notes.trim()
        : null,
    decline_reason:
      typeof body.decline_reason === "string" &&
      body.decline_reason.trim()
        ? body.decline_reason.trim()
        : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("reciprocal_requests")
    .update(updates)
    .eq("club_id", auth.access.clubId)
    .eq("id", id)
    .select(
      "id, status, confirmed_tee_time, confirmation_number, staff_initials, call_notes, decline_reason"
    )
    .single();

  if (error || !data) {
    console.error("Update reciprocal error:", error);

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to update reciprocal request.",
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    request: data,
  });
}
