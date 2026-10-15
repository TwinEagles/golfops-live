"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SyncState = "idle" | "working" | "success" | "warning" | "error";

type SyncResult = {
  ok?: boolean;
  status?: "SUCCESS" | "PARTIAL" | "ERROR";
  error?: string;
  eventCount?: number;
  registrationCount?: number;
  directoryErrors?: Array<{ ggid?: string; error?: string }>;
};

type ExtensionMessage = {
  source?: string;
  type?: string;
  requestId?: string;
  result?: SyncResult;
};

const PAGE_SOURCE = "golfops-live-page";
const EXTENSION_SOURCE = "golfops-live-extension";

export default function GolfGeniusSyncButton() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  const acknowledged = useRef(false);
  const acknowledgementTimer = useRef<number | null>(null);
  const resultTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (acknowledgementTimer.current !== null) window.clearTimeout(acknowledgementTimer.current);
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
    acknowledgementTimer.current = null;
    resultTimer.current = null;
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent<ExtensionMessage>) {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== EXTENSION_SOURCE ||
        event.data.requestId !== requestId.current
      ) return;

      if (event.data.type === "GOLFGENIUS_SYNC_ACK") {
        acknowledged.current = true;
        if (acknowledgementTimer.current !== null) window.clearTimeout(acknowledgementTimer.current);
        acknowledgementTimer.current = null;
        return;
      }

      if (event.data.type !== "GOLFGENIUS_SYNC_RESULT") return;
      clearTimers();
      requestId.current = null;
      const result = event.data.result;

      if (!result?.ok) {
        setState("error");
        setMessage(result?.error || "Golf Genius could not be synchronized.");
        return;
      }

      const errors = result.directoryErrors?.length ?? 0;
      setState(errors > 0 ? "warning" : "success");
      setMessage(
        `Golf Genius sync complete: ${result.eventCount ?? 0} event${result.eventCount === 1 ? "" : "s"} and ${result.registrationCount ?? 0} registration${result.registrationCount === 1 ? "" : "s"}.${errors ? ` ${errors} directory warning${errors === 1 ? "" : "s"}.` : ""}`
      );
      router.refresh();
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimers();
    };
  }, [clearTimers, router]);

  function sync() {
    if (state === "working") return;
    clearTimers();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestId.current = id;
    acknowledged.current = false;
    setState("working");
    setMessage("Checking Clinics and Fitting Events in Golf Genius…");

    window.postMessage(
      { source: PAGE_SOURCE, type: "PULL_GOLFGENIUS_PROGRAMS", requestId: id },
      window.location.origin
    );

    acknowledgementTimer.current = window.setTimeout(() => {
      if (requestId.current !== id || acknowledged.current) return;
      clearTimers();
      requestId.current = null;
      setState("error");
      setMessage("GolfOps Chrome extension version 1.6.4 is required. Replace or reload the extension and try again.");
    }, 2500);

    resultTimer.current = window.setTimeout(() => {
      if (requestId.current !== id) return;
      clearTimers();
      requestId.current = null;
      setState("error");
      setMessage("Golf Genius did not finish within five minutes. Confirm Chrome can open the two Golf Genius directories and try again.");
    }, 300000);
  }

  return (
    <>
      <button
        type="button"
        onClick={sync}
        disabled={state === "working"}
        title="Import Clinics and Fitting Events from Golf Genius"
        className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-500/15 disabled:cursor-wait disabled:opacity-60 sm:h-12 dark:text-emerald-300"
      >
        <span aria-hidden="true">{state === "working" ? "↻" : "⛳"}</span>
        <span className="hidden lg:inline">{state === "working" ? "Syncing Golf Genius…" : "Sync Golf Genius"}</span>
        <span className="lg:hidden">{state === "working" ? "Syncing…" : "Clinics"}</span>
      </button>

      {message && (
        <div
          role="status"
          className={[
            "fixed bottom-4 left-1/2 z-[100] w-[min(92vw,680px)] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl",
            state === "success" ? "bg-emerald-700" : state === "warning" ? "bg-amber-600" : state === "error" ? "bg-red-700" : "bg-slate-800",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-4">
            <span>{message}</span>
            {state !== "working" && (
              <button type="button" onClick={() => setMessage("")} className="text-lg leading-none text-white/80 hover:text-white" aria-label="Dismiss">×</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
