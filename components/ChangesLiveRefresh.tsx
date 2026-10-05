"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type ChangesLiveRefreshProps = {
  sheetDate: string;
};

const REFRESH_INTERVAL_MS = 120_000;
const REFRESH_THROTTLE_MS = 60_000;

export default function ChangesLiveRefresh({
  sheetDate,
}: ChangesLiveRefreshProps) {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    function refreshChanges() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();

      if (
        now - lastRefreshAt.current <
        REFRESH_THROTTLE_MS
      ) {
        return;
      }

      lastRefreshAt.current = now;
      router.refresh();
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshChanges();
      }
    }

    // Initial server render already contains current data.
    lastRefreshAt.current = Date.now();

    window.addEventListener(
      "focus",
      refreshChanges
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    const interval =
      window.setInterval(() => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          refreshChanges();
        }
      }, REFRESH_INTERVAL_MS);

    return () => {
      window.removeEventListener(
        "focus",
        refreshChanges
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.clearInterval(interval);
    };
  }, [router, sheetDate]);

  return null;
}
