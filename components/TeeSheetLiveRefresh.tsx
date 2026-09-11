"use client";

import {
  useCallback,
  useEffect,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS =
  15_000;

function userIsEditing() {
  const activeElement =
    document.activeElement;

  return (
    activeElement instanceof
      HTMLInputElement ||
    activeElement instanceof
      HTMLTextAreaElement ||
    activeElement instanceof
      HTMLSelectElement ||
    activeElement?.getAttribute(
      "contenteditable"
    ) === "true"
  );
}

export default function TeeSheetLiveRefresh() {
  const router = useRouter();

  const [, startTransition] =
    useTransition();

  const refresh =
    useCallback(() => {
      if (
        document.visibilityState !==
          "visible" ||
        userIsEditing()
      ) {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    }, [
      router,
      startTransition,
    ]);

  useEffect(() => {
    const refreshTimer =
      window.setInterval(
        refresh,
        REFRESH_INTERVAL_MS
      );

    const refreshWhenVisible = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refresh();
      }
    };

    window.addEventListener(
      "focus",
      refresh
    );

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible
    );

    return () => {
      window.clearInterval(
        refreshTimer
      );

      window.removeEventListener(
        "focus",
        refresh
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible
      );
    };
  }, [refresh]);

  return null;
}
