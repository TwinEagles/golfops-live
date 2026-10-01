"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type RefreshState =
  "idle" |
  "working" |
  "success" |
  "error";

type RefreshResult = {
  ok?: boolean;
  error?: string;
  changesDetected?: number;
  teeTimesFound?: number;
  playersFound?: number;
  notesImported?: number;
  noteMarkersFound?: number;
  noteCandidatesFound?: number;
  noteCaptureComplete?: boolean;
  noteDocumentsScanned?: number;
};

type ExtensionMessage = {
  source?: string;
  type?: string;
  requestId?: string;
  result?: RefreshResult;
};

type ForeTeesRefreshButtonProps = {
  sheetDate: string;
};

const PAGE_SOURCE =
  "golfops-live-page";

const EXTENSION_SOURCE =
  "golfops-live-extension";

export default function ForeTeesRefreshButton({
  sheetDate,
}: ForeTeesRefreshButtonProps) {
  const router = useRouter();

  const [state, setState] =
    useState<RefreshState>(
      "idle"
    );

  const [message, setMessage] =
    useState("");

  const activeRequestId =
    useRef<string | null>(null);

  const acknowledged =
    useRef(false);

  const acknowledgementTimer =
    useRef<number | null>(null);

  const resultTimer =
    useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (
      acknowledgementTimer.current !==
      null
    ) {
      window.clearTimeout(
        acknowledgementTimer.current
      );
      acknowledgementTimer.current =
        null;
    }

    if (resultTimer.current !== null) {
      window.clearTimeout(
        resultTimer.current
      );
      resultTimer.current = null;
    }
  }, []);

  useEffect(() => {
    function handleMessage(
      event: MessageEvent<ExtensionMessage>
    ) {
      if (
        event.source !== window ||
        event.origin !==
          window.location.origin ||
        event.data?.source !==
          EXTENSION_SOURCE ||
        event.data.requestId !==
          activeRequestId.current
      ) {
        return;
      }

      if (
        event.data.type ===
        "FORETEES_REFRESH_ACK"
      ) {
        acknowledged.current = true;

        if (
          acknowledgementTimer.current !==
          null
        ) {
          window.clearTimeout(
            acknowledgementTimer.current
          );
          acknowledgementTimer.current =
            null;
        }

        return;
      }

      if (
        event.data.type !==
        "FORETEES_REFRESH_RESULT"
      ) {
        return;
      }

      clearTimers();
      activeRequestId.current = null;

      const result =
        event.data.result;

      if (!result?.ok) {
        setState("error");
        setMessage(
          result?.error ||
            "Unable to update the GolfOps Tee Sheet."
        );
        return;
      }

      const changes =
        result.changesDetected ?? 0;

      const notes =
        result.notesImported ?? 0;

      const noteStatus =
        (result.noteMarkersFound ?? 0) > 0 &&
        notes === 0
          ? " ForeTees note detected but could not be imported."
          : notes === 0
            ? ` 0 notes imported. Scanned ${result.noteDocumentsScanned ?? 1} ForeTees page section${(result.noteDocumentsScanned ?? 1) === 1 ? "" : "s"}.`
            : ` ${notes} note${notes === 1 ? "" : "s"} imported.`;

      setState("success");
      setMessage(
        `ForeTees update complete. ${changes} change${changes === 1 ? "" : "s"} detected.${noteStatus}`
      );

      router.refresh();
    }

    window.addEventListener(
      "message",
      handleMessage
    );

    return () => {
      window.removeEventListener(
        "message",
        handleMessage
      );
      clearTimers();
    };
  }, [clearTimers, router]);

  function requestRefresh() {
    if (state === "working") {
      return;
    }

    clearTimers();

    const requestId =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    activeRequestId.current =
      requestId;
    acknowledged.current = false;
    setState("working");
    setMessage(
      "Requesting the latest ForeTees Bag Report..."
    );

    window.postMessage(
      {
        source: PAGE_SOURCE,
        type:
          "PULL_FORETEES_TEE_SHEET",
        requestId,
        sheetDate,
      },
      window.location.origin
    );

    acknowledgementTimer.current =
      window.setTimeout(() => {
        if (
          activeRequestId.current ===
            requestId &&
          !acknowledged.current
        ) {
          activeRequestId.current =
            null;
          setState("error");
          setMessage(
            "GolfOps Chrome extension version 1.4.3 is required. Reload or update the extension and try again."
          );
        }
      }, 2500);

    resultTimer.current =
      window.setTimeout(() => {
        if (
          activeRequestId.current ===
          requestId
        ) {
          activeRequestId.current =
            null;
          setState("error");
          setMessage(
            "The ForeTees refresh timed out. Confirm the matching live tee sheet is open and try again."
          );
        }
      }, 60000);
  }

  return (
    <>
      <button
        type="button"
        onClick={requestRefresh}
        disabled={state === "working"}
        title="Update this tee sheet from the open ForeTees live tee sheet"
        className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] px-3 text-sm font-semibold text-[var(--golfops-text-secondary)] shadow-sm transition hover:bg-[var(--golfops-surface-soft)] disabled:cursor-wait disabled:opacity-60 sm:h-12"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            "h-5 w-5",
            state === "working"
              ? "animate-spin"
              : "",
          ].join(" ")}
          aria-hidden="true"
        >
          <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
        </svg>

        <span className="hidden md:inline">
          {state === "working"
            ? "Updating..."
            : "Update from ForeTees"}
        </span>
      </button>

      {state !== "idle" && message ? (
        <div
          role={
            state === "error"
              ? "alert"
              : "status"
          }
          aria-live="polite"
          className={[
            "fixed bottom-5 right-5 z-[100] max-w-sm rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl",
            state === "success"
              ? "bg-green-700"
              : state === "error"
                ? "bg-red-700"
                : "bg-slate-800",
          ].join(" ")}
        >
          {message}
        </div>
      ) : null}
    </>
  );
}
