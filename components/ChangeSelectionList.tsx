"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ClearChangeButton from "@/components/ClearChangeButton";

type ChangeItem = {
  id: string;
  badge: string;
  badgeClass: string;
  playerName: string;
  detail: string;
  bagNumber: string | null;
  cartNumber: string | null;
  status: "OPEN" | "CLEARED";
};

type ChangeGroup = {
  teeTime: string;
  count: number;
  items: ChangeItem[];
};

type ChangeSelectionListProps = {
  groups: ChangeGroup[];
};

export default function ChangeSelectionList({
  groups,
}: ChangeSelectionListProps) {
  const router = useRouter();

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const [isClearing, setIsClearing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /*
    Only OPEN changes can be selected
    and cleared. Cleared history may still
    be visible when Show Cleared is enabled,
    but those rows are read-only.
  */

  const openIds = useMemo(
    () =>
      groups.flatMap(
        (group) =>
          group.items
            .filter(
              (item) =>
                item.status ===
                "OPEN"
            )
            .map(
              (item) => item.id
            )
      ),
    [groups]
  );

  const allSelected =
    openIds.length > 0 &&
    selectedIds.length ===
      openIds.length &&
    openIds.every((id) =>
      selectedIds.includes(id)
    );

  function toggleOne(
    id: string,
    status: ChangeItem["status"]
  ) {
    if (
      status !== "OPEN"
    ) {
      return;
    }

    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (value) =>
              value !== id
          )
        : [
            ...current,
            id,
          ]
    );
  }

  function toggleAll() {
    setSelectedIds(
      allSelected
        ? []
        : openIds
    );
  }

  async function clearSelected() {
    if (
      selectedIds.length === 0 ||
      isClearing
    ) {
      return;
    }

    setIsClearing(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/changes/clear-selected",
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                ids:
                  selectedIds,
              }),
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        );

      if (
        !contentType?.includes(
          "application/json"
        )
      ) {
        const text =
          await response.text();

        console.error(
          "Unexpected clear-selected response:",
          text
        );

        throw new Error(
          `Clear request failed (${response.status}).`
        );
      }

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to clear selected changes."
        );
      }

      setSelectedIds([]);
      router.refresh();
    } catch (err) {
      console.error(
        "Clear selected failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to clear selected changes."
      );
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label
          className={[
            "flex items-center gap-2 text-xs font-medium",
            openIds.length > 0
              ? "cursor-pointer text-slate-500"
              : "cursor-not-allowed text-slate-300",
          ].join(" ")}
        >
          <input
            type="checkbox"
            checked={
              allSelected
            }
            onChange={
              toggleAll
            }
            disabled={
              openIds.length ===
              0
            }
            className="h-4 w-4 rounded border-slate-300"
          />

          Select all open
        </label>

        <div className="flex items-center gap-3">
          {selectedIds.length >
            0 && (
            <span className="text-xs text-slate-500">
              {
                selectedIds.length
              }{" "}
              selected
            </span>
          )}

          <button
            type="button"
            onClick={
              clearSelected
            }
            disabled={
              selectedIds.length ===
                0 ||
              isClearing
            }
            className={[
              "rounded-md px-3 py-1.5 text-xs font-semibold transition",
              selectedIds.length >
                0
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "cursor-not-allowed bg-slate-200 text-slate-400",
            ].join(" ")}
          >
            {isClearing
              ? "Clearing..."
              : "Clear Selected"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {groups.map(
          (group) => (
            <section
              key={
                group.teeTime
              }
              className="border-b border-slate-200 last:border-b-0"
            >
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                {
                  group.teeTime
                }

                <span className="ml-2 text-xs font-normal text-slate-400">
                  (
                  {
                    group.count
                  }
                  )
                </span>
              </div>

              {group.items.map(
                (item) => {
                  const isCleared =
                    item.status ===
                    "CLEARED";

                  return (
                    <div
                      key={
                        item.id
                      }
                      className={[
                        "grid min-h-[48px] grid-cols-[28px_94px_minmax(0,1fr)_auto_70px] items-center gap-3 border-t border-slate-200 px-4 py-2 first:border-t-0",
                        isCleared
                          ? "bg-slate-50/70 opacity-60"
                          : "",
                      ].join(
                        " "
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.includes(
                            item.id
                          )
                        }
                        onChange={() =>
                          toggleOne(
                            item.id,
                            item.status
                          )
                        }
                        disabled={
                          isCleared
                        }
                        className="h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed"
                      />

                      <span
                        className={[
                          "inline-flex w-fit whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold",
                          item.badgeClass,
                        ].join(
                          " "
                        )}
                      >
                        {
                          item.badge
                        }
                      </span>

                      <div className="min-w-0 text-sm">
                        <span
                          className={[
                            "font-bold",
                            isCleared
                              ? "text-slate-500 line-through"
                              : "text-slate-950",
                          ].join(
                            " "
                          )}
                        >
                          {
                            item.playerName
                          }
                        </span>

                        {item.detail && (
                          <span className="ml-2 text-slate-400">
                            {
                              item.detail
                            }
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 whitespace-nowrap text-xs text-slate-500">
                        {item.bagNumber && (
                          <span className="font-bold text-slate-800">
                            Bag #
                            {
                              item.bagNumber
                            }
                          </span>
                        )}

                        {item.cartNumber && (
                          <span>
                            🛒 Cart #
                            {
                              item.cartNumber
                            }
                          </span>
                        )}
                      </div>

                      <div className="flex justify-end">
                        {isCleared ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                            title="This change has been cleared"
                          >
                            ✓ Cleared
                          </span>
                        ) : (
                          <ClearChangeButton
                            changeId={
                              item.id
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </section>
          )
        )}
      </div>
    </div>
  );
}
