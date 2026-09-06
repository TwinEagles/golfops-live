"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type TvAutoScrollProps = {
  children: ReactNode;
  className?: string;
};

export default function TvAutoScroll({
  children,
  className = "",
}: TvAutoScrollProps) {
  const ref =
    useRef<HTMLDivElement>(null);

  const [overflowing, setOverflowing] =
    useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    function measure() {
      if (!element) return;

      setOverflowing(
        element.scrollHeight >
          element.clientHeight + 4
      );
    }

    measure();

    const observer =
      new ResizeObserver(measure);

    observer.observe(element);

    const firstChild =
      element.firstElementChild;

    if (firstChild) {
      observer.observe(firstChild);
    }

    return () => {
      observer.disconnect();
    };
  }, [children]);

  useEffect(() => {
    const element = ref.current;

    if (
      !element ||
      !overflowing
    ) {
      return;
    }

    let direction: 1 | -1 = 1;
    let pauseUntil =
      performance.now() + 2500;

    let animationFrame = 0;
    let previousTime =
      performance.now();

    /*
      Slow television-friendly movement.
      Roughly 18 pixels per second.
    */
    const pixelsPerSecond = 18;

    function animate(
      now: number
    ) {
      if (!element) return;

      const delta =
        Math.min(
          now - previousTime,
          100
        );

      previousTime = now;

      if (now >= pauseUntil) {
        element.scrollTop +=
          direction *
          pixelsPerSecond *
          (delta / 1000);

        const atBottom =
          element.scrollTop +
            element.clientHeight >=
          element.scrollHeight - 2;

        const atTop =
          element.scrollTop <= 1;

        if (
          direction === 1 &&
          atBottom
        ) {
          direction = -1;
          pauseUntil =
            now + 2500;
        } else if (
          direction === -1 &&
          atTop
        ) {
          direction = 1;
          pauseUntil =
            now + 2500;
        }
      }

      animationFrame =
        requestAnimationFrame(
          animate
        );
    }

    animationFrame =
      requestAnimationFrame(
        animate
      );

    return () => {
      cancelAnimationFrame(
        animationFrame
      );
    };
  }, [overflowing]);

  return (
    <div className="relative">
      <div
        ref={ref}
        className={[
          "overflow-y-auto scroll-smooth",
          className,
        ].join(" ")}
      >
        {children}
      </div>

      {overflowing && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--golfops-card, var(--golfops-surface)))",
          }}
        />
      )}
    </div>
  );
}
