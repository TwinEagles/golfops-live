"use client";

import { useEffect, useState } from "react";

export type StarterFlyer = {
  id: string;
  title: string;
  source_url: string;
};

export default function StarterFlyerCarousel({
  flyers,
}: {
  flyers: StarterFlyer[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (flyers.length < 2) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % flyers.length);
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [flyers.length]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [flyers.length]);

  const flyer = flyers[currentIndex];

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] shadow-sm">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--golfops-border)] px-4 py-2.5">
        <h2 className="text-xs font-black uppercase tracking-[0.16em] text-[var(--golfops-accent)]">
          Upcoming Events
        </h2>
        {flyers.length > 1 && (
          <span className="text-xs font-semibold text-[var(--golfops-text-muted)]">
            {currentIndex + 1} / {flyers.length}
          </span>
        )}
      </header>

      {flyer ? (
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-white p-2">
          {/* ForeTees flyer links are dynamic club assets, so use an ordinary image URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={flyer.id}
            src={flyer.source_url}
            alt={flyer.title}
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--golfops-surface-soft)] px-5 text-center">
          <p className="text-sm font-semibold text-[var(--golfops-text-muted)]">
            No flyers have synced yet. Open the ForeTees home page in Chrome to import its event flyers.
          </p>
        </div>
      )}
    </section>
  );
}
