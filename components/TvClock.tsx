"use client";

import { useEffect, useState } from "react";

export default function TvClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clockTimer = window.setInterval(
      () => setNow(new Date()),
      1000
    );

    return () => {
      window.clearInterval(clockTimer);
    };
  }, []);

  return (
    <div className="text-right">
      <div className="text-4xl font-bold tabular-nums tracking-tight text-[var(--golfops-text)]">
        {now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>

      <div className="mt-1 text-sm font-medium text-[var(--golfops-text-muted)]">
        {now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </div>
    </div>
  );
}
