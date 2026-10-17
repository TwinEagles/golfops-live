"use client";

import { type ReactNode, useEffect, useState } from "react";

type PlayerArrivalCardProps = {
  slotId: string | number;
  playerName: string;
  initialArrived: boolean;
  className: string;
  children: ReactNode;
};

export default function PlayerArrivalCard({
  slotId,
  playerName,
  initialArrived,
  className,
  children,
}: PlayerArrivalCardProps) {
  const [arrived, setArrived] = useState(initialArrived);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setArrived(initialArrived);
  }, [initialArrived, slotId]);

  async function toggleArrival() {
    if (saving) return;

    const previous = arrived;
    const next = !previous;
    setArrived(next);
    setSaving(true);

    try {
      const response = await fetch(`/api/tee-times/${String(slotId)}/arrival`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arrived: next }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || "Unable to update the player arrival.");
      }
    } catch (error) {
      setArrived(previous);
      window.alert(
        error instanceof Error ? error.message : "Unable to update the player arrival."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={[
        className,
        "transition-colors duration-150",
        arrived
          ? "bg-slate-200 ring-1 ring-inset ring-slate-400/60 dark:bg-slate-700/70"
          : "bg-[var(--golfops-surface)] hover:bg-slate-50 dark:hover:bg-slate-800/70",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={toggleArrival}
        disabled={saving}
        aria-pressed={arrived}
        aria-label={`${arrived ? "Clear arrival for" : "Mark arrived:"} ${playerName}`}
        title={arrived ? "Tap to clear player arrival" : "Tap to mark player arrived"}
        className="absolute inset-0 z-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-slate-500 disabled:cursor-wait"
      />

      <div className="pointer-events-none relative z-10">{children}</div>
    </div>
  );
}
