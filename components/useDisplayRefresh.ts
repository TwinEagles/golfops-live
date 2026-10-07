"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export function easternDisplayDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function useDisplayRefresh(scope: "tv" | "operations" | "changes", date: string, version: string | null | undefined, intervalMs: number, filters = "") {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lastCheckAt = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef(false);
  useEffect(() => { pending.current = isPending; }, [isPending]);
  useEffect(() => {
    lastCheckAt.current = Date.now();
    let disposed = false;
    let controller: AbortController | null = null;
    async function check() {
      if (document.visibilityState !== "visible" || inFlight.current || pending.current || Date.now() - lastCheckAt.current < 60000) return;
      lastCheckAt.current = Date.now();
      const today = easternDisplayDate();
      if (scope !== "changes" && date !== today) {
        startTransition(() => { if (scope === "tv") router.replace(`/tv?date=${today}`); else router.refresh(); });
        return;
      }
      // Shared OperationsRefresh is also used by Outside Operations, which
      // keeps its existing timed refresh until it has its own fingerprint.
      if (version === undefined) { startTransition(() => router.refresh()); return; }
      inFlight.current = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 15000);
      try {
        const response = await fetch(`/api/display-version?scope=${scope}&date=${encodeURIComponent(date)}&${filters}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Version unavailable");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("version" in data) || typeof data.version !== "string" || !/^[a-f0-9]{64}$/.test(data.version)) throw new Error("Invalid version");
        // Compare to the SERVER RENDERED version, not the last check response.
        // Changes arriving during refresh will be detected by the next check.
        if (!disposed && document.visibilityState === "visible" && data.version !== version) startTransition(() => router.refresh());
      } catch {
        // Fall back to the prior refresh behavior on failures; never silently freeze a display.
        if (!disposed && document.visibilityState === "visible") startTransition(() => router.refresh());
      } finally {
        window.clearTimeout(timeout);
        inFlight.current = false;
      }
    }
    const timer = window.setInterval(() => { void check(); }, intervalMs);
    const onVisible = () => { void check(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, scope, date, version, intervalMs, filters]);
  function refreshNow() {
    lastCheckAt.current = Date.now();
    startTransition(() => router.refresh());
  }
  return { isPending, refreshNow };
}
