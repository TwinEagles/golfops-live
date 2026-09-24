"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 60_000;

function easternDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function TvDisplayRefresh({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const router = useRouter();

  useEffect(() => {
    function updateDisplay() {
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      const today = easternDateString();

      if (selectedDate !== today) {
        router.replace(`/tv?date=${today}`);
        return;
      }

      router.refresh();
    }

    const interval = window.setInterval(
      updateDisplay,
      REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(interval);
  }, [router, selectedDate]);

  return null;
}
