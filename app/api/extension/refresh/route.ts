import { createClient } from "@supabase/supabase-js";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const refreshToken =
      typeof body?.refresh_token ===
        "string"
        ? body.refresh_token.trim()
        : "";

    if (!refreshToken) {
      return Response.json(
        {
          ok: false,
          error:
            "Refresh token required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseKey
    ) {
      console.error(
        "Extension refresh configuration missing."
      );

      return Response.json(
        {
          ok: false,
          error:
            "GolfOps Live authentication is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseKey,
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
      data,
      error,
    } =
      await supabase.auth.refreshSession(
        {
          refresh_token:
            refreshToken,
        }
      );

    if (
      error ||
      !data.session
    ) {
      console.error(
        "Extension session refresh rejected:",
        error
      );

      return Response.json(
        {
          ok: false,
          error:
            error?.message ??
            "Unable to refresh session.",
        },
        {
          status: 401,
        }
      );
    }

    return Response.json(
      {
        ok: true,

        access_token:
          data.session.access_token,

        refresh_token:
          data.session.refresh_token,

        expires_at:
          data.session.expires_at,

        user_email:
          data.user?.email ??
          null,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Extension refresh error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh GolfOps Live extension session.",
      },
      {
        status: 500,
      }
    );
  }
}