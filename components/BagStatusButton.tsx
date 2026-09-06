"use client";

import { useState } from "react";

type BagStatusButtonProps = {
  slotId: string | number;
  bagNumber: string | null;
  initialStatus: string | null;
};

export default function BagStatusButton({
  slotId,
  bagNumber,
  initialStatus,
}: BagStatusButtonProps) {
  const [checkedIn, setCheckedIn] =
    useState(
      (initialStatus ?? "")
        .trim()
        .toUpperCase() === "X"
    );

  const [saving, setSaving] =
    useState(false);

  async function toggleStatus() {
    if (saving) {
      return;
    }

    const nextCheckedIn =
      !checkedIn;

    /*
      Change immediately on screen.
    */

    setCheckedIn(
      nextCheckedIn
    );

    setSaving(true);

    try {
      const response =
        await fetch(
          `/api/tee-times/${String(
            slotId
          )}/checkin`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                value:
                  nextCheckedIn
                    ? "X"
                    : "",
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
            "Unable to update check-in status."
        );
      }
    } catch (error) {
      /*
        Put it back if save failed.
      */

      setCheckedIn(
        !nextCheckedIn
      );

      console.error(
        "Check-in update failed:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update check-in status."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={
        toggleStatus
      }
      disabled={saving}
      title={
        checkedIn
          ? `${
              bagNumber
                ? `Bag ${bagNumber}: `
                : ""
            }Checked in`
          : `${
              bagNumber
                ? `Bag ${bagNumber}: `
                : ""
            }Not checked in`
      }
      aria-label={
        checkedIn
          ? "Checked in"
          : "Not checked in"
      }
      className={[
        "flex h-[34px] w-[34px] items-center justify-center rounded-[5px]",
        "transition-all duration-150",
        checkedIn
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "bg-red-600 text-white hover:bg-red-700",
        saving
          ? "cursor-wait opacity-60"
          : "cursor-pointer",
      ].join(" ")}
    >
      {checkedIn ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M5 12.5 9.2 17 19 7" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="h-5 w-5"
        >
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      )}
    </button>
  );
}