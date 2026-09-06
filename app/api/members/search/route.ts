import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const [
      canUseBagFinder,
      canUseTeeSheet,
    ] =
      await Promise.all([
        hasGolfOpsPermission(
          "bag_finder"
        ),
        hasGolfOpsPermission(
          "tee_sheet"
        ),
      ]);

    if (
      !canUseBagFinder &&
      !canUseTeeSheet
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to search members.",
        },
        {
          status: 403,
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

    if (!profile?.club_id) {
      return NextResponse.json(
        {
          error: "Unable to determine your club.",
        },
        {
          status: 403,
        }
      );
    }

    const url = new URL(request.url);

    const q =
      url.searchParams
        .get("q")
        ?.trim() ?? "";

    if (q.length < 1) {
      return NextResponse.json({
        ok: true,
        members: [],
      });
    }

    /*
      Run separate searches for name,
      bag number and member number.

      This avoids building a complicated
      PostgREST OR expression from user
      input.
    */

    const [
      nameResult,
      bagResult,
      memberNumberResult,
    ] = await Promise.all([
      supabase
        .from("members")
        .select(`
          id,
          full_name,
          member_number,
          bag_number
        `)
        .eq("club_id", profile.club_id)
        .ilike("full_name", `%${q}%`)
        .limit(15),

      supabase
        .from("members")
        .select(`
          id,
          full_name,
          member_number,
          bag_number
        `)
        .eq("club_id", profile.club_id)
        .ilike("bag_number", `%${q}%`)
        .limit(15),

      supabase
        .from("members")
        .select(`
          id,
          full_name,
          member_number,
          bag_number
        `)
        .eq("club_id", profile.club_id)
        .ilike("member_number", `%${q}%`)
        .limit(15),
    ]);

    const error =
      nameResult.error ??
      bagResult.error ??
      memberNumberResult.error;

    if (error) {
      console.error(
        "Member search error:",
        error
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    const memberMap = new Map<
      string,
      {
        id: string;
        full_name: string | null;
        member_number: string | null;
        bag_number: string | null;
      }
    >();

    for (const member of [
      ...(nameResult.data ?? []),
      ...(bagResult.data ?? []),
      ...(memberNumberResult.data ?? []),
    ]) {
      memberMap.set(
        String(member.id),
        {
          id: String(member.id),
          full_name:
            member.full_name,
          member_number:
            member.member_number,
          bag_number:
            member.bag_number,
        }
      );
    }

    const members =
      Array.from(memberMap.values())
        .sort((a, b) =>
          (a.full_name ?? "")
            .localeCompare(
              b.full_name ?? ""
            )
        )
        .slice(0, 20);

    return NextResponse.json({
      ok: true,
      members,
    });
  } catch (error) {
    console.error(
      "Member search route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to search members.",
      },
      {
        status: 500,
      }
    );
  }
}
