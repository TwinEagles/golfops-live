import { createClient } from "@supabase/supabase-js";

type ForeTeesMemberPayload = {
  foreteesUsername?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  memberNumber?: unknown;
  posId?: unknown;
  bagNumber?: unknown;
  membershipType?: unknown;
  memberType?: unknown;
  status?: unknown;
  lastSyncDate?: unknown;
};

function safeText(
  value: unknown,
  maximumLength = 250
) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function normalizeDate(value: unknown) {
  const cleaned = safeText(value, 20);

  if (!cleaned) {
    return null;
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(cleaned)
  ) {
    return cleaned;
  }

  const match = cleaned.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const month = String(
    Number(match[1])
  ).padStart(2, "0");

  const day = String(
    Number(match[2])
  ).padStart(2, "0");

  return `${match[3]}-${month}-${day}`;
}

export async function POST(request: Request) {
  try {
    /*
      Authenticate the Chrome extension
      using its stored Supabase access token.
    */

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization?.startsWith("Bearer ")
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Missing authorization token.",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken = authorization
      .replace("Bearer ", "")
      .trim();

    const supabase = createClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authenticationError,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (
      authenticationError ||
      !user
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Your GolfOps extension login is invalid or expired.",
        },
        {
          status: 401,
        }
      );
    }

    /*
      Determine the user's club and role.
    */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("club_id, role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.club_id
    ) {
      console.error(
        "ForeTees bag sync profile error:",
        profileError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to determine your GolfOps club.",
        },
        {
          status: 403,
        }
      );
    }

    /*
      Admins always have access.
      Other users must have Bag Finder
      permission.
    */

    if (profile.role !== "admin") {
      const {
        data: permission,
        error: permissionError,
      } = await supabase
        .from("user_permissions")
        .select("bag_finder")
        .eq("user_id", user.id)
        .eq(
          "club_id",
          profile.club_id
        )
        .maybeSingle();

      if (
        permissionError ||
        permission?.bag_finder !== true
      ) {
        if (permissionError) {
          console.error(
            "ForeTees bag sync permission error:",
            permissionError
          );
        }

        return Response.json(
          {
            ok: false,
            error:
              "You do not have permission to update Bag Finder.",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
      Validate the member supplied by the
      ForeTees Admin content script.
    */

    let body: ForeTeesMemberPayload;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          ok: false,
          error:
            "The extension sent an invalid request.",
        },
        {
          status: 400,
        }
      );
    }

    const foreteesUsername =
      safeText(
        body.foreteesUsername,
        100
      );

    const firstName =
      safeText(body.firstName, 150);

    const lastName =
      safeText(body.lastName, 150);

    const memberNumber =
      safeText(
        body.memberNumber,
        100
      );

    const posId =
      safeText(body.posId, 100);

    const bagNumber =
      safeText(
        body.bagNumber,
        100
      ).toUpperCase();

    const membershipType =
      safeText(
        body.membershipType,
        150
      );

    const memberType =
      safeText(
        body.memberType,
        150
      );

    const foreteesStatus =
      safeText(body.status, 50);

    const lastSyncDate =
      normalizeDate(
        body.lastSyncDate
      );

    if (
      !foreteesUsername ||
      !firstName ||
      !lastName
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "ForeTees did not provide a username and complete member name.",
        },
        {
          status: 400,
        }
      );
    }

    const clubId =
      profile.club_id;

    const fullName =
      `${firstName} ${lastName}`
        .replace(/\s+/g, " ")
        .trim();

    const now =
      new Date().toISOString();

    /*
      First match by the permanent
      ForeTees username.
    */

    const {
      data: usernameMatch,
      error: usernameLookupError,
    } = await supabase
      .from("members")
      .select("id")
      .eq("club_id", clubId)
      .eq(
        "foretees_username",
        foreteesUsername
      )
      .maybeSingle();

    if (usernameLookupError) {
      console.error(
        "ForeTees username lookup error:",
        usernameLookupError
      );

      return Response.json(
        {
          ok: false,
          error:
            usernameLookupError.message,
        },
        {
          status: 500,
        }
      );
    }

    let existingMemberId:
      number | null =
      usernameMatch?.id ?? null;

    /*
      During the first synchronization,
      existing Bag Finder records will not
      have a ForeTees username.

      Match using the exact first and last
      name. Member number is not used alone
      because family members can share it.
    */

    if (!existingMemberId) {
      const {
        data: nameMatches,
        error: nameLookupError,
      } = await supabase
        .from("members")
        .select(
          "id, member_number"
        )
        .eq("club_id", clubId)
        .ilike(
          "first_name",
          firstName
        )
        .ilike(
          "last_name",
          lastName
        )
        .limit(10);

      if (nameLookupError) {
        console.error(
          "ForeTees member-name lookup error:",
          nameLookupError
        );

        return Response.json(
          {
            ok: false,
            error:
              nameLookupError.message,
          },
          {
            status: 500,
          }
        );
      }

      const candidates =
        nameMatches ?? [];

      const exactMemberNumberMatch =
        memberNumber
          ? candidates.find(
              (candidate) =>
                (
                  candidate
                    .member_number ??
                  ""
                ).trim() ===
                memberNumber
            )
          : null;

      if (exactMemberNumberMatch) {
        existingMemberId =
          exactMemberNumberMatch.id;
      } else if (
        candidates.length === 1
      ) {
        existingMemberId =
          candidates[0].id;
      }
    }

    const memberValues = {
      club_id: clubId,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      bag_number:
        bagNumber || null,
      foretees_username:
        foreteesUsername,
      foretees_pos_id:
        posId || null,
      foretees_membership_type:
        membershipType || null,
      foretees_member_type:
        memberType || null,
      foretees_status:
        foreteesStatus || null,
      foretees_last_sync_date:
        lastSyncDate,
      foretees_synced_at: now,
      updated_at: now,
      ...(memberNumber
        ? {
            member_number:
              memberNumber,
          }
        : {}),
    };

    /*
      Update the existing member or create
      a new Bag Finder member.
    */

    if (existingMemberId) {
      const {
        data: updatedMember,
        error: updateError,
      } = await supabase
        .from("members")
        .update(memberValues)
        .eq("id", existingMemberId)
        .eq("club_id", clubId)
        .select(
          "id, full_name, member_number, bag_number"
        )
        .single();

      if (updateError) {
        console.error(
          "ForeTees Bag Finder update error:",
          updateError
        );

        return Response.json(
          {
            ok: false,
            error:
              updateError.message,
          },
          {
            status: 500,
          }
        );
      }

      return Response.json({
        ok: true,
        action: "updated",
        member: updatedMember,
        message: bagNumber
          ? `${fullName} was updated with bag ${bagNumber}.`
          : `${fullName}'s bag assignment was cleared.`,
      });
    }

    const {
      data: insertedMember,
      error: insertError,
    } = await supabase
      .from("members")
      .insert(memberValues)
      .select(
        "id, full_name, member_number, bag_number"
      )
      .single();

    if (insertError) {
      console.error(
        "ForeTees Bag Finder insert error:",
        insertError
      );

      return Response.json(
        {
          ok: false,
          error:
            insertError.message,
        },
        {
          status: 500,
        }
      );
    }

    return Response.json({
      ok: true,
      action: "created",
      member: insertedMember,
      message: bagNumber
        ? `${fullName} was added with bag ${bagNumber}.`
        : `${fullName} was added without a bag assignment.`,
    });
  } catch (error) {
    console.error(
      "ForeTees Bag Finder sync route error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update Bag Finder.",
      },
      {
        status: 500,
      }
    );
  }
}