"use client";

import { useState } from "react";

type CartNumberInputProps = {
  slotId: string;
  initialCartNumber: string | null;
};

export default function CartNumberInput({
  slotId,
  initialCartNumber,
}: CartNumberInputProps) {
  const [cartNumber, setCartNumber] = useState(
    initialCartNumber ?? ""
  );

  const [lastSaved, setLastSaved] = useState(
    initialCartNumber ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveCartNumber() {
    const cleaned = cartNumber.trim();

    if (cleaned === lastSaved) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/tee-times/${slotId}/cart`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cart_number: cleaned,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(
          data.error || "Unable to save cart."
        );
        return;
      }

      const savedValue =
        data.cart_number ?? "";

      setCartNumber(savedValue);
      setLastSaved(savedValue);
    } catch (error) {
      console.error(
        "Cart assignment error:",
        error
      );

      setError("Unable to save cart.");
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
          setCartNumber(event.target.value)
        }
        onBlur={saveCartNumber}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            setCartNumber(lastSaved);
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