import Link from "next/link";
import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import { getGolfOpsAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

function easternDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function displayTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function requestLabel(value: string) {
  if (value === "PRACTICE") return "Practice";
  if (value === "TAKEAWAY") return "Takeaway";
  if (value === "LESSON") return "Lesson";
  return value;
}

function MetricCard({
  label,
  value,
  detail,
  href,
  alert = false,
}: {
  label: string;
  value: number | string;
  detail: string;
  href?: string;
  alert?: boolean;
}) {
  const content = (
    <div
      className={[
        "h-full rounded-xl border bg-[var(--golfops-card,var(--golfops-surface))] p-5 shadow-[var(--golfops-shadow)] transition",
        alert
          ? "border-amber-300"
          : "border-[var(--golfops-border)]",
        href ? "hover:-translate-y-0.5 hover:shadow-md" : "",
      ].join(" ")}
    >
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--golfops-text-muted)]">
        {label}
      </div>
      <div className={[
        "mt-2 text-4xl font-black",
        alert ? "text-amber-600" : "text-[var(--golfops-text)]",
      ].join(" ")}>
        {value}
      </div>
      <div className="mt-2 text-sm text-[var(--golfops-text-muted)]">
        {detail}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function OperationsPage() {
  const access = await getGolfOpsAccess();

  if (!access) redirect("/");

  const canTeeSheet = access.isAdmin || access.permissions.tee_sheet;
  const canChanges = access.isAdmin || access.permissions.changes;
  const canProShop = access.isAdmin || access.permissions.pro_shop;
  const canGolfCarts = access.isAdmin || access.permissions.golf_carts;
  const allowed = canTeeSheet || canChanges || canProShop || canGolfCarts;

  if (!allowed) redirect("/settings/account");

  const supabase = await createClient();
  const today = easternDateString();

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
  ] = await Promise.all([
    canTeeSheet
      ? supabase
          .from("tee_sheet_slots")
          .select("id, tee_time, course, starting_hole, starting_position, player_name, check_in")
          .eq("club_id", access.clubId)
          .eq("sheet_date", today)
      : Promise.resolve(emptyResult),
    canChanges
      ? supabase
          .from("tee_sheet_changes")
          .select("id")
          .eq("club_id", access.clubId)
          .eq("sheet_date", today)
          .eq("status", "OPEN")
      : Promise.resolve(emptyResult),
    canTeeSheet
      ? supabase
          .from("tee_sheet_imports")
          .select("created_at, parsed_snapshot")
          .eq("club_id", access.clubId)
          .eq("sheet_date", today)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve(emptyResult),
    canProShop
      ? supabase
          .from("pro_shop_requests")
          .select("id, request_type, member_name_snapshot, bag_number_snapshot, details, created_at")
          .eq("club_id", access.clubId)
          .eq("status", "ACTIVE")
          .order("created_at", { ascending: true })
      : Promise.resolve(emptyResult),
    canProShop
      ? supabase
          .from("foretees_lessons")
          .select("id")
          .eq("club_id", access.clubId)
          .eq("lesson_date", today)
          .eq("source", "FORETEES")
      : Promise.resolve(emptyResult),
    canGolfCarts
      ? supabase
          .from("golf_carts")
          .select("id, cart_number, status")
          .eq("club_id", access.clubId)
      : Promise.resolve(emptyResult),
    canGolfCarts
      ? supabase
          .from("cart_damage")
          .select("id, cart_id")
          .eq("club_id", access.clubId)
          .is("resolved_at", null)
      : Promise.resolve(emptyResult),
    canGolfCarts
      ? supabase
          .from("cart_cleaning_history")
          .select("cart_id, cleaned_at")
          .eq("club_id", access.clubId)
          .order("cleaned_at", { ascending: false })
      : Promise.resolve(emptyResult),
    canGolfCarts
      ? supabase
          .from("club_operational_settings")
          .select("settings")
          .eq("club_id", access.clubId)
          .maybeSingle()
      : Promise.resolve(emptyResult),
  ]);

  const slots = slotsResult.data ?? [];
  const occupiedPlayers = slots.filter((slot) => Boolean(slot.player_name));
  const playerCount = occupiedPlayers.length;
  const checkedInCount = occupiedPlayers.filter(
    (slot) => slot.check_in === "X"
  ).length;
  const groupCount = new Set(
    slots.map((slot) =>
      [slot.tee_time, slot.course, slot.starting_position ?? slot.starting_hole].join("|")
    )
  ).size;

  const openChanges = changesResult.data?.length ?? 0;
  const requests = requestsResult.data ?? [];
  const lessons = lessonsResult.data?.length ?? 0;
  const carts = cartsResult.data ?? [];
  const activeCarts = carts.filter(
    (cart) => (cart.status ?? "ACTIVE").trim().toUpperCase() === "ACTIVE"
  ).length;
  const outOfService = carts.filter(
    (cart) => (cart.status ?? "ACTIVE").trim().toUpperCase() === "OUT_OF_SERVICE"
  ).length;
  const damagedCartCount = new Set(
    (damageResult.data ?? []).map((damage) => String(damage.cart_id))
  ).size;

  const settings =
    settingsResult.data?.settings &&
    typeof settingsResult.data.settings === "object"
      ? settingsResult.data.settings as Record<string, unknown>
      : {};
  const detailingDays =
    typeof settings.cartDetailingDays === "number"
      ? settings.cartDetailingDays
      : 30;
  const latestCleaning = new Map<string, string>();

  for (const cleaning of cleaningResult.data ?? []) {
    const key = String(cleaning.cart_id);
    if (!latestCleaning.has(key)) latestCleaning.set(key, cleaning.cleaned_at);
  }

  const now = Date.now();
  const detailingDue = carts.filter((cart) => {
    if ((cart.status ?? "ACTIVE").trim().toUpperCase() === "RETIRED") return false;
    const lastCleaned = latestCleaning.get(String(cart.id));
    if (!lastCleaned) return true;
    return new Date(lastCleaned).getTime() + detailingDays * 86_400_000 <= now;
  }).length;

  const snapshot = importResult.data?.parsed_snapshot as
    | { eventName?: string | null }
    | null;
  const eventName = snapshot?.eventName ?? null;
  const lastImport = importResult.data?.created_at ?? null;

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="operations" selectedDate={today} />

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-5 sm:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--golfops-accent-text)]">
              Daily Operations
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {displayDate(today)}
            </h1>
            {eventName && (
              <div className="mt-3 inline-flex rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--golfops-accent-text)]">
                {eventName}
              </div>
            )}
          </div>

          <div className="text-sm text-[var(--golfops-text-muted)]">
            {lastImport ? `Tee sheet updated ${displayTime(lastImport)}` : "No tee sheet import today"}
            <div className="mt-1 text-xs text-[var(--golfops-text-dim)]">
              Dashboard refreshes every minute
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {canTeeSheet && (
            <MetricCard
              label="Today's Play"
              value={playerCount}
              detail={`${groupCount} groups • ${checkedInCount} checked in`}
              href={`/dashboard?date=${today}`}
            />
          )}
          {canChanges && (
            <MetricCard
              label="Open Changes"
              value={openChanges}
              detail={openChanges === 1 ? "Change needs attention" : "Changes need attention"}
              href={`/changes?date=${today}`}
              alert={openChanges > 0}
            />
          )}
          {canProShop && (
            <MetricCard
              label="Active Requests"
              value={requests.length}
              detail={`${lessons} lesson${lessons === 1 ? "" : "s"} scheduled today`}
              href="/proshop"
              alert={requests.length > 0}
            />
          )}
          {canGolfCarts && (
            <MetricCard
              label="Cart Fleet"
              value={activeCarts}
              detail={`${outOfService} out • ${damagedCartCount} damaged • ${detailingDue} detail due`}
              href="/carts"
              alert={outOfService > 0 || damagedCartCount > 0}
            />
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
            <header className="flex items-center justify-between border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-5 py-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--golfops-text-muted)]">
                  Action Center
                </div>
                <h2 className="mt-1 text-xl font-bold">Items Requiring Attention</h2>
              </div>
            </header>

            <div className="divide-y divide-[var(--golfops-border)]">
              {canChanges && (
                <Link href={`/changes?date=${today}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--golfops-surface-soft)]">
                  <div>
                    <div className="font-semibold">Tee Sheet Changes</div>
                    <div className="mt-1 text-sm text-[var(--golfops-text-muted)]">Review and clear today&apos;s imported changes.</div>
                  </div>
                  <span className={openChanges > 0 ? "font-bold text-amber-600" : "font-bold text-emerald-600"}>{openChanges}</span>
                </Link>
              )}
              {canProShop && (
                <Link href="/proshop" className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--golfops-surface-soft)]">
                  <div>
                    <div className="font-semibold">Golf Shop Requests</div>
                    <div className="mt-1 text-sm text-[var(--golfops-text-muted)]">Practice, takeaway, and lesson requests awaiting completion.</div>
                  </div>
                  <span className={requests.length > 0 ? "font-bold text-amber-600" : "font-bold text-emerald-600"}>{requests.length}</span>
                </Link>
              )}
              {canGolfCarts && (
                <Link href="/carts" className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--golfops-surface-soft)]">
                  <div>
                    <div className="font-semibold">Cart Exceptions</div>
                    <div className="mt-1 text-sm text-[var(--golfops-text-muted)]">Out-of-service carts, damage, and overdue detailing.</div>
                  </div>
                  <span className={outOfService + damagedCartCount + detailingDue > 0 ? "font-bold text-amber-600" : "font-bold text-emerald-600"}>
                    {outOfService + damagedCartCount + detailingDue}
                  </span>
                </Link>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
            <header className="border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--golfops-text-muted)]">
                Coming Connections
              </div>
              <h2 className="mt-1 text-xl font-bold">Operational Integrations</h2>
            </header>
            <div className="divide-y divide-[var(--golfops-border)]">
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">SchedulePop Staffing</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">Pending Access</span>
                </div>
                <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">Scheduled TEAM members, coverage, call-outs, and open shifts.</p>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">E-Z-GO PACE</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">Pending Access</span>
                </div>
                <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">Cart locations, group pace, alerts, and projected return times.</p>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">ForeTees Monitor</span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600">Next Phase</span>
                </div>
                <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">Automatic tee sheet monitoring and immediate change communication.</p>
              </div>
            </div>
          </section>
        </div>

        {canProShop && requests.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
            <header className="flex items-center justify-between border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-5 py-4">
              <h2 className="text-xl font-bold">Active Requests</h2>
              <Link href="/proshop" className="text-sm font-bold text-[var(--golfops-accent-text)]">Open Pro Shop →</Link>
            </header>
            <div className="divide-y divide-[var(--golfops-border)]">
              {requests.slice(0, 6).map((request) => (
                <div key={request.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-bold">{request.member_name_snapshot}</div>
                    <div className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                      {requestLabel(request.request_type)}
                      {request.bag_number_snapshot ? ` • Bag ${request.bag_number_snapshot}` : ""}
                      {request.details ? ` • ${request.details}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--golfops-text-dim)]">{displayTime(request.created_at)}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
