import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function validSheetDate(value: string | null) {
  return Boolean(
    value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

function hashText(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

function easternToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const date = new URL(request.url).searchParams.get("date");

  if (!validSheetDate(date)) {
    return NextResponse.json(
      { ok: false, error: "Invalid tee sheet date." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) {
    return NextResponse.json(
      { ok: false, error: "Unable to determine your club." },
      { status: 403 }
    );
  }

  const { data: slots, error } = await supabase
    .from("tee_sheet_slots")
    .select(
      "id,tee_time,course,starting_hole,starting_position,slot_position,player_name,bag_number,cw,cart_number,check_in,highlight"
    )
    .eq("club_id", profile.club_id)
    .eq("sheet_date", date)
    .order("id", { ascending: true });

  if (error) {
    console.error("Tee sheet version error:", error);

    return NextResponse.json(
      { ok: false, error: "Unable to check tee sheet changes." },
      { status: 500 }
    );
  }

  let pace: Array<Record<string, unknown>> = [];

  if (date === easternToday()) {
    const { data: paceRows, error: paceError } = await supabase
      .from("pace_cart_status")
      .select(
        "cart_number,hole_sequence,current_pace,pace_minutes,is_online,is_in_play,gps_valid"
      )
      .eq("club_id", profile.club_id)
      .order("cart_number", { ascending: true });

    if (paceError) {
      console.error("PACE version error:", paceError);
    } else {
      pace = paceRows ?? [];
    }
  }

  const version = hashText(
    JSON.stringify({
      slots: (slots ?? []).map((slot) => [
        slot.id,
        slot.tee_time,
        slot.course ?? "",
        slot.starting_hole ?? "",
        slot.starting_position ?? "",
        slot.slot_position,
        slot.player_name ?? "",
        slot.bag_number ?? "",
        slot.cw ?? "",
        slot.cart_number ?? "",
        slot.check_in ?? "",
        slot.highlight ?? "",
      ]),
      pace,
    })
  );

  return NextResponse.json(
    { ok: true, version },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
