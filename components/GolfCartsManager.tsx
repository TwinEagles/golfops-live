"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Cart = {
  id: number | string;
  cart_number: string;
  status: string | null;
  notes: string | null;
};

type CleaningRecord = {
  id: number | string;
  cart_id: number | string;
  cleaned_by: string | null;
  notes: string | null;
  cleaned_at: string;
};

type DamageRecord = {
  id: number | string;
  cart_id: number | string;
  description: string;
  reported_by: string | null;
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
};

type Props = {
  initialCarts: Cart[];
  cleaningHistory: CleaningRecord[];
  damageHistory: DamageRecord[];
  initialDetailingDays: number;
};

type Filter =
  | "ALL"
  | "ACTIVE"
  | "DUE"
  | "DAMAGED"
  | "OUT_OF_SERVICE"
  | "RETIRED";

type ViewMode = "FLEET" | "DETAILING";

function normalizeStatus(status: string | null) {
  return (status ?? "ACTIVE").trim().toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function addDays(value: string | Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dayDifference(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.round(
    (target.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function dueLabel(days: number | null) {
  if (days === null) return "Due now";
  if (days < 0) {
    const count = Math.abs(days);
    return `${count} day${count === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export default function GolfCartsManager({
  initialCarts,
  cleaningHistory,
  damageHistory,
  initialDetailingDays,
}: Props) {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("FLEET");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [detailingDays, setDetailingDays] = useState(initialDetailingDays);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkStart, setBulkStart] = useState("1");
  const [bulkEnd, setBulkEnd] = useState("");
  const [workingCart, setWorkingCart] =
    useState<number | string | null>(null);

  const [damageCart, setDamageCart] = useState<Cart | null>(null);
  const [detailCart, setDetailCart] = useState<Cart | null>(null);
  const [damageHistoryCart, setDamageHistoryCart] =
    useState<Cart | null>(null);
  const [detailingHistoryCart, setDetailingHistoryCart] =
    useState<Cart | null>(null);
  const [cartDetailsCart, setCartDetailsCart] =
    useState<Cart | null>(null);
  const [cartNotes, setCartNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [resolvingDamage, setResolvingDamage] =
    useState<DamageRecord | null>(null);

  const [damageDescription, setDamageDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [cleanedBy, setCleanedBy] = useState("");
  const [cleaningNotes, setCleaningNotes] = useState("");
  const [resolvedBy, setResolvedBy] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const latestCleaning = useMemo(() => {
    const map = new Map<string, CleaningRecord>();
    for (const record of cleaningHistory) {
      const key = String(record.cart_id);
      if (!map.has(key)) map.set(key, record);
    }
    return map;
  }, [cleaningHistory]);

  const cleaningByCart = useMemo(() => {
    const map = new Map<string, CleaningRecord[]>();
    for (const record of cleaningHistory) {
      const key = String(record.cart_id);
      const rows = map.get(key) ?? [];
      rows.push(record);
      map.set(key, rows);
    }
    return map;
  }, [cleaningHistory]);

  const openDamageByCart = useMemo(() => {
    const map = new Map<string, DamageRecord[]>();
    for (const record of damageHistory) {
      if (record.resolved_at) continue;
      const key = String(record.cart_id);
      const rows = map.get(key) ?? [];
      rows.push(record);
      map.set(key, rows);
    }
    return map;
  }, [damageHistory]);

  function openDamageFor(cart: Cart) {
    return openDamageByCart.get(String(cart.id)) ?? [];
  }

  function isDamaged(cart: Cart) {
    return openDamageFor(cart).length > 0;
  }

  function nextDetailDate(cart: Cart) {
    const cleaning = latestCleaning.get(String(cart.id));
    if (!cleaning) return null;
    return addDays(cleaning.cleaned_at, detailingDays);
  }

  function daysUntilDetail(cart: Cart) {
    const due = nextDetailDate(cart);
    return due ? dayDifference(due) : null;
  }

  function isDue(cart: Cart) {
    const days = daysUntilDetail(cart);
    return days === null || days <= 0;
  }

  const counts = useMemo(() => {
    const result = {
      total: initialCarts.length,
      active: 0,
      due: 0,
      damaged: 0,
      out: 0,
      retired: 0,
    };

    for (const cart of initialCarts) {
      const status = normalizeStatus(cart.status);
      if (status === "ACTIVE") result.active++;
      if (status === "OUT_OF_SERVICE") result.out++;
      if (status === "RETIRED") result.retired++;
      if (isDamaged(cart)) result.damaged++;
      if (status !== "RETIRED" && isDue(cart)) result.due++;
    }

    return result;
  }, [initialCarts, detailingDays, latestCleaning, openDamageByCart]);

  const filteredCarts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return initialCarts.filter((cart) => {
      const status = normalizeStatus(cart.status);

      if (
        term &&
        !cart.cart_number.toLowerCase().includes(term) &&
        !(cart.notes ?? "").toLowerCase().includes(term)
      ) {
        return false;
      }

      if (filter === "ACTIVE" && status !== "ACTIVE") return false;
      if (filter === "DAMAGED" && !isDamaged(cart)) return false;
      if (filter === "DUE" && !isDue(cart)) return false;
      if (
        filter === "OUT_OF_SERVICE" &&
        status !== "OUT_OF_SERVICE"
      ) {
        return false;
      }
      if (filter === "RETIRED" && status !== "RETIRED") return false;

      return true;
    });
  }, [
    initialCarts,
    search,
    filter,
    detailingDays,
    latestCleaning,
    openDamageByCart,
  ]);

  const selectedCartDamage = useMemo(() => {
    if (!damageHistoryCart) return [];
    return damageHistory.filter(
      (record) =>
        String(record.cart_id) === String(damageHistoryCart.id)
    );
  }, [damageHistoryCart, damageHistory]);

  const selectedCartCleaning = useMemo(() => {
    if (!detailingHistoryCart) return [];
    return cleaningByCart.get(String(detailingHistoryCart.id)) ?? [];
  }, [detailingHistoryCart, cleaningByCart]);

  const detailingCalendar = useMemo(() => {
    return initialCarts
      .filter((cart) => normalizeStatus(cart.status) !== "RETIRED")
      .map((cart) => {
        const cleaning = latestCleaning.get(String(cart.id));
        const dueDate = cleaning
          ? addDays(cleaning.cleaned_at, detailingDays)
          : null;
        const daysUntilDue = dueDate ? dayDifference(dueDate) : null;

        return { cart, cleaning, dueDate, daysUntilDue };
      })
      .sort((a, b) => {
        if (a.daysUntilDue === null && b.daysUntilDue === null) {
          return a.cart.cart_number.localeCompare(
            b.cart.cart_number,
            undefined,
            { numeric: true }
          );
        }
        if (a.daysUntilDue === null) return -1;
        if (b.daysUntilDue === null) return 1;
        if (a.daysUntilDue !== b.daysUntilDue) {
          return a.daysUntilDue - b.daysUntilDue;
        }
        return a.cart.cart_number.localeCompare(
          b.cart.cart_number,
          undefined,
          { numeric: true }
        );
      });
  }, [initialCarts, latestCleaning, detailingDays]);

  const overdueCarts = detailingCalendar.filter(
    (item) => item.daysUntilDue === null || item.daysUntilDue < 0
  );
  const dueTodayCarts = detailingCalendar.filter(
    (item) => item.daysUntilDue === 0
  );
  const nextSevenDays = detailingCalendar.filter(
    (item) =>
      item.daysUntilDue !== null &&
      item.daysUntilDue > 0 &&
      item.daysUntilDue <= 7
  );
  const laterCarts = detailingCalendar.filter(
    (item) => item.daysUntilDue !== null && item.daysUntilDue > 7
  );

  async function saveSchedule(days: number) {
    setDetailingDays(days);
    setSavingSchedule(true);

    try {
      const response = await fetch("/api/carts/detailing-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save schedule.");
      }

      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save the detailing schedule."
      );
    } finally {
      setSavingSchedule(false);
    }
  }

  async function bulkAdd() {
    const start = Number(bulkStart);
    const end = Number(bulkEnd);

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start
    ) {
      alert("Enter a valid starting and ending cart number.");
      return;
    }

    try {
      const response = await fetch("/api/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to add carts.");
      }

      setShowBulkAdd(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to add carts.");
    }
  }

  async function changeStatus(cart: Cart, status: string) {
    setWorkingCart(cart.id);

    try {
      const response = await fetch(`/api/carts/${cart.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update cart status.");
      }

      setCartDetailsCart((current) =>
        current && String(current.id) === String(cart.id)
          ? { ...current, status }
          : current
      );

      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update cart status."
      );
    } finally {
      setWorkingCart(null);
    }
  }

  async function saveCartNotes() {
    if (!cartDetailsCart) return;

    setSavingNotes(true);

    try {
      const response = await fetch(`/api/carts/${cartDetailsCart.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: cartNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save cart notes.");
      }

      setCartDetailsCart((current) =>
        current
          ? {
              ...current,
              notes: cartNotes.trim() || null,
            }
          : current
      );

      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save cart notes."
      );
    } finally {
      setSavingNotes(false);
    }
  }

  async function reportDamage() {
    if (!damageCart) return;

    if (!damageDescription.trim()) {
      alert("Please enter a damage description.");
      return;
    }

    try {
      const response = await fetch(`/api/carts/${damageCart.id}/damage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: damageDescription,
          reportedBy,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save damage report.");
      }

      setDamageCart(null);
      setDamageDescription("");
      setReportedBy("");
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save damage report."
      );
    }
  }

  async function resolveDamage() {
    if (!damageHistoryCart || !resolvingDamage) return;

    try {
      const response = await fetch(
        `/api/carts/${damageHistoryCart.id}/damage/resolve`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportedAt: resolvingDamage.reported_at,
            resolvedBy,
            resolutionNotes,
          }),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to resolve damage report.");
      }

      setResolvingDamage(null);
      setResolvedBy("");
      setResolutionNotes("");
      setDamageHistoryCart(null);
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to resolve damage report."
      );
    }
  }

  async function markDetailed() {
    if (!detailCart) return;

    try {
      const response = await fetch(`/api/carts/${detailCart.id}/clean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cleanedBy,
          notes: cleaningNotes,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to record detailing.");
      }

      setDetailCart(null);
      setCleanedBy("");
      setCleaningNotes("");
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to record detailing."
      );
    }
  }

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-7">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-950">Golf Carts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage fleet status, damage, and detailing.
          </p>
        </div>

        <button
          onClick={() => setShowBulkAdd(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + Add Cart
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setViewMode("FLEET")}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              viewMode === "FLEET"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Fleet
          </button>

          <button
            onClick={() => setViewMode("DETAILING")}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              viewMode === "DETAILING"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Detailing Calendar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {viewMode === "DETAILING" && (
            <span className="text-sm text-slate-500">
              {counts.due} cart{counts.due === 1 ? "" : "s"} currently due
            </span>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-sm text-slate-500">
              Schedule
            </span>

            <select
              value={detailingDays}
              disabled={savingSchedule}
              onChange={(e) => saveSchedule(Number(e.target.value))}
              className="bg-white text-sm font-semibold text-slate-900 outline-none"
            >
              {[7, 14, 21, 30, 45, 60, 90].map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {viewMode === "FLEET" ? (
        <section>
          <div className="mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search carts by number or notes..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                ["ALL", "All"],
                ["ACTIVE", "Active"],
                ["DAMAGED", "Damaged"],
                ["DUE", "Needs detailing"],
                ["OUT_OF_SERVICE", "Out of service"],
                ["RETIRED", "Retired"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value as Filter)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    filter === value
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              Sort: <span className="font-semibold text-slate-900">Cart number</span>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <SummaryInline label="active" value={counts.active} />
            <SummaryInline label="damaged" value={counts.damaged} />
            <SummaryInline label="need detailing" value={counts.due} />
            <SummaryInline label="out of service" value={counts.out} />
            <SummaryInline label="retired" value={counts.retired} />
            <SummaryInline label="total" value={counts.total} />
          </div>

          {filteredCarts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
              <div className="text-lg font-bold text-slate-900">
                No carts match this view.
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Adjust the search or filter to see more carts.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {[...filteredCarts]
                .sort((a, b) =>
                  a.cart_number.localeCompare(
                    b.cart_number,
                    undefined,
                    { numeric: true }
                  )
                )
                .map((cart) => {
                  const cleaning = latestCleaning.get(String(cart.id));
                  const openDamage = openDamageFor(cart);
                  const damaged = openDamage.length > 0;
                  const due = isDue(cart);
                  const status = normalizeStatus(cart.status);
                  const nextDue = nextDetailDate(cart);

                  return (
                    <button
                      key={cart.id}
                      onClick={() => {
                        setCartDetailsCart(cart);
                        setCartNotes(cart.notes ?? "");
                      }}
                      className="min-h-[150px] rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-3xl font-bold tracking-tight text-slate-950">
                          #{cart.cart_number}
                        </div>

                        <div className="flex max-w-[150px] flex-col items-end gap-1.5">
                          <StatusBadge status={status} />

                          {damaged && (
                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-800">
                              Damaged
                              {openDamage.length > 1
                                ? ` (${openDamage.length})`
                                : ""}
                            </span>
                          )}

                          {due && status !== "RETIRED" && (
                            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-800">
                              Needs detailing
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 text-sm text-slate-500">
                        Last detailed:{" "}
                        <span className="font-medium text-slate-700">
                          {formatDate(cleaning?.cleaned_at ?? null)}
                        </span>
                      </div>

                      {damaged && openDamage[0]?.description && (
                        <div className="mt-2 line-clamp-2 text-xs font-medium text-red-700">
                          {openDamage[0].description}
                        </div>
                      )}

                      {cart.notes && !damaged && (
                        <div className="mt-2 line-clamp-2 text-xs text-slate-500">
                          {cart.notes}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-5">
          <DetailingGroup
            title="Overdue / Never Detailed"
            description="These carts should be prioritized for detailing."
            items={overdueCarts}
            detailingDays={detailingDays}
            onDetail={setDetailCart}
            onHistory={setDetailingHistoryCart}
          />
          <DetailingGroup
            title="Due Today"
            description="Carts scheduled for detailing today."
            items={dueTodayCarts}
            detailingDays={detailingDays}
            onDetail={setDetailCart}
            onHistory={setDetailingHistoryCart}
          />
          <DetailingGroup
            title="Next 7 Days"
            description="Upcoming detailing due within one week."
            items={nextSevenDays}
            detailingDays={detailingDays}
            onDetail={setDetailCart}
            onHistory={setDetailingHistoryCart}
          />
          <DetailingGroup
            title="Later"
            description="Future detailing dates based on the current schedule."
            items={laterCarts}
            detailingDays={detailingDays}
            onDetail={setDetailCart}
            onHistory={setDetailingHistoryCart}
            collapsed
          />
        </section>
      )}

      {cartDetailsCart && (
        <Modal
          title={`Cart #${cartDetailsCart.cart_number}`}
          onClose={() => {
            setCartDetailsCart(null);
            setCartNotes("");
          }}
          wide
        >
          {(() => {
            const status = normalizeStatus(cartDetailsCart.status);
            const cleaning = latestCleaning.get(String(cartDetailsCart.id));
            const openDamage = openDamageFor(cartDetailsCart);
            const damaged = openDamage.length > 0;
            const due = isDue(cartDetailsCart);
            const nextDue = nextDetailDate(cartDetailsCart);

            return (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-slate-50 p-4">
                  <div>
                    <div className="text-4xl font-bold tracking-tight text-slate-950">
                      #{cartDetailsCart.cart_number}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge status={status} />

                      {damaged && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                          Damaged
                          {openDamage.length > 1
                            ? ` (${openDamage.length})`
                            : ""}
                        </span>
                      )}

                      {due && status !== "RETIRED" && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">
                          Needs detailing
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full sm:w-[185px]">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Operational Status
                    </label>

                    <select
                      disabled={workingCart === cartDetailsCart.id}
                      value={status}
                      onChange={(e) =>
                        changeStatus(
                          cartDetailsCart,
                          e.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="OUT_OF_SERVICE">Out of Service</option>
                      <option value="RETIRED">Retired</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Last Detailed
                    </div>
                    <div className="mt-1 font-bold text-slate-900">
                      {formatDate(cleaning?.cleaned_at ?? null)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Next Due
                    </div>
                    <div
                      className={`mt-1 font-bold ${
                        due ? "text-orange-700" : "text-slate-900"
                      }`}
                    >
                      {nextDue
                        ? formatDate(nextDue.toISOString())
                        : "Due now"}
                    </div>
                  </div>
                </div>

                {damaged && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-red-900">
                          Open Damage
                        </div>
                        <div className="mt-1 text-sm text-red-800">
                          {openDamage[0]?.description}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setDamageHistoryCart(cartDetailsCart);
                          setCartDetailsCart(null);
                        }}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        View Damage
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Cart Notes
                  </label>

                  <textarea
                    value={cartNotes}
                    onChange={(e) => setCartNotes(e.target.value)}
                    rows={3}
                    placeholder="Add an operational note for this cart..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />

                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={saveCartNotes}
                      disabled={savingNotes}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {savingNotes ? "Saving..." : "Save Notes"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => {
                      setDetailCart(cartDetailsCart);
                      setCartDetailsCart(null);
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Mark Detailed
                  </button>

                  <button
                    onClick={() => {
                      setDetailingHistoryCart(cartDetailsCart);
                      setCartDetailsCart(null);
                    }}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Detailing History
                  </button>

                  <button
                    onClick={() => {
                      setDamageCart(cartDetailsCart);
                      setCartDetailsCart(null);
                    }}
                    className="rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Report Damage
                  </button>

                  <button
                    onClick={() => {
                      setDamageHistoryCart(cartDetailsCart);
                      setCartDetailsCart(null);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Damage History
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {showBulkAdd && (
        <Modal title="Add Golf Carts" onClose={() => setShowBulkAdd(false)}>
          <p className="mb-5 text-sm text-slate-500">
            Enter the starting and ending cart numbers. Existing cart numbers will not be duplicated.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm font-semibold">
              Starting Cart
              <input
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold">
              Ending Cart
              <input
                value={bulkEnd}
                onChange={(e) => setBulkEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            onClick={bulkAdd}
            className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white"
          >
            Add Carts
          </button>
        </Modal>
      )}

      {damageCart && (
        <Modal
          title={`Report Damage — Cart ${damageCart.cart_number}`}
          onClose={() => setDamageCart(null)}
        >
          <label className="block text-sm font-semibold">
            Damage Description
            <textarea
              value={damageDescription}
              onChange={(e) => setDamageDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Reported By
            <input
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            onClick={reportDamage}
            className="mt-5 w-full rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white"
          >
            Save Damage Report
          </button>
        </Modal>
      )}

      {detailCart && (
        <Modal
          title={`Detail Cart ${detailCart.cart_number}`}
          onClose={() => setDetailCart(null)}
        >
          <div className="mb-5 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
            Completing this will reset the next detailing date to{" "}
            <strong>
              {formatDate(
                addDays(new Date(), detailingDays).toISOString()
              )}
            </strong>
            .
          </div>

          <label className="block text-sm font-semibold">
            Detailed By
            <input
              value={cleanedBy}
              onChange={(e) => setCleanedBy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="mt-4 block text-sm font-semibold">
            Notes
            <textarea
              value={cleaningNotes}
              onChange={(e) => setCleaningNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            onClick={markDetailed}
            className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white"
          >
            Mark Detailed Today
          </button>
        </Modal>
      )}

      {detailingHistoryCart && (
        <Modal
          title={`Detailing History — Cart ${detailingHistoryCart.cart_number}`}
          onClose={() => setDetailingHistoryCart(null)}
          wide
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current Schedule
              </div>
              <div className="mt-1 font-bold text-slate-900">
                Every {detailingDays} days
              </div>
            </div>

            <button
              onClick={() => {
                setDetailCart(detailingHistoryCart);
                setDetailingHistoryCart(null);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Detail This Cart
            </button>
          </div>

          {selectedCartCleaning.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <div className="font-semibold text-slate-900">
                No detailing history yet
              </div>
              <p className="mt-1 text-sm text-slate-500">
                This cart will remain due until its first detail is recorded.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedCartCleaning.map((record, index) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-950">
                        {formatDateTime(record.cleaned_at)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {record.cleaned_by
                          ? `Detailed by ${record.cleaned_by}`
                          : "Detail completed"}
                      </div>
                    </div>

                    {index === 0 && (
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        Most Recent
                      </span>
                    )}
                  </div>

                  {record.notes && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      {record.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {damageHistoryCart && !resolvingDamage && (
        <Modal
          title={`Damage History — Cart ${damageHistoryCart.cart_number}`}
          onClose={() => setDamageHistoryCart(null)}
          wide
        >
          {selectedCartDamage.length === 0 ? (
            <p className="text-sm text-slate-500">No damage history.</p>
          ) : (
            <div className="space-y-4">
              {selectedCartDamage.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-950">
                        {record.description}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Reported {formatDateTime(record.reported_at)}
                        {record.reported_by
                          ? ` by ${record.reported_by}`
                          : ""}
                      </div>
                    </div>

                    {record.resolved_at ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        Resolved
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                        Open
                      </span>
                    )}
                  </div>

                  {record.resolved_at ? (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                      <div>
                        <strong>Resolved:</strong>{" "}
                        {formatDateTime(record.resolved_at)}
                      </div>
                      {record.resolved_by && (
                        <div className="mt-1">
                          <strong>Resolved by:</strong> {record.resolved_by}
                        </div>
                      )}
                      {record.resolution_notes && (
                        <div className="mt-1">
                          <strong>Notes:</strong> {record.resolution_notes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolvingDamage(record)}
                      className="mt-4 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Resolve Damage
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {damageHistoryCart && resolvingDamage && (
        <Modal
          title={`Resolve Damage — Cart ${damageHistoryCart.cart_number}`}
          onClose={() => {
            setResolvingDamage(null);
            setResolvedBy("");
            setResolutionNotes("");
          }}
        >
          <div className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-900">
            <strong>Damage:</strong> {resolvingDamage.description}
          </div>

          <label className="block text-sm font-semibold">
            Resolved By
            <input
              value={resolvedBy}
              onChange={(e) => setResolvedBy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="mt-4 block text-sm font-semibold">
            Resolution Notes
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="Example: Rim replaced and cart returned to service."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            onClick={resolveDamage}
            className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
          >
            Mark Damage Resolved
          </button>
        </Modal>
      )}
    </main>
  );
}

function DetailingGroup({
  title,
  description,
  items,
  detailingDays,
  onDetail,
  onHistory,
  collapsed = false,
}: {
  title: string;
  description: string;
  items: Array<{
    cart: Cart;
    cleaning: CleaningRecord | undefined;
    dueDate: Date | null;
    daysUntilDue: number | null;
  }>;
  detailingDays: number;
  onDetail: (cart: Cart) => void;
  onHistory: (cart: Cart) => void;
  collapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsed);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-950">{title}</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {items.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className="text-lg text-slate-400">{expanded ? "−" : "+"}</span>
      </button>

      {expanded &&
        (items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            No carts in this group.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(({ cart, cleaning, dueDate, daysUntilDue }) => (
              <div
                key={cart.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-[250px] items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-lg font-bold text-slate-900">
                    {cart.cart_number}
                  </div>

                  <div>
                    <div
                      className={`font-semibold ${
                        daysUntilDue === null || daysUntilDue <= 0
                          ? "text-amber-700"
                          : "text-slate-900"
                      }`}
                    >
                      {dueLabel(daysUntilDue)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Last detailed: {formatDate(cleaning?.cleaned_at ?? null)}
                    </div>
                  </div>
                </div>

                <div className="min-w-[160px]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Scheduled Date
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {dueDate ? formatDate(dueDate.toISOString()) : "Due now"}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    Every {detailingDays} days
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onHistory(cart)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    History
                  </button>
                  <button
                    onClick={() => onDetail(cart)}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Detail
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function SummaryInline({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-lg font-bold text-slate-950">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="text-2xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-800"
      : status === "OUT_OF_SERVICE"
        ? "bg-slate-200 text-slate-800"
        : "bg-slate-100 text-slate-500";

  const label =
    status === "OUT_OF_SERVICE"
      ? "Out of Service"
      : status.charAt(0) + status.slice(1).toLowerCase();

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[85vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-xl ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold text-slate-950">{title}</h3>
          <button
            onClick={onClose}
            className="text-xl text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
