"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
};

export default function TvChangesAutoScroll({
  children,
}: Props) {
  const viewportRef =
    useRef<HTMLDivElement>(null);

  const [overflowing, setOverflowing] =
    useState(false);

  useEffect(() => {
    const viewport =
      viewportRef.current;

    if (!viewport) {
      return;
    }

    function measure() {
      if (!viewport) return;

      setOverflowing(
        viewport.scrollHeight >
          viewport.clientHeight + 4
      );
    }

    measure();

    const observer =
      new ResizeObserver(measure);

    observer.observe(viewport);

    if (
      viewport.firstElementChild
    ) {
      observer.observe(
        viewport.firstElementChild
      );
    }

    return () =>
      observer.disconnect();
  }, [children]);

  useEffect(() => {
    const viewport =
      viewportRef.current;

    if (
      !viewport ||
      !overflowing
    ) {
      return;
    }

    let frame = 0;
    let previousTime =
      performance.now();

    /*
      TV behavior:
      1. Hold the first 5–6 changes.
      2. Slowly scroll downward.
      3. Hold the final changes.
      4. Jump back to the top.
      5. Repeat.
    */
    let pauseUntil =
      performance.now() + 3500;

    const speed = 22; // pixels / second
    const endPause = 3000;
    const resetPause = 3500;

    function animate(
      now: number
    ) {
      if (!viewport) return;

      const maxScroll =
        Math.max(
          0,
          viewport.scrollHeight -
            viewport.clientHeight
        );

      if (maxScroll <= 2) {
        viewport.scrollTop = 0;
        previousTime = now;
        frame =
          requestAnimationFrame(
            animate
          );
        return;
      }

      const delta =
        Math.min(
          now - previousTime,
          100
        );

      previousTime = now;

      if (now >= pauseUntil) {
        viewport.scrollTop +=
          speed *
          (delta / 1000);

        const atBottom =
          viewport.scrollTop >=
          maxScroll - 2;

        if (atBottom) {
          viewport.scrollTop =
            maxScroll;

          pauseUntil =
            now + endPause;

          window.setTimeout(
            () => {
              if (!viewport) return;

              viewport.scrollTop = 0;

              pauseUntil =
                performance.now() +
                resetPause;
            },
            endPause
          );
        }
      }

      frame =
        requestAnimationFrame(
          animate
        );
    }

    viewport.scrollTop = 0;

    frame =
      requestAnimationFrame(
        animate
      );

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [overflowing]);

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        className="h-[470px] overflow-hidden"
      >
        {children}
      </div>

      {overflowing && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--golfops-card, var(--golfops-surface)))",
          }}
        />
      )}
    </div>
  );
}
