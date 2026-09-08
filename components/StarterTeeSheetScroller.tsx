"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

type StarterTeeSheetScrollerProps = {
  children: ReactNode;
};

export default function StarterTeeSheetScroller({
  children,
}: StarterTeeSheetScrollerProps) {
  const router = useRouter();

  const scrollAreaRef =
    useRef<HTMLDivElement>(null);

  const pausedRef =
    useRef(false);

  useEffect(() => {
    let topPauseUntil =
      Date.now() + 4000;

    let bottomPauseUntil = 0;

    const scrollTimer =
      window.setInterval(() => {
        const scrollArea =
          scrollAreaRef.current;

        if (
          !scrollArea ||
          pausedRef.current
        ) {
          return;
        }

        if (
          scrollArea.scrollHeight <=
          scrollArea.clientHeight
        ) {
          return;
        }

        const now = Date.now();

        if (now < topPauseUntil) {
          return;
        }

        const atBottom =
          scrollArea.scrollTop +
            scrollArea.clientHeight >=
          scrollArea.scrollHeight - 2;

        if (atBottom) {
          if (bottomPauseUntil === 0) {
            bottomPauseUntil =
              now + 5000;

            return;
          }

          if (now < bottomPauseUntil) {
            return;
          }

          scrollArea.scrollTo({
            top: 0,
            behavior: "auto",
          });

          bottomPauseUntil = 0;
          topPauseUntil =
            now + 4000;

          return;
        }

        scrollArea.scrollTop += 1;
      }, 40);

    const refreshTimer =
      window.setInterval(() => {
        router.refresh();
      }, 60_000);

    return () => {
      window.clearInterval(
        scrollTimer
      );

      window.clearInterval(
        refreshTimer
      );
    };
  }, [router]);

  return (
    <div
      ref={scrollAreaRef}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      {children}
    </div>
  );
}
