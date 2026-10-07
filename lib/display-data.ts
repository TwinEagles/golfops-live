import { createHash } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

// Sort row sets and object keys so database row order never triggers a refresh.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function dataVersion(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export async function loadTvData(supabase: Awaited<ReturnType<typeof createClient>>, clubId: string, date: string) {
  const [
    slotsResult,
    changesResult,
    importResult,
    requestsResult,
    lessonsResult,
    paceResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "tee_sheet_slots"
        )
        .select(
          "id, tee_time, course, starting_hole, starting_position, slot_position, player_name, cart_number, check_in"
        )
        .eq(
          "club_id",
          clubId
        )
        .eq(
          "sheet_date",
          date
        ),

      supabase
        .from(
          "tee_sheet_changes"
        )
        .select(`
          id,
          change_type,
          player_name,
          bag_number,
          tee_time,
          starting_hole,
          old_value,
          new_value,
          detail
        `)
        .eq(
          "club_id",
          clubId
        )
        .eq(
          "sheet_date",
          date
        )
        .eq(
          "status",
          "OPEN"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        ),

      supabase
        .from(
          "tee_sheet_imports"
        )
        .select(
          "created_at, source"
        )
        .eq(
          "club_id",
          clubId
        )
        .eq(
          "sheet_date",
          date
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle(),

      supabase
        .from(
          "pro_shop_requests"
        )
        .select(`
          id,
          request_type,
          member_name_snapshot,
          bag_number_snapshot,
          details,
          created_at
        `)
        .eq(
          "club_id",
          clubId
        )
        .eq(
          "status",
          "ACTIVE"
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        ),

      /*
        Lessons follow the selected TV date
        so the displayed schedule matches
        the date shown in the header.
      */

      supabase
        .from(
          "foretees_lessons"
        )
        .select(`
          id,
          lesson_time,
          instructor_name,
          member_name,
          lesson_type
        `)
        .eq(
          "club_id",
          clubId
        )
        .eq(
          "lesson_date",
          date
        )
        .eq(
          "source",
          "FORETEES"
        )
        .order(
          "lesson_time",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "pace_cart_status"
        )
        .select(`
          cart_number,
          course_name,
          hole_name,
          hole_short_name,
          hole_sequence,
          current_pace,
          pace_minutes,
          estimated_finish_at,
          is_in_play,
          last_seen_at
        `)
        .eq(
          "club_id",
          clubId
        ),
    ]);

  const results = [slotsResult, changesResult, importResult, requestsResult, lessonsResult, paceResult];
  const ok = results.every(result => !result.error);
  const timeState = (paceResult.data ?? []).map(row => ({ cart: row.cart_number, fresh: !!row.last_seen_at && Date.now() - new Date(row.last_seen_at).getTime() <= 180000 }));
  // Heartbeat timestamps affect freshness but are not visible display content.
  const fingerprintResults = results.map(result => result === paceResult
    ? (paceResult.data ?? []).map(({ last_seen_at: _heartbeat, ...row }) => row)
    : result.data);
  const version = ok ? dataVersion({ date, results: fingerprintResults, timeState }) : null;
  return { slotsResult, changesResult, importResult, requestsResult, lessonsResult, paceResult, version };
}

export async function loadOperationsData(supabase: Awaited<ReturnType<typeof createClient>>, clubId: string, date: string) {
  const canTeeSheet = true, canChanges = true, canProShop = true, canGolfCarts = true, canOutsideOperations = true;
  const emptyResult = { data: null, error: null };
  const [
    slotsResult,
    changesResult,
    importResult,
    requestsResult,
    lessonsResult,
    cartsResult,
    damageResult,
    cleaningResult,
    settingsResult,
    outsideItemsResult,
    outsideCompletionsResult,
    handoffsResult,
    scheduleStaffResult,
    scheduleImportResult,
  ] = await Promise.all([
    canTeeSheet
      ? supabase
          .from("tee_sheet_slots")
          .select("id, tee_time, course, starting_hole, starting_position, player_name, check_in")
          .eq("club_id", clubId)
          .eq("sheet_date", date)
      : Promise.resolve(emptyResult),
    canChanges
      ? supabase
          .from("tee_sheet_changes")
          .select("id")
          .eq("club_id", clubId)
          .eq("sheet_date", date)
          .eq("status", "OPEN")
      : Promise.resolve(emptyResult),
    canTeeSheet
      ? supabase
          .from("tee_sheet_imports")
          .select("created_at, parsed_snapshot")
          .eq("club_id", clubId)
          .eq("sheet_date", date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve(emptyResult),
    canProShop
      ? supabase
          .from("pro_shop_requests")
          .select("id, request_type, member_name_snapshot, bag_number_snapshot, details, created_at")
          .eq("club_id", clubId)
          .eq("status", "ACTIVE")
          .order("created_at", { ascending: true })
      : Promise.resolve(emptyResult),
    canProShop
      ? supabase
          .from("foretees_lessons")
          .select("id, lesson_time, instructor_name, member_name, lesson_type")
          .eq("club_id", clubId)
          .eq("lesson_date", date)
          .eq("source", "FORETEES")
      : Promise.resolve(emptyResult),
    canGolfCarts
      ? supabase
          .from("golf_carts")
          .select("id, cart_number, status")
          .eq("club_id", clubId)
      : Promise.resolve(emptyResult),
    canGolfCarts
      ? supabase
          .from("cart_damage")
          .select("id, cart_id")
          .eq("club_id", clubId)
          .is("resolved_at", null)
      : Promise.resolve(emptyResult),
    canGolfCarts
      ? supabase
          .from("cart_cleaning_history")
          .select("cart_id, cleaned_at")
          .eq("club_id", clubId)
          .order("cleaned_at", { ascending: false })
      : Promise.resolve(emptyResult),
    canGolfCarts
      ? supabase
          .from("club_operational_settings")
          .select("settings")
          .eq("club_id", clubId)
          .maybeSingle()
      : Promise.resolve(emptyResult),
    canOutsideOperations
      ? supabase
          .from("outside_ops_checklist_items")
          .select("id")
          .eq("club_id", clubId)
          .eq("active", true)
      : Promise.resolve(emptyResult),
    canOutsideOperations
      ? supabase
          .from("outside_ops_checklist_completions")
          .select("id")
          .eq("club_id", clubId)
          .eq("work_date", date)
      : Promise.resolve(emptyResult),
    canOutsideOperations
      ? supabase
          .from("outside_ops_handoffs")
          .select("id")
          .eq("club_id", clubId)
          .eq("work_date", date)
          .eq("status", "OPEN")
      : Promise.resolve(emptyResult),
    canOutsideOperations
      ? supabase
          .from("schedulepop_shifts")
          .select("id, employee_name, job_title, start_time, end_time, duty, zone, status, notes")
          .eq("club_id", clubId)
          .eq("shift_date", date)
          .order("start_time")
      : Promise.resolve(emptyResult),
    canOutsideOperations
      ? supabase
          .from("schedulepop_imports")
          .select("imported_at")
          .eq("club_id", clubId)
          .order("imported_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve(emptyResult),
  ]);

  const results = [slotsResult, changesResult, importResult, requestsResult, lessonsResult, cartsResult, damageResult, cleaningResult, settingsResult, outsideItemsResult, outsideCompletionsResult, handoffsResult, scheduleStaffResult, scheduleImportResult];
  const ok = results.every(result => !result.error);
  const settings = settingsResult.data?.settings as Record<string, unknown> | undefined;
  const days = typeof settings?.cartDetailingDays === "number" ? settings.cartDetailingDays : 30;
  const timeState = (cleaningResult.data ?? []).map(row => ({ cart: row.cart_id, due: new Date(row.cleaned_at).getTime() + days * 86400000 <= Date.now() }));
  const version = ok ? dataVersion({ date, results: results.map(result => result.data), timeState }) : null;
  return { slotsResult, changesResult, importResult, requestsResult, lessonsResult, cartsResult, damageResult, cleaningResult, settingsResult, outsideItemsResult, outsideCompletionsResult, handoffsResult, scheduleStaffResult, scheduleImportResult, version };
}

export async function loadChangesData(supabase: Awaited<ReturnType<typeof createClient>>, clubId: string, selectedDate: string, view: string, selectedType: string, showCleared: boolean, retentionDays: number, settings: unknown) {
  const retentionCutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  let query =
    supabase
      .from(
        "tee_sheet_changes"
      )
      .select(`
        id,
        change_type,
        player_name,
        bag_number,
        cart_number,
        tee_time,
        starting_hole,
        detail,
        status,
        created_at,
        cleared_at,
        old_value,
        new_value
      `)
      .eq(
        "club_id",
        clubId
      )
      .eq(
        "sheet_date",
        selectedDate
      )
      .order(
        "tee_time",
        {
          ascending: true,
        }
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

  if (
    !showCleared
  ) {
    query =
      query.eq(
        "status",
        "OPEN"
      );
  } else {
    /*
      Always include OPEN changes.

      Include CLEARED changes only when
      they were cleared inside the saved
      retention period. This makes the
      retention setting operational now
      without deleting historical data.
    */

    query =
      query.or(
        `status.eq.OPEN,and(status.eq.CLEARED,cleared_at.gte.${retentionCutoff})`
      );
  }

  if (
    selectedType !==
      "ALL" &&
    [
      "ADDED",
      "REMOVED",
      "TIME_CHANGED",
      "HOLE_CHANGED",
      "REPLACED",
      "CART_ASSIGNED",
    ].includes(
      selectedType
    )
  ) {
    query =
      query.eq(
        "change_type",
        selectedType
      );
  }

  if (view === "changes") {
    query =
      query.neq(
        "change_type",
        "CART_ASSIGNED"
      );
  } else if (
    view === "activity"
  ) {
    query =
      query.eq(
        "change_type",
        "CART_ASSIGNED"
      );
  }

  const {
    data,
    error,
  } =
    await query;

  const {
    count: openCountResult,
    error: countError,
  } =
    await supabase
      .from(
        "tee_sheet_changes"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "club_id",
        clubId
      )
      .eq(
        "sheet_date",
        selectedDate
      )
      .eq(
        "status",
        "OPEN"
      );

  const version = error || countError ? null : dataVersion({ selectedDate, today: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), data, openCountResult, settings });
  return { data, error, openCountResult, version };
}
