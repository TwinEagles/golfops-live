"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

const CHECK_INTERVAL_MS = 60_000;

type TeeSheetLiveRefreshProps = {
  sheetDate: string;
};

function userIsEditing() {
  const activeElement = document.activeElement;

  return (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    activeElement?.getAttribute("contenteditable") === "true"
  );
}

export default function TeeSheetLiveRefresh({
  sheetDate,
}: TeeSheetLiveRefreshProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const lastVersion = useRef<string | null>(null);
  const requestInFlight = useRef(false);

  const checkForChanges = useCallback(async () => {
    if (
      requestInFlight.current ||
      document.visibilityState !== "visible" ||
      userIsEditing()
    ) {
      return;
    }

    requestInFlight.current = true;

    try {
      const response = await fetch(
        `/api/tee-sheet/version?date=${encodeURIComponent(sheetDate)}`,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const result = (await response.json()) as {
        ok?: boolean;
        version?: string;
      };

      if (!result.ok || !result.version) {
        return;
      }

      if (lastVersion.current === null) {
        lastVersion.current = result.version;
        return;
      }

      if (lastVersion.current !== result.version) {
        lastVersion.current = result.version;
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (error) {
      console.warn("Tee sheet change check failed:", error);
    } finally {
      requestInFlight.current = false;
    }
  }, [router, sheetDate, startTransition]);

  useEffect(() => {
    lastVersion.current = null;
    void checkForChanges();

    const timer = window.setInterval(
      checkForChanges,
      CHECK_INTERVAL_MS
    );

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void checkForChanges();
      }
    };

    window.addEventListener("focus", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [checkForChanges]);

  return null;
}
