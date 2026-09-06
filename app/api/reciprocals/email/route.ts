import {
  createClient,
} from "@supabase/supabase-js";

import {
  parseReciprocalEmailHtml,
} from "@/lib/reciprocal-email-parser";

type ClubRow = {
  id: number;
  name: string;
  advance_days: number | null;
  aliases: string[] | null;
  courses: string[] | null;
};

type InboundEmailBody = {
  HtmlBody?: unknown;
  TextBody?: unknown;
  MessageID?: unknown;
  Date?: unknown;
  Subject?: unknown;

  html?: unknown;
  message_id?: unknown;
  received_at?: unknown;
};

function normalize(
  value:
    | string
    | null
    | undefined
) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeMemberNumber(
  value:
    | string
    | null
    | undefined
) {
  const cleaned =
    (value ?? "").trim();

  const withoutLeadingZeroes =
    cleaned.replace(
      /^0+/,
      ""
    );

  return (
    withoutLeadingZeroes ||
    cleaned
  );
}

function subtractDays(
  value: string,
  days: number
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  date.setUTCDate(
    date.getUTCDate() -
      Math.max(0, days)
  );

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0"),

    String(
      date.getUTCDate()
    ).padStart(2, "0"),
  ].join("-");
}

function meaningfulWords(
  value: string
) {
  const ignoredWords =
    new Set([
      "the",
      "at",
      "of",
      "club",
      "golf",
      "course",
      "country",
    ]);

  return normalize(value)
    .split(" ")
    .filter(
      (word) =>
        word.length > 1 &&
        !ignoredWords.has(
          word
        )
    );
}

function clubMatchScore(
  choice: string,
  club: ClubRow
) {
  const target =
    normalize(choice);

  if (!target) {
    return 0;
  }

  const candidates = [
    club.name,

    ...(club.aliases ?? []),

    ...(club.courses ?? [])
      .map(
        (course) =>
          `${club.name} ${course}`
      ),

    ...(club.courses ?? []),
  ].map(normalize);

  let best = 0;

  for (
    const candidate
    of candidates
  ) {
    if (!candidate) {
      continue;
    }

    if (
      candidate === target
    ) {
      best =
        Math.max(
          best,
          100
        );

      continue;
    }

    const targetWords =
      meaningfulWords(
        target
      );

    const candidateWords =
      meaningfulWords(
        candidate
      );

    if (
      targetWords.length >= 2 &&
      candidateWords.length >= 2 &&
      (
        candidate.includes(
          target
        ) ||
        target.includes(
          candidate
        )
      )
    ) {
      best =
        Math.max(
          best,
          85
        );

      continue;
    }

    const candidateWordSet =
      new Set(
        candidateWords
      );

    const overlap =
      targetWords
        .filter(
          (word) =>
            candidateWordSet.has(
              word
            )
        )
        .length;

    const requiredOverlap =
      Math.min(
        targetWords.length,
        candidateWords.length
      );

    if (
      overlap >= 2 &&
      overlap ===
        requiredOverlap
    ) {
      best =
        Math.max(
          best,
          70
        );
    }
  }

  return best;
}

function pickClub(
  choice: string,
  clubs: ClubRow[]
) {
  let best: {
    club: ClubRow;
    score: number;
  } | null = null;

  for (
    const club
    of clubs
  ) {
    const score =
      clubMatchScore(
        choice,
        club
      );

    if (
      !best ||
      score > best.score
    ) {
      best = {
        club,
        score,
      };
    }
  }

  return (
    best &&
    best.score >= 70
      ? best.club
      : null
  );
}

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function receivedAtValue(
  value: unknown
) {
  const text =
    stringValue(value);

  if (!text) {
    return new Date()
      .toISOString();
  }

  const date =
    new Date(text);

  return Number.isNaN(
    date.getTime()
  )
    ? new Date()
        .toISOString()
    : date.toISOString();
}

export async function POST(
  request: Request
) {
  try {
    const expectedSecret =
      process.env
        .GOLFOPS_RECIPROCAL_EMAIL_SECRET;

    const requestUrl =
      new URL(request.url);

    const suppliedSecret =
      request.headers.get(
        "x-golfops-email-secret"
      ) ??
      requestUrl.searchParams.get(
        "secret"
      );

    if (
      !expectedSecret ||
      suppliedSecret !==
        expectedSecret
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error(
        "Server email-ingestion credentials are not configured."
      );

      return Response.json(
        {
          ok: false,
          error:
            "Server email-ingestion credentials are not configured.",
        },
        {
          status: 500,
        }
      );
    }

    let body:
      InboundEmailBody;

    try {
      body =
        (await request.json()) as
          InboundEmailBody;
    } catch {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid JSON request body.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Support both formats:

      Postmark:
        HtmlBody
        MessageID
        Date

      Original GolfOps format:
        html
        message_id
        received_at
    */

    const html =
      stringValue(
        body.HtmlBody
      ) ||
      stringValue(
        body.html
      );

    const messageId =
      stringValue(
        body.MessageID
      ) ||
      stringValue(
        body.message_id
      );

    const receivedAt =
      receivedAtValue(
        body.Date ??
          body.received_at
      );

    if (
      !html ||
      !messageId
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Email HTML and message ID are required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !/Golf Reciprocal Request Form/i
        .test(html)
    ) {
      return Response.json(
        {
          ok: false,
          ignored: true,
          error:
            "Email is not a Golf Reciprocal Request Form submission.",
        },
        {
          status: 200,
        }
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        }
      );

    const {
      data: club,
      error: clubError,
    } =
      await supabase
        .from("clubs")
        .select("id")
        .or(
          "name.ilike.%TwinEagles%,name.ilike.%Twin Eagles%"
        )
        .limit(1)
        .maybeSingle();

    if (
      clubError ||
      !club?.id
    ) {
      console.error(
        "Email import club lookup error:",
        clubError
      );

      return Response.json(
        {
          ok: false,
          error:
            "TwinEagles club record could not be found.",
        },
        {
          status: 500,
        }
      );
    }

    const clubId =
      club.id;

    const {
      data: duplicate,
      error: duplicateError,
    } =
      await supabase
        .from(
          "reciprocal_requests"
        )
        .select("id")
        .eq(
          "club_id",
          clubId
        )
        .eq(
          "email_message_id",
          messageId
        )
        .maybeSingle();

    if (duplicateError) {
      console.error(
        "Duplicate reciprocal lookup error:",
        duplicateError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to check the inbound message.",
        },
        {
          status: 500,
        }
      );
    }

    if (duplicate?.id) {
      return Response.json({
        ok: true,
        duplicate: true,
        request_id:
          duplicate.id,
      });
    }

    const parsed =
      parseReciprocalEmailHtml(
        html
      );

    if (
      !parsed.firstName ||
      !parsed.lastName ||
      !parsed.preferredDate ||
      parsed.courseChoices
        .length === 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "The reciprocal email was recognized, but required form fields could not be parsed.",
          parsed,
        },
        {
          status: 422,
        }
      );
    }

    const [
      {
        data: members,
        error:
          membersError,
      },

      {
        data:
          reciprocalClubs,

        error:
          clubsError,
      },
    ] =
      await Promise.all([
        supabase
          .from("members")
          .select(`
            id,
            full_name,
            first_name,
            last_name,
            member_number,
            bag_number
          `)
          .eq(
            "club_id",
            clubId
          ),

        supabase
          .from(
            "reciprocal_clubs"
          )
          .select(`
            id,
            name,
            advance_days,
            aliases,
            courses
          `)
          .eq(
            "club_id",
            clubId
          )
          .eq(
            "active",
            true
          ),
      ]);

    if (
      membersError ||
      clubsError
    ) {
      console.error(
        "Email import lookup error:",
        {
          membersError,
          clubsError,
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to load GolfOps lookup data.",
        },
        {
          status: 500,
        }
      );
    }

    const requestedMemberNumber =
      normalizeMemberNumber(
        parsed.memberNumber
      );

    const requestedName =
      normalize(
        `${parsed.firstName} ${parsed.lastName}`
      );

    const memberByNumber =
      requestedMemberNumber
        ? (
            members ?? []
          ).find(
            (row) =>
              normalizeMemberNumber(
                row.member_number
              ) ===
              requestedMemberNumber
          )
        : null;

    const member =
      memberByNumber ??
      (
        members ?? []
      ).find(
        (row) => {
          const name =
            normalize(
              row.full_name ||
                `${row.first_name ?? ""} ${row.last_name ?? ""}`
            );

          return (
            name ===
            requestedName
          );
        }
      ) ??
      null;

    const clubs =
      (
        reciprocalClubs ??
        []
      ) as ClubRow[];

    const primaryChoice =
      parsed.courseChoices[0];

    const matchedClub =
      pickClub(
        primaryChoice,
        clubs
      );

    const advanceDays =
      Math.max(
        0,
        Number(
          matchedClub
            ?.advance_days ??
            0
        )
      );

    const callDueDate =
      subtractDays(
        parsed.preferredDate,
        advanceDays
      );

    const enteredPlayerCount =
      parsed.groups.reduce(
        (
          total,
          group
        ) =>
          total +
          group.players.length,
        0
      );

    const numberOfPlayers =
      parsed.numberOfPlayers &&
      parsed.numberOfPlayers > 0
        ? parsed.numberOfPlayers
        : enteredPlayerCount;

    const {
      data: created,
      error: insertError,
    } =
      await supabase
        .from(
          "reciprocal_requests"
        )
        .insert({
          club_id:
            clubId,

          member_id:
            member?.id ??
            null,

          member_name:
            `${parsed.firstName} ${parsed.lastName}`
              .trim(),

          member_number:
            requestedMemberNumber ||
            null,

          member_email:
            parsed.emailAddress ||
            null,

          member_phone:
            null,

          reciprocal_club_id:
            matchedClub?.id ??
            null,

          course_choice_text:
            primaryChoice,

          course_pick:
            null,

          course_alternates:
            parsed.courseChoices
              .slice(1),

          preferred_date:
            parsed.preferredDate,

          preferred_time:
            parsed.preferredTime,

          time_range:
            parsed.timeRange,

          number_of_players:
            numberOfPlayers,

          group_members:
            parsed.groups,

          status:
            "PENDING_CALL",

          source:
            "EMAIL_FORM",

          call_due_at:
            `${callDueDate}T12:00:00Z`,

          email_message_id:
            messageId,

          email_received_at:
            receivedAt,

          raw_email_body:
            html,
        })
        .select(`
          id,
          member_name,
          reciprocal_club_id,
          course_choice_text,
          preferred_date,
          call_due_at
        `)
        .single();

    if (
      insertError ||
      !created
    ) {
      console.error(
        "Reciprocal email insert error:",
        insertError
      );

      return Response.json(
        {
          ok: false,
          error:
            insertError
              ?.message ||
            "Unable to create the reciprocal request.",
        },
        {
          status: 500,
        }
      );
    }

    return Response.json({
      ok: true,
      request: created,
      matched_member:
        Boolean(member),
      matched_club:
        Boolean(
          matchedClub
        ),
    });
  } catch (error) {
    console.error(
      "Unexpected reciprocal email import error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to import the reciprocal email.",
      },
      {
        status: 500,
      }
    );
  }
}
