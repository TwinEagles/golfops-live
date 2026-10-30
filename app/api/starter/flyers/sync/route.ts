import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type FlyerInput = {
  url?: unknown;
  title?: unknown;
};

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function normalizeFlyerUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "web.foretees.com" &&
      /^\/v5\/AEimages\/twineaglesclub\/.+\.(png|jpe?g|gif|webp)$/i.test(
        url.pathname
      )
    ) {
      url.search = "";
      url.hash = "";
      return url.href;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { ok: false, error: "Missing GolfOps sign-in." },
      { status: 401 }
    );
  }

  const accessToken = authHeader.slice(7).trim();
  if (!accessToken) {
    return Response.json(
      { ok: false, error: "Missing GolfOps sign-in." },
      { status: 401 }
    );
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return Response.json(
      { ok: false, error: "Your GolfOps sign-in has expired." },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.club_id) {
    return Response.json(
      { ok: false, error: "Your GolfOps account is not assigned to a club." },
      { status: 403 }
    );
  }

  if (profile.role !== "admin") {
    const { data: permissions, error: permissionError } = await supabase
      .from("user_permissions")
      .select("tee_sheet, starter")
      .eq("user_id", user.id)
      .eq("club_id", profile.club_id)
      .maybeSingle();

    if (permissionError) {
      return Response.json(
        { ok: false, error: "Unable to verify your GolfOps permissions." },
        { status: 500 }
      );
    }
    if (permissions?.tee_sheet !== true && permissions?.starter !== true) {
      return Response.json(
        { ok: false, error: "Tee Sheet or Starter access is required to sync flyers." },
        { status: 403 }
      );
    }
  }

  let body: { flyers?: FlyerInput[] } | null;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "The flyer sync request was invalid." },
      { status: 400 }
    );
  }

  const input = Array.isArray(body?.flyers) ? body.flyers.slice(0, 40) : [];
  const byUrl = new Map<string, string>();
  for (const flyer of input) {
    const url = normalizeFlyerUrl(cleanText(flyer?.url, 2048));
    if (!url) continue;

    let title = cleanText(flyer?.title);
    if (!title) {
      const filename = url.split("/").pop() ?? "Upcoming event";
      try {
        title = decodeURIComponent(filename);
      } catch {
        title = filename;
      }
      title = title.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    }
    byUrl.set(url, title || "Upcoming event");
  }

  if (byUrl.size === 0) {
    return Response.json(
      { ok: false, error: "No ForeTees event flyers were found to save." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const rows = Array.from(byUrl, ([source_url, title]) => ({
    club_id: String(profile.club_id),
    source_url,
    title,
    source: "foretees-home",
    last_seen_at: now,
    updated_at: now,
  }));

  const { error: upsertError } = await supabase
    .from("starter_flyers")
    .upsert(rows, { onConflict: "club_id,source_url" });

  if (upsertError) {
    console.error("Starter flyer sync failed:", upsertError);
    return Response.json(
      { ok: false, error: "GolfOps could not save the ForeTees flyers." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, syncedCount: rows.length });
}
