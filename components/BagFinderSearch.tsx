"use client";

import { useEffect, useState } from "react";

type MemberResult = {
  id: string;
  full_name: string | null;
  member_number: string | null;
  bag_number: string | null;
};

export default function BagFinderSearch() {
  const [search, setSearch] =
    useState("");

  const [members, setMembers] =
    useState<MemberResult[]>([]);

  const [searching, setSearching] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const q = search.trim();

    if (!q) {
      setMembers([]);
      setSearching(false);
      setError(null);
      return;
    }

    const controller =
      new AbortController();

    const timeout =
      window.setTimeout(
        async () => {
          setSearching(true);
          setError(null);

          try {
            const response =
              await fetch(
                `/api/members/search?q=${encodeURIComponent(
                  q
                )}`,
                {
                  signal:
                    controller.signal,
                }
              );

            const result =
              await response.json();

            if (!response.ok) {
              throw new Error(
                result?.error ||
                  "Unable to search members."
              );
            }

            setMembers(
              result.members ?? []
            );
          } catch (err) {
            if (
              err instanceof DOMException &&
              err.name ===
                "AbortError"
            ) {
              return;
            }

            setError(
              err instanceof Error
                ? err.message
                : "Unable to search members."
            );
          } finally {
            setSearching(false);
          }
        },
        250
      );

    return () => {
      window.clearTimeout(
        timeout
      );

      controller.abort();
    };
  }, [search]);

  return (
    <>
      {/* SEARCH BOX */}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />

            <path d="m21 21-4.3-4.3" />
          </svg>

          <input
            autoFocus
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search member name, bag #, or member #..."
            className="
              w-full
              rounded-lg
              border
              border-slate-300
              py-4
              pl-12
              pr-12
              text-lg
              outline-none
              transition
              focus:border-indigo-500
              focus:ring-2
              focus:ring-indigo-100
            "
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              className="
                absolute
                right-4
                top-1/2
                flex
                h-8
                w-8
                -translate-y-1/2
                items-center
                justify-center
                rounded-md
                text-xl
                font-bold
                text-slate-400
                hover:bg-slate-100
                hover:text-slate-700
              "
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* INITIAL STATE */}

      {!search && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M6 2h9l5 5v15H6z" />
              <path d="M14 2v6h6" />
              <path d="M9 13h6" />
              <path d="M9 17h4" />
            </svg>
          </div>

          <h3 className="mt-4 text-lg font-bold text-slate-900">
            Find a Member Bag
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Start typing a name, bag number, or member number.
          </p>
        </div>
      )}

      {/* SEARCHING */}

      {search &&
        searching && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
            <div className="text-sm font-medium text-slate-500">
              Searching...
            </div>
          </div>
        )}

      {/* ERROR */}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* NO RESULTS */}

      {search &&
        !searching &&
        !error &&
        members.length === 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
            <h3 className="text-lg font-bold text-slate-900">
              No members found
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              No member matched “
              {search}”.
            </p>
          </div>
        )}

      {/* RESULTS */}

      {!searching &&
        members.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <span className="text-sm font-semibold text-slate-700">
                Search Results
              </span>

              <span className="text-xs text-slate-400">
                {members.length}{" "}
                {members.length === 1
                  ? "member"
                  : "members"}
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {members.map(
                (member) => (
                  <div
                    key={member.id}
                    className="
                      grid
                      grid-cols-[minmax(0,1fr)_150px_190px]
                      items-center
                      gap-5
                      px-6
                      py-5
                      transition
                      hover:bg-slate-50
                    "
                  >
                    {/* NAME */}

                    <div>
                      <div className="text-xl font-bold text-slate-950">
                        {member.full_name ??
                          "Unnamed Member"}
                      </div>

                      <div className="mt-1 text-sm text-slate-400">
                        {member.member_number
                          ? `Member #${member.member_number}`
                          : "No member number"}
                      </div>
                    </div>

                    {/* MEMBER NUMBER */}

                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Member #
                      </div>

                      <div className="mt-1 text-lg font-semibold text-slate-700">
                        {member.member_number ??
                          "—"}
                      </div>
                    </div>

                    {/* BAG NUMBER */}

                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Bag Number
                      </div>

                      {member.bag_number ? (
                        <div
                          className="
                            mt-1
                            inline-flex
                            min-w-[105px]
                            items-center
                            justify-center
                            rounded-lg
                            bg-indigo-600
                            px-5
                            py-2
                            text-2xl
                            font-black
                            text-white
                          "
                        >
                          {member.bag_number}
                        </div>
                      ) : (
                        <div className="mt-1 text-lg font-semibold text-slate-400">
                          No Bag
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
    </>
  );
}