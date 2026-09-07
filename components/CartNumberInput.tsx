"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type CartNumberInputProps = {
  slotId: string;
  initialCartNumber: string | null;
};

export default function CartNumberInput({
  slotId,
  initialCartNumber,
}: CartNumberInputProps) {
  const router = useRouter();

  const [cartNumber, setCartNumber] =
    useState(
      initialCartNumber ?? ""
    );

  const [lastSaved, setLastSaved] =
    useState(
      initialCartNumber ?? ""
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
    Keep the input synchronized when
    another player in the cart pair
    updates the shared cart number.
  */

  useEffect(() => {
    if (saving) {
      return;
    }

    const nextValue =
      initialCartNumber ?? "";

    setCartNumber(nextValue);
    setLastSaved(nextValue);
  }, [
    initialCartNumber,
    saving,
  ]);

  async function saveCartNumber() {
    const cleaned =
      cartNumber.trim();

    if (cleaned === lastSaved) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/tee-times/${slotId}/cart`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              cart_number:
                cleaned,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to save cart."
        );
      }

      const savedValue =
        data.cart_number ?? "";

      setCartNumber(savedValue);
      setLastSaved(savedValue);

      /*
        Refresh the server data so the
        adjacent player's input displays
        the shared cart number.
      */

      router.refresh();
    } catch (caught) {
      console.error(
        "Cart assignment error:",
        caught
      );

      setCartNumber(lastSaved);

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save cart."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-slate-400">
        Cart
      </span>

      <input
        type="text"
        value={cartNumber}
        disabled={saving}
        onChange={(event) =>
          setCartNumber(
            event.target.value
          )
        }
        onBlur={saveCartNumber}
        onKeyDown={(event) => {
          if (
            event.key === "Enter"
          ) {
            event.currentTarget.blur();
          }

          if (
            event.key === "Escape"
          ) {
            setCartNumber(
              lastSaved
            );

            event.currentTarget.blur();
          }
        }}
        placeholder="#"
        className="w-12 rounded border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-semibold text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400"
      />

      {saving && (
        <span className="text-[10px] text-slate-400">
          Saving
        </span>
      )}

      {error && (
        <span
          className="text-[10px] text-red-600"
          title={error}
        >
          !
        </span>
      )}
    </div>
  );
}