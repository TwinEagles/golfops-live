"use client";
import { useDisplayRefresh, easternDisplayDate } from "@/components/useDisplayRefresh";
export default function OperationsRefresh({ selectedDate = easternDisplayDate(), version }: { selectedDate?: string; version?: string | null }) {
  const { isPending, refreshNow } = useDisplayRefresh("operations", selectedDate, version, 5 * 60000);
  return (
    <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-3 px-4 py-2">
      <span className="text-xs text-[var(--golfops-text-secondary)]">Checks for updates every 5 minutes</span>
      <button
        type="button"
        disabled={isPending}
        onClick={refreshNow}
        className="rounded-md border border-[var(--golfops-border)] px-3 py-1 text-sm font-semibold disabled:opacity-50"
      >
        {isPending ? "Refreshing…" : "Refresh Now"}
      </button>
    </div>
  );
}
