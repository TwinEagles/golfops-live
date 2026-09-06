import { createClient } from "@/lib/supabase/server";

function csvValue(
  value: string | null
) {
  const text =
    value ?? "";

  return `"${text.replace(
    /"/g,
    '""'
  )}"`;
}

export async function GET() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return new Response(
      "Unauthorized",
      {
        status: 401,
      }
    );
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
    return new Response(
      "Unable to determine club.",
      {
        status: 403,
      }
    );
  }

  if (
    profile.role !==
      "admin"
  ) {
    return new Response(
      "You do not have permission to export members.",
      {
        status: 403,
      }
    );
  }

  const {
    data: members,
    error,
  } =
    await supabase
      .from("members")
      .select(`
        first_name,
        last_name,
        member_number,
        bag_number
      `)
      .eq(
        "club_id",
        profile.club_id
      )
      .order(
        "last_name"
      )
      .order(
        "first_name"
      );

  if (error) {
    return new Response(
      error.message,
      {
        status: 500,
      }
    );
  }

  const lines = [
    "First Name,Last Name,Member Number,Bag Number",

    ...(members ?? []).map(
      (member) =>
        [
          csvValue(
            member.first_name
          ),

          csvValue(
            member.last_name
          ),

          csvValue(
            member.member_number
          ),

          csvValue(
            member.bag_number
          ),
        ].join(",")
    ),
  ];

  return new Response(
    lines.join("\r\n"),
    {
      headers: {
        "Content-Type":
          "text/csv; charset=utf-8",

        "Content-Disposition":
          'attachment; filename="TwinEagles-Members.csv"',

        "Cache-Control":
          "private, no-store",
      },
    }
  );
}