"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 5 * 60_000;
const FOCUS_THROTTLE_MS = 60_000;

export default function OperationsRefresh() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // The initial server render already contains current data.
    lastRefreshAt.current = Date.now();
    function refreshWhenVisible() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt.current < FOCUS_THROTTLE_MS) return;
      lastRefreshAt.current = now;
      startTransition(() => router.refresh());
    }
    const interval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  return (
    <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-3 px-4 py-2">
      <span className="text-xs text-[var(--golfops-text-secondary)]">Updates every 5 minutes</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          lastRefreshAt.current = Date.now();
          startTransition(() => router.refresh());
        }}
        className="rounded-md border border-[var(--golfops-border)] px-3 py-1 text-sm font-semibold disabled:opacity-50"
      >
        {isPending ? "Refreshing…" : "Refresh Now"}
      </button>
    </div>
  );
}
