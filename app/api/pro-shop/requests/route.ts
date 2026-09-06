import { createClient } from "@/lib/supabase/server";
import { getGolfOpsAccess } from "@/lib/permissions";

const ALLOWED_TYPES =
  new Set([
    "PRACTICE",
    "TAKEAWAY",
    "LESSON",
  ]);

const ALLOWED_STATUSES =
  new Set([
    "COMPLETED",
    "CANCELLED",
  ]);

async function requireProShopAccess() {
  const access =
    await getGolfOpsAccess();

  if (!access) {
    return {
      ok: false as const,
      response: Response.json(
        {
          error:
            "You must be signed in.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const allowed =
    access.isAdmin ||
    access.permissions
      .pro_shop === true;

  if (!allowed) {
    return {
      ok: false as const,
      response: Response.json(
        {
          error:
            "You do not have access to Pro Shop.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    ok: true as const,
    access,
  };
}

export async function POST(
  request: Request
) {
  const auth =
    await requireProShopAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const supabase =
    await createClient();

  const body =
    await request.json();

  const memberId =
    Number(body?.memberId);

  const requestType =
    typeof body?.requestType ===
      "string"
      ? body.requestType
          .trim()
          .toUpperCase()
      : "";

  const details =
    typeof body?.details ===
      "string"
      ? body.details.trim()
      : null;

  if (
    !Number.isInteger(
      memberId
    ) ||
    !ALLOWED_TYPES.has(
      requestType
    )
  ) {
    return Response.json(
      {
        error:
          "A valid member and request type are required.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: member,
    error: memberError,
  } =
    await supabase
      .from("members")
      .select(
        "id, full_name, first_name, last_name, member_number, bag_number"
      )
      .eq(
        "club_id",
        auth.access.clubId
      )
      .eq(
        "id",
        memberId
      )
      .single();

  if (
    memberError ||
    !member
  ) {
    return Response.json(
      {
        error:
          "Member not found.",
      },
      {
        status: 404,
      }
    );
  }

  const memberName =
    member.full_name?.trim() ||
    [
      member.first_name,
      member.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Unknown Member";

  const {
    data: created,
    error: insertError,
  } =
    await supabase
      .from(
        "pro_shop_requests"
      )
      .insert({
        club_id:
          auth.access.clubId,
        member_id:
          member.id,
        request_type:
          requestType,
        member_name_snapshot:
          memberName,
        member_number_snapshot:
          member.member_number,
        bag_number_snapshot:
          member.bag_number,
        details:
          details || null,
        status:
          "ACTIVE",
        created_by:
          auth.access.userId,
      })
      .select(`
        id,
        request_type,
        member_id,
        member_name_snapshot,
        member_number_snapshot,
        bag_number_snapshot,
        details,
        status,
        created_at
      `)
      .single();

  if (
    insertError ||
    !created
  ) {
    console.error(
      "Pro Shop request insert error:",
      insertError
    );

    return Response.json(
      {
        error:
          "Unable to create the request.",
      },
      {
        status: 500,
      }
    );
  }

  return Response.json({
    ok: true,
    request: created,
  });
}

export async function PATCH(
  request: Request
) {
  const auth =
    await requireProShopAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const supabase =
    await createClient();

  const body =
    await request.json();

  const id =
    Number(body?.id);

  const status =
    typeof body?.status ===
      "string"
      ? body.status
          .trim()
          .toUpperCase()
      : "";

  if (
    !Number.isInteger(id) ||
    !ALLOWED_STATUSES.has(
      status
    )
  ) {
    return Response.json(
      {
        error:
          "Invalid request update.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: updated,
    error,
  } =
    await supabase
      .from(
        "pro_shop_requests"
      )
      .update({
        status,
        completed_at:
          new Date().toISOString(),
        completed_by:
          auth.access.userId,
      })
      .eq("id", id)
      .eq(
        "club_id",
        auth.access.clubId
      )
      .eq(
        "status",
        "ACTIVE"
      )
      .select(
        "id, status, completed_at"
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Pro Shop request update error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to update the request.",
      },
      {
        status: 500,
      }
    );
  }

  if (!updated) {
    return Response.json(
      {
        error:
          "Active request not found.",
      },
      {
        status: 404,
      }
    );
  }

  return Response.json({
    ok: true,
    request: updated,
  });
}
