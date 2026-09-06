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
    profile,
  };
}

export async function PUT(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const auth =
    await getContext();

  if ("error" in auth) {
    return auth.error;
  }

  const { id } =
    await context.params;

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
    await auth.supabase
      .from("members")
      .update({
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
      .eq(
        "id",
        id
      )
      .eq(
        "club_id",
        auth.profile.club_id
      )
      .select("id")
      .maybeSingle();

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

  if (!data) {
    return NextResponse.json(
      {
        error:
          "Member not found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const auth =
    await getContext();

  if ("error" in auth) {
    return auth.error;
  }

  const { id } =
    await context.params;

  const {
    data,
    error,
  } =
    await auth.supabase
      .from("members")
      .delete()
      .eq(
        "id",
        id
      )
      .eq(
        "club_id",
        auth.profile.club_id
      )
      .select("id")
      .maybeSingle();

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

  if (!data) {
    return NextResponse.json(
      {
        error:
          "Member not found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}