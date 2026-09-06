"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddPlayerModal from "./AddPlayerModal";

type PlayerSlot = {
  id: string | number;
  playerName: string | null;
};

type TeeTimeEditRowProps = {
  slots: PlayerSlot[];
  mobile?: boolean;
};

export default function TeeTimeEditRow({
  slots,
  mobile = false,
}: TeeTimeEditRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addSlotId, setAddSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function removePlayer(slotId: string | number) {
    if (busyId) return;

    const normalizedId = String(slotId);
    setBusyId(normalizedId);
    setError(null);

    try {
      const response = await fetch(`/api/tee-times/${normalizedId}`, {
        method: "DELETE",
      });

      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        throw new Error(`Remove request failed (${response.status}).`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to remove player.");
      }

      setBusyId(null);
      router.refresh();
    } catch (err) {
      console.error("Remove player failed:", err);
      setError(err instanceof Error ? err.message : "Unable to remove player.");
      setBusyId(null);
    }
  }

  function toggleEditing() {
    setIsEditing((current) => !current);
    setError(null);
  }

  if (mobile) {
    return (
      <>
        <button
          type="button"
          onClick={toggleEditing}
          className={[
            "flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition",
            isEditing
              ? "border-indigo-300 bg-indigo-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          {isEditing ? "Done Editing" : "Edit Tee Time"}
        </button>

        {isEditing && (
          <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            {slots.map((slot, index) => {
              const occupied = Boolean(slot.playerName);
              const normalizedId = String(slot.id ?? "");
              const usableSlot =
                Boolean(normalizedId) && !normalizedId.startsWith("empty-");

              return (
                <div
                  key={normalizedId}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Player {index + 1}
                    </div>
                    <div className="truncate text-sm font-semibold text-slate-800">
                      {slot.playerName || "Open"}
                    </div>
                  </div>

                  {occupied ? (
                    <button
                      type="button"
                      onClick={() => removePlayer(slot.id)}
                      disabled={busyId === normalizedId}
                      className="min-h-10 shrink-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {busyId === normalizedId ? "Removing..." : "Remove"}
                    </button>
                  ) : usableSlot ? (
                    <button
                      type="button"
                      onClick={() => setAddSlotId(normalizedId)}
                      className="min-h-10 shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700"
                    >
                      + Add Player
                    </button>
                  ) : (
                    <span className="text-xs italic text-slate-400">
                      Unavailable
                    </span>
                  )}
                </div>
              );
            })}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        {addSlotId && (
          <AddPlayerModal slotId={addSlotId} onClose={() => setAddSlotId(null)} />
        )}
      </>
    );
  }

  return (
    <>
      {isEditing && (
        <div className="pointer-events-none absolute bottom-0 left-[90px] right-[52px] top-0 z-20 grid grid-cols-4">
          {slots.map((slot, index) => {
            const occupied = Boolean(slot.playerName);
            const normalizedId = String(slot.id ?? "");
            const usableSlot =
              Boolean(normalizedId) && !normalizedId.startsWith("empty-");

            return (
              <div
                key={normalizedId}
                className={[
                  "relative flex items-center justify-center border-r border-slate-200",
                  index === 3 ? "border-r-0" : "",
                  occupied ? "bg-white/90" : "bg-indigo-50/90",
                ].join(" ")}
              >
                {occupied ? (
                  <button
                    type="button"
                    onClick={() => removePlayer(slot.id)}
                    disabled={busyId === normalizedId}
                    className="pointer-events-auto max-w-[90%] rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    {busyId === normalizedId ? "Removing..." : "Remove Player"}
                  </button>
                ) : usableSlot ? (
                  <button
                    type="button"
                    onClick={() => setAddSlotId(normalizedId)}
                    className="pointer-events-auto flex h-full w-full items-center justify-center text-sm font-semibold italic text-indigo-600 transition hover:bg-indigo-100"
                  >
                    + Open
                  </button>
                ) : (
                  <div className="text-xs italic text-slate-400">Unavailable</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="relative z-30 flex h-full items-center justify-center">
        <button
          type="button"
          onClick={toggleEditing}
          className={[
            "flex h-10 w-10 items-center justify-center rounded-md border shadow-sm transition",
            isEditing
              ? "border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          ].join(" ")}
          title={isEditing ? "Done editing" : "Edit this tee time"}
        >
          {isEditing ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="m5 12 4 4L19 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          )}
        </button>

        {error && (
          <div className="absolute right-12 top-1/2 z-50 w-64 -translate-y-1/2 rounded-md border border-red-200 bg-white px-3 py-2 text-xs text-red-600 shadow-lg">
            {error}
          </div>
        )}
      </div>

      {addSlotId && (
        <AddPlayerModal slotId={addSlotId} onClose={() => setAddSlotId(null)} />
      )}
    </>
  );
}
