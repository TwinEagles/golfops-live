import { getGolfOpsAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { loadTvData, loadOperationsData, loadChangesData } from "@/lib/display-data";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Vercel-CDN-Cache-Control": "no-store" };
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope");
  const date = params.get("date") ?? "";
  if ((scope !== "tv" && scope !== "operations" && scope !== "changes") || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) {
    return Response.json({ error: "Invalid display" }, { status: 400, headers });
  }
  try {
    const access = await getGolfOpsAccess();
    if (!access) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    if (scope !== "operations" && !access.isAdmin && !access.permissions[scope]) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    const supabase = await createClient();
    // User-scoped client retains RLS. Return only an opaque fingerprint, never staff/member data.
    let result: { version: string | null };
    if (scope === "changes") {
      const { data: row, error: settingsError } = await supabase.from("club_operational_settings").select("settings").eq("club_id", access.clubId).maybeSingle();
      if (settingsError) throw settingsError;
      const candidate = Number(row?.settings?.clearedChangesRetentionDays);
      const retentionDays = [7, 14, 30, 60, 90].includes(candidate) ? candidate : 30;
      result = await loadChangesData(supabase, access.clubId, date, params.get("view") ?? "all", params.get("type") ?? "ALL", params.get("showCleared") === "1", retentionDays, row?.settings ?? null);
    } else {
      result = await (scope === "tv" ? loadTvData : loadOperationsData)(supabase, access.clubId, date);
    }
    if (!result.version) return Response.json({ error: "Data unavailable" }, { status: 503, headers });
    return Response.json({ version: result.version }, { headers });
  } catch (error) {
    console.error("Display version check failed", error);
    return Response.json({ error: "Data unavailable" }, { status: 503, headers });
  }
}
