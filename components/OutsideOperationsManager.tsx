"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Shift = "OPENING" | "MIDDAY" | "CLOSING";
type Item = { id: string; shift: Shift; item_order: number; item_text: string };
type Completion = { id: string; item_id: string; operator_name: string; completed_at: string };
type Handoff = { id: string; category: string; note: string; status: "OPEN" | "RESOLVED"; created_by_name: string; created_at: string; resolved_by_name: string | null; resolved_at: string | null };

const shifts: Array<{ key: Shift; label: string }> = [
  { key: "OPENING", label: "Opening" }, { key: "MIDDAY", label: "Midday" }, { key: "CLOSING", label: "Closing" },
];
const categories = ["GENERAL", "MEMBER", "BAG", "CART", "RANGE", "FACILITY"];

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
}

export default function OutsideOperationsManager({ workDate, initialItems, initialCompletions, initialHandoffs, staffNames }: {
  workDate: string; initialItems: Item[]; initialCompletions: Completion[]; initialHandoffs: Handoff[]; staffNames: string[];
}) {
  const [operatorName, setOperatorName] = useState("");
  const [completions, setCompletions] = useState(initialCompletions);
  const [handoffs, setHandoffs] = useState(initialHandoffs);
  const [busy, setBusy] = useState<string | null>(null);
  const [category, setCategory] = useState("GENERAL");
  const [note, setNote] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { setOperatorName(window.localStorage.getItem("golfops-outside-operator") ?? ""); }, []);
  useEffect(() => { setCompletions(initialCompletions); }, [initialCompletions]);
  useEffect(() => { setHandoffs(initialHandoffs); }, [initialHandoffs]);
  function rememberName(value: string) { setOperatorName(value); window.localStorage.setItem("golfops-outside-operator", value); }
  const completedByItem = useMemo(() => new Map(completions.map((entry) => [entry.item_id, entry])), [completions]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/outside-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Unable to save.");
    return result;
  }

  async function toggleItem(item: Item) {
    if (!operatorName.trim()) { setError("Select or enter your name before completing checklist items."); return; }
    setBusy(`item:${item.id}`); setError(""); setMessage("");
    try {
      const existing = completedByItem.get(item.id);
      if (existing) {
        await post({ action: "uncomplete", itemId: item.id, workDate });
        setCompletions((current) => current.filter((entry) => entry.item_id !== item.id));
      } else {
        const result = await post({ action: "complete", itemId: item.id, workDate, operatorName: operatorName.trim() });
        setCompletions((current) => [...current.filter((entry) => entry.item_id !== item.id), result.completion]);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
    finally { setBusy(null); }
  }

  async function addHandoff(event: FormEvent) {
    event.preventDefault();
    if (!operatorName.trim()) { setError("Select or enter your name before adding a handoff note."); return; }
    if (!note.trim()) { setError("Enter a handoff note."); return; }
    setBusy("new-handoff"); setError(""); setMessage("");
    try {
      const result = await post({ action: "add_handoff", workDate, operatorName: operatorName.trim(), category, note: note.trim() });
      setHandoffs((current) => [result.handoff, ...current]); setNote(""); setMessage("Handoff note added.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
    finally { setBusy(null); }
  }

  async function toggleHandoff(handoff: Handoff) {
    if (!operatorName.trim()) { setError("Select or enter your name before updating a handoff item."); return; }
    setBusy(`handoff:${handoff.id}`); setError(""); setMessage("");
    try {
      const result = await post({ action: "resolve_handoff", handoffId: handoff.id, operatorName: operatorName.trim(), resolved: handoff.status === "OPEN" });
      setHandoffs((current) => current.map((entry) => entry.id === handoff.id ? result.handoff : entry));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
    finally { setBusy(null); }
  }

  const visibleHandoffs = handoffs.filter((item) => showResolved || item.status === "OPEN");

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-5 sm:py-8">
      <header className="mb-6">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--golfops-accent-text)]">Daily Execution</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Outside Operations</h1>
        <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">Complete today&apos;s checklist and communicate unresolved items to the next shift.</p>
      </header>

      {(error || message) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

      <section className="mb-6 rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] p-4 shadow-[var(--golfops-shadow)] sm:p-5">
        <label className="block max-w-md">
          <span className="text-sm font-bold">Who is working?</span>
          <input list="outside-ops-staff" value={operatorName} onChange={(event) => rememberName(event.target.value)} placeholder="Select or enter your name" className="mt-2 w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg)] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--golfops-accent)]" />
          <datalist id="outside-ops-staff">{staffNames.map((name) => <option value={name} key={name} />)}</datalist>
          <span className="mt-2 block text-xs text-[var(--golfops-text-dim)]">This name is saved on this device and attached to completed work.</span>
        </label>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {shifts.map((shift) => {
          const items = initialItems.filter((item) => item.shift === shift.key);
          const done = items.filter((item) => completedByItem.has(item.id)).length;
          return (
            <div key={shift.key} className="overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
              <header className="border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-4 py-4">
                <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{shift.label}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${done === items.length && items.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{done}/{items.length}</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div>
              </header>
              <div className="divide-y divide-[var(--golfops-border)]">
                {items.map((item) => {
                  const completion = completedByItem.get(item.id);
                  return <button type="button" key={item.id} disabled={busy !== null} onClick={() => toggleItem(item)} className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-[var(--golfops-surface-soft)] disabled:opacity-60">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black ${completion ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent"}`}>✓</span>
                    <span><span className={`block text-sm font-semibold leading-5 ${completion ? "text-[var(--golfops-text-muted)] line-through" : ""}`}>{item.item_text}</span>{completion && <span className="mt-1 block text-xs text-[var(--golfops-text-dim)]">{completion.operator_name} • {time(completion.completed_at)}</span>}</span>
                  </button>;
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-[var(--golfops-shadow)]">
        <header className="border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-4 py-4 sm:px-5"><h2 className="text-xl font-bold">Shift Handoff</h2><p className="mt-1 text-sm text-[var(--golfops-text-muted)]">Record anything the next shift needs to know or resolve.</p></header>
        <form onSubmit={addHandoff} className="grid gap-3 border-b border-[var(--golfops-border)] p-4 sm:p-5 md:grid-cols-[170px_1fr_auto]">
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg)] px-3 py-3 text-sm font-semibold">{categories.map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}</select>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Member request, missing bag, cart issue, range need..." className="min-h-[48px] resize-y rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg)] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--golfops-accent)]" />
          <button disabled={busy !== null} className="rounded-lg bg-[var(--golfops-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy === "new-handoff" ? "Adding..." : "Add Note"}</button>
        </form>
        <div className="flex items-center justify-between border-b border-[var(--golfops-border)] px-4 py-3 sm:px-5"><span className="text-sm font-semibold">{handoffs.filter((item) => item.status === "OPEN").length} open item(s)</span><label className="flex items-center gap-2 text-sm text-[var(--golfops-text-muted)]"><input type="checkbox" checked={showResolved} onChange={(event) => setShowResolved(event.target.checked)} /> Show resolved</label></div>
        <div className="divide-y divide-[var(--golfops-border)]">
          {visibleHandoffs.length === 0 && <div className="px-5 py-8 text-center text-sm text-[var(--golfops-text-muted)]">No handoff items to display.</div>}
          {visibleHandoffs.map((handoff) => <div key={handoff.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{handoff.category}</span>{handoff.status === "RESOLVED" && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Resolved</span>}</div><p className={`mt-2 text-sm font-medium leading-6 ${handoff.status === "RESOLVED" ? "text-[var(--golfops-text-muted)] line-through" : ""}`}>{handoff.note}</p><p className="mt-1 text-xs text-[var(--golfops-text-dim)]">Added by {handoff.created_by_name} at {time(handoff.created_at)}{handoff.resolved_by_name ? ` • Resolved by ${handoff.resolved_by_name}` : ""}</p></div>
            <button type="button" disabled={busy !== null} onClick={() => toggleHandoff(handoff)} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold ${handoff.status === "OPEN" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600"}`}>{handoff.status === "OPEN" ? "Mark Resolved" : "Reopen"}</button>
          </div>)}
        </div>
      </section>
    </main>
  );
}
