import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Unauthorized",
          },
          {
            status: 401,
          }
        ),
    };
  }

  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select(
        "club_id, role"
      )
      .eq("id", user.id)
      .single();

  if (!profile?.club_id) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Unable to determine your club.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  if (
    profile.role !==
      "admin"
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "You do not have permission to manage members.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  return {
    supabase,
    user,
    profile,
  };
}

export async function GET(
  request: Request
) {
  const context =
    await getContext();

  if ("error" in context) {
    return context.error;
  }

  const {
    supabase,
    profile,
  } = context;

  const url =
    new URL(
      request.url
    );

  const q =
    url.searchParams
      .get("q")
      ?.trim() ?? "";

  const { count } =
    await supabase
      .from("members")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "club_id",
        profile.club_id
      );

  let query =
    supabase
      .from("members")
      .select(`
        id,
        first_name,
        last_name,
        full_name,
        member_number,
        bag_number
      `)
      .eq(
        "club_id",
        profile.club_id
      )
      .order(
        "last_name",
        {
          ascending: true,
        }
      )
      .order(
        "first_name",
        {
          ascending: true,
        }
      )
      .limit(100);

  if (q) {
    query =
      query.or(
        `full_name.ilike.%${q}%,member_number.ilike.%${q}%,bag_number.ilike.%${q}%`
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,
    count: count ?? 0,
    members: data ?? [],
  });
}

export async function POST(
  request: Request
) {
  const context =
    await getContext();

  if ("error" in context) {
    return context.error;
  }

  const {
    supabase,
    profile,
  } = context;

  const body =
    await request.json();

  const firstName =
    String(
      body.first_name ??
        ""
    ).trim();

  const lastName =
    String(
      body.last_name ??
        ""
    ).trim();

  if (
    !firstName &&
    !lastName
  ) {
    return NextResponse.json(
      {
        error:
          "Member name is required.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("members")
      .insert({
        club_id:
          profile.club_id,

        first_name:
          firstName ||
          null,

        last_name:
          lastName ||
          null,

        member_number:
          String(
            body.member_number ??
              ""
          ).trim() ||
          null,

        bag_number:
          String(
            body.bag_number ??
              ""
          ).trim() ||
          null,
      })
      .select()
      .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,
    member: data,
  });
}