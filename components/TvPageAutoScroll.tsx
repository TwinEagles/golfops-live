"use client";

import { useEffect } from "react";

export default function TvPageAutoScroll() {
  useEffect(() => {
    let direction: 1 | -1 = 1;
    let pauseUntil =
      performance.now() + 4000;
    let lastTime =
      performance.now();
    let frame = 0;

    /*
      Designed for an unattended TV display:
      - pauses at the top
      - slowly scrolls down
      - pauses at the bottom
      - slowly returns to the top
      - repeats continuously
    */
    const pixelsPerSecond = 16;
    const endPauseMs = 4000;

    function animate(now: number) {
      const maxScroll =
        Math.max(
          0,
          document.documentElement.scrollHeight -
            window.innerHeight
        );

      /*
        If everything fits on the screen,
        stay at the top and keep checking.
      */
      if (maxScroll <= 2) {
        if (window.scrollY !== 0) {
          window.scrollTo({
            top: 0,
            behavior: "auto",
          });
        }

        lastTime = now;
        frame =
          requestAnimationFrame(
            animate
          );
        return;
      }

      const delta =
        Math.min(
          now - lastTime,
          100
        );

      lastTime = now;

      if (now >= pauseUntil) {
        const next =
          window.scrollY +
          direction *
            pixelsPerSecond *
            (delta / 1000);

        window.scrollTo({
          top: next,
          behavior: "auto",
        });

        const atBottom =
          window.scrollY >=
          maxScroll - 2;

        const atTop =
          window.scrollY <= 1;

        if (
          direction === 1 &&
          atBottom
        ) {
          direction = -1;
          pauseUntil =
            now + endPauseMs;
        } else if (
          direction === -1 &&
          atTop
        ) {
          direction = 1;
          pauseUntil =
            now + endPauseMs;
        }
      }

      frame =
        requestAnimationFrame(
          animate
        );
    }

    /*
      Always start at the top when the TV page loads.
    */
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });

    frame =
      requestAnimationFrame(
        animate
      );

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
