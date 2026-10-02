"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type ChangesLiveRefreshProps = {
  sheetDate: string;
};

const REFRESH_INTERVAL_MS = 30_000;
const REFRESH_THROTTLE_MS = 2_000;

export default function ChangesLiveRefresh({
  sheetDate,
}: ChangesLiveRefreshProps) {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    function refreshChanges() {
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

    refreshChanges();

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
