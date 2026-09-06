"use client";

import { useEffect, useRef, useState } from "react";

type MemberResult = {
  id: string;
  full_name: string | null;
  member_number: string | null;
  bag_number: string | null;
};

export default function BagFinderSearch() {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = search.trim();

    if (!q) {
      setMembers([]);
      setSearching(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/members/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Unable to search members.");
        }

        setMembers(result.members ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Unable to search members."
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  function clearSearch() {
    setSearch("");
    searchInputRef.current?.focus();
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>

          <input
            ref={searchInputRef}
            autoFocus
            type="search"
            inputMode="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, bag #, or member #"
            aria-label="Search members"
            className="w-full rounded-lg border border-slate-300 py-3.5 pl-12 pr-12 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:py-4 sm:text-lg"
          />

          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Clear search"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {!search && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-10 text-center sm:mt-6 sm:px-6 sm:py-14">
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

      {search && searching && (
        <div
          className="mt-4 rounded-xl border border-slate-200 bg-white px-6 py-8 text-center sm:mt-6 sm:py-10"
          role="status"
        >
          <div className="text-sm font-medium text-slate-500">
            Searching...
          </div>
        </div>
      )}

      {error && (
        <div
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:mt-6"
          role="alert"
        >
          {error}
        </div>
      )}

      {search && !searching && !error && members.length === 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-10 text-center sm:mt-6 sm:px-6 sm:py-14">
          <h3 className="text-lg font-bold text-slate-900">
            No members found
          </h3>

          <p className="mt-2 break-words text-sm text-slate-500">
            No member matched “{search}”.
          </p>
        </div>
      )}

      {!searching && members.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:mt-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
            <span className="text-sm font-semibold text-slate-700">
              Search Results
            </span>

            <span className="shrink-0 text-xs text-slate-400">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {members.map((member) => (
              <article
                key={member.id}
                className="px-4 py-4 transition hover:bg-slate-50 sm:grid sm:grid-cols-[minmax(0,1fr)_150px_190px] sm:items-center sm:gap-5 sm:px-6 sm:py-5"
              >
                <div className="min-w-0">
                  <div className="break-words text-lg font-bold text-slate-950 sm:text-xl">
                    {member.full_name ?? "Unnamed Member"}
                  </div>

                  <div className="mt-1 text-sm text-slate-400">
                    {member.member_number
                      ? `Member #${member.member_number}`
                      : "No member number"}
                  </div>
                </div>

                <div className="hidden sm:block">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Member #
                  </div>

                  <div className="mt-1 text-lg font-semibold text-slate-700">
                    {member.member_number ?? "—"}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:mt-0 sm:block sm:border-0 sm:pt-0 sm:text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Bag Number
                  </div>

                  {member.bag_number ? (
                    <div className="inline-flex min-w-[96px] items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-2xl font-black text-white sm:mt-1 sm:min-w-[105px] sm:px-5 sm:py-2">
                      {member.bag_number}
                    </div>
                  ) : (
                    <div className="text-base font-semibold text-slate-400 sm:mt-1 sm:text-lg">
                      No Bag
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
