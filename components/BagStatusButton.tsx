"use client";

import { useState } from "react";

type BagStatus =
  | "EMPTY"
  | "CHECKED"
  | "MISSING";

type BagStatusButtonProps = {
  slotId: string | number;
  bagNumber: string | null;
  initialStatus: string | null;
};

function normalizeStatus(
  value: string | null
): BagStatus {
  const normalized = (value ?? "")
    .trim()
    .toUpperCase();

  // Preserve previously saved check-ins.
  if (
    normalized === "CHECKED" ||
    normalized === "X"
  ) {
    return "CHECKED";
  }

  if (normalized === "MISSING") {
    return "MISSING";
  }

  return "EMPTY";
}

function nextStatus(
  status: BagStatus
): BagStatus {
  if (status === "EMPTY") {
    return "CHECKED";
  }

  if (status === "CHECKED") {
    return "MISSING";
  }

  return "EMPTY";
}

export default function BagStatusButton({
  slotId,
  bagNumber,
  initialStatus,
}: BagStatusButtonProps) {
  const [status, setStatus] =
    useState<BagStatus>(
      normalizeStatus(initialStatus)
    );

  const [saving, setSaving] =
    useState(false);

  async function cycleStatus() {
    if (saving) return;

    const previousStatus = status;
    const newStatus =
      nextStatus(previousStatus);

    setStatus(newStatus);
    setSaving(true);

    try {
      const response = await fetch(
        `/api/tee-times/${String(
          slotId
        )}/checkin`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            value:
              newStatus === "EMPTY"
                ? ""
                : newStatus,
          }),
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result?.error ||
            "Unable to update bag status."
        );
      }
    } catch (error) {
      setStatus(previousStatus);

      console.error(
        "Bag status update failed:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update bag status."
      );
    } finally {
      setSaving(false);
    }
  }

  const bagPrefix = bagNumber
    ? `Bag ${bagNumber}: `
    : "";

  const statusLabel =
    status === "CHECKED"
      ? "Bag confirmed"
      : status === "MISSING"
        ? "Bag missing or needs attention"
        : "Bag not reviewed";

  return (
    <button
      type="button"
      onClick={cycleStatus}
      disabled={saving}
      title={`${bagPrefix}${statusLabel}`}
      aria-label={`${bagPrefix}${statusLabel}`}
      className={[
        "flex h-[34px] w-[34px] items-center justify-center rounded-[5px] border",
        "transition-all duration-150",
        status === "CHECKED"
          ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
          : status === "MISSING"
            ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
            : "border-slate-300 bg-white text-transparent hover:border-slate-500",
        saving
          ? "cursor-wait opacity-60"
          : "cursor-pointer",
      ].join(" ")}
    >
      {status === "CHECKED" && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M5 12.5 9.2 17 19 7" />
        </svg>
      )}

      {status === "MISSING" && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      )}
    </button>
  );
}