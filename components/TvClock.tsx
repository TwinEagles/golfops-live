"use client";

import { useEffect, useState } from "react";

type TvClockProps = {
  variant?: "default" | "starter";
};

export default function TvClock({
  variant = "default",
}: TvClockProps) {
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

  const isStarter = variant === "starter";

  const time = now.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: isStarter ? "2-digit" : undefined,
  });

  const date = now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className={isStarter ? "text-left" : "text-right"}>
      <time
        dateTime={now.toISOString()}
        suppressHydrationWarning
        className={[
          "font-bold tabular-nums tracking-tight text-[var(--golfops-text)]",
          isStarter
            ? "whitespace-nowrap text-7xl leading-none xl:text-8xl 2xl:text-[7rem]"
            : "text-4xl",
        ].join(" ")}
      >
        {time}
      </time>

      <div
        suppressHydrationWarning
        className={[
          "font-medium text-[var(--golfops-text-muted)]",
          isStarter
            ? "mt-3 text-base 2xl:text-lg"
            : "mt-1 text-sm",
        ].join(" ")}
      >
        {date}
      </div>
    </div>
  );
}
