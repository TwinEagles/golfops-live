import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { parseForeTeesLessonsHtml } from "@/lib/foretees-lessons-parser";

type ImportRequestBody = {
  html?: string;
};

async function getAuthenticatedSupabase(
  request: Request
) {
  const authHeader =
    request.headers.get(
      "authorization"
    );

  /*
    Chrome extension requests send:
      Authorization: Bearer <Supabase access token>

    Normal GolfOps browser requests use
    the cookie-based server Supabase client.
  */

  if (
    authHeader?.startsWith(
      "Bearer "
    )
  ) {
    const accessToken =
      authHeader
        .replace(
          "Bearer ",
          ""
        )
        .trim();

    if (!accessToken) {
      return {
        supabase: null,
        user: null,
        error:
          "Missing authorization token.",
      };
    }

    const supabase =
      createSupabaseClient(
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
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        }
      );

    const {
      data: { user },
      error,
    } =
      await supabase.auth.getUser(
        accessToken
      );

    if (
      error ||
      !user
    ) {
      return {
        supabase: null,
        user: null,
        error:
          "Invalid or expired GolfOps Live login.",
      };
    }

    return {
      supabase,
      user,
      error: null,
    };
  }

  const supabase =
    await createServerClient();

  const {
    data: { user },
    error,
  } =
    await supabase.auth.getUser();

  if (
    error ||
    !user
  ) {
    return {
      supabase: null,
      user: null,
      error:
        "Not authenticated.",
    };
  }

  return {
    supabase,
    user,
    error: null,
  };
}

export async function POST(
  request: Request
) {
  try {
    const auth =
      await getAuthenticatedSupabase(
        request
      );

    if (
      !auth.supabase ||
      !auth.user
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            auth.error ??
            "Not authenticated.",
        },
        {
          status: 401,
        }
      );
    }

    const supabase =
      auth.supabase;

    const user =
      auth.user;

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "club_id, role"
        )
        .eq(
          "id",
          user.id
        )
        .single();

    if (
      profileError ||
      !profile?.club_id
    ) {
      console.error(
        "Lessons import profile lookup failed:",
        profileError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Your GolfOps account is not assigned to a club.",
        },
        {
          status: 403,
        }
      );
    }

    /*
      Use the already-authenticated Supabase
      client so this permission check works
      for both browser cookies and Chrome
      extension bearer tokens.
    */

    if (
      profile.role !==
        "admin"
    ) {
      const {
        data: permission,
        error: permissionError,
      } =
        await supabase
          .from(
            "user_permissions"
          )
          .select(
            "tee_sheet"
          )
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "club_id",
            profile.club_id
          )
          .maybeSingle();

      if (permissionError) {
        console.error(
          "Lessons import permission lookup failed:",
          permissionError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Unable to verify your GolfOps permissions.",
          },
          {
            status: 500,
          }
        );
      }

      if (
        permission
          ?.tee_sheet !==
        true
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "You do not have permission to import Tee Sheet lessons.",
          },
          {
            status: 403,
          }
        );
      }
    }

    let body:
      ImportRequestBody;

    try {
      body =
        (await request.json()) as
          ImportRequestBody;
    } catch {
      return NextResponse.json(
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

    const html =
      typeof body.html ===
        "string"
        ? body.html.trim()
        : "";

    if (!html) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No ForeTees lesson HTML was provided.",
        },
        {
          status: 400,
        }
      );
    }

    const parsed =
      parseForeTeesLessonsHtml(
        html
      );

    if (
      !parsed.lessonDate
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not determine the lesson date from the ForeTees page.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      ForeTees is the source of truth for
      the imported date.

      Replace the prior ForeTees snapshot
      with the page's currently booked
      lessons only.

      This means:
      - new bookings appear
      - changed bookings update
      - cancelled or deleted bookings
        disappear after the next sync
      - available, unavailable, and lunch
        blocks are ignored
    */

    const {
      error: deleteError,
    } =
      await supabase
        .from(
          "foretees_lessons"
        )
        .delete()
        .eq(
          "club_id",
          profile.club_id
        )
        .eq(
          "lesson_date",
          parsed.lessonDate
        )
        .eq(
          "source",
          "FORETEES"
        );

    if (deleteError) {
      console.error(
        "Lessons import delete failed:",
        deleteError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not replace the existing lesson schedule.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      parsed.lessons.length >
      0
    ) {
      const now =
        new Date().toISOString();

      const rows =
        parsed.lessons.map(
          (lesson) => ({
            club_id:
              profile.club_id,

            lesson_date:
              parsed.lessonDate,

            lesson_time:
              lesson.lessonTime,

            instructor_name:
              lesson.instructorName,

            member_name:
              lesson.memberName,

            lesson_type:
              lesson.lessonType,

            foretees_lesson_id:
              lesson.foreteesLessonId,

            foretees_pro_id:
              lesson.foreteesProId,

            source:
              "FORETEES",

            imported_at:
              now,

            updated_at:
              now,
          })
        );

      const {
        error: insertError,
      } =
        await supabase
          .from(
            "foretees_lessons"
          )
          .insert(rows);

      if (insertError) {
        console.error(
          "Lessons import insert failed:",
          insertError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "The old lesson snapshot was cleared, but the new lessons could not be saved. Please sync the ForeTees lesson page again.",
          },
          {
            status: 500,
          }
        );
      }
    }

    return NextResponse.json({
      ok: true,

      lessonDate:
        parsed.lessonDate,

      instructorCount:
        parsed.instructors
          .length,

      lessonCount:
        parsed.lessons.length,

      instructors:
        parsed.instructors,

      lessons:
        parsed.lessons.map(
          (lesson) => ({
            time:
              lesson.lessonTime,

            instructor:
              lesson.instructorName,

            member:
              lesson.memberName,

            lessonType:
              lesson.lessonType,

            foreteesLessonId:
              lesson.foreteesLessonId,

            foreteesProId:
              lesson.foreteesProId,
          })
        ),
    });
  } catch (error) {
    console.error(
      "Unexpected lessons import error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Unexpected error importing ForeTees lessons.",
      },
      {
        status: 500,
      }
    );
  }
}