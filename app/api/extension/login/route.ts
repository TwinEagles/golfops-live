import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body?.email === "string"
        ? body.email.trim()
        : "";

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return Response.json(
        {
          ok: false,
          error: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error || !data.session) {
      return Response.json(
        {
          ok: false,
          error: error?.message ?? "Unable to sign in.",
        },
        { status: 401 }
      );
    }

    return Response.json({
      ok: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      email: data.user.email,
    });
  } catch (error) {
    console.error("Extension login error:", error);

    return Response.json(
      {
        ok: false,
        error: "Unable to process extension login.",
      },
      { status: 500 }
    );
  }
}