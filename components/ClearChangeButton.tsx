"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClearChangeButtonProps = {
  changeId: string;
};

export default function ClearChangeButton({
  changeId,
}: ClearChangeButtonProps) {
  const router = useRouter();

  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clearChange() {
    if (isClearing) {
      return;
    }

    setIsClearing(true);
    setError(null);

    try {
      const response = await fetch("/api/changes/clear", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: changeId,
        }),
      });

      const contentType =
        response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        const text = await response.text();

        console.error(
          "Unexpected clear response:",
          text
        );

        throw new Error(
          `Clear request failed (${response.status}).`
        );
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to clear change."
        );
      }

      router.refresh();
    } catch (err) {
      console.error(
        "Clear change failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to clear change."
      );

      setIsClearing(false);
    }
  }

  return (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={clearChange}
        disabled={isClearing}
        title="Clear change"
        className={[
          "flex h-7 w-7 items-center justify-center rounded",
          "text-lg text-slate-400 transition",
          "hover:bg-slate-100 hover:text-slate-800",
          isClearing
            ? "cursor-wait opacity-50"
            : "",
        ].join(" ")}
      >
        {isClearing ? "…" : "×"}
      </button>

      {error && (
        <div className="absolute right-8 top-0 z-50 w-64 rounded-md border border-red-200 bg-white p-2 text-xs text-red-600 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}