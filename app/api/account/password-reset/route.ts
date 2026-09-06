import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getTrustedAppUrl() {
  const configuredUrl =
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim()
      .replace(
        /\/+$/,
        ""
      );

  if (configuredUrl) {
    return configuredUrl;
  }

  const vercelUrl =
    process.env
      .VERCEL_URL
      ?.trim()
      .replace(
        /\/+$/,
        ""
      );

  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  if (
    process.env.NODE_ENV ===
      "development"
  ) {
    return "http://localhost:3000";
  }

  return null;
}

export async function POST() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      {
        error:
          "Unable to determine the account email.",
      },
      {
        status: 401,
      }
    );
  }

  const appUrl =
    getTrustedAppUrl();

  if (!appUrl) {
    console.error(
      "NEXT_PUBLIC_APP_URL is not configured for password resets."
    );

    return NextResponse.json(
      {
        error:
          "Password reset is not configured.",
      },
      {
        status: 500,
      }
    );
  }

  const {
    error,
  } =
    await supabase.auth.resetPasswordForEmail(
      user.email,
      {
        redirectTo:
          `${appUrl}/auth/update-password`,
      }
    );

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 400,
      }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}