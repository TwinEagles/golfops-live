"use client";

import { useEffect, useRef, useState } from "react";

type MemberResult = {
  id: string;
  full_name: string | null;
  member_number: string | null;
  bag_number: string | null;
};

export default function BagFinderSearch({ kiosk = false }: { kiosk?: boolean }) {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
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
    setVoiceError(null);
    searchInputRef.current?.focus();
  }

  function startVoiceSearch() {
    setVoiceError(null);
    const browserWindow = window as typeof window & { webkitSpeechRecognition?: new () => any; SpeechRecognition?: new () => any };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("Voice search is not available in this browser. Please use the touch keyboard.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => {
      setListening(false);
      setVoiceError("I couldn’t hear that. Tap to talk and try again.");
    };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const spoken = String(event.results?.[0]?.[0]?.transcript ?? "")
        .replace(/^(find|search for|look up)\s+/i, "")
        .trim();
      if (spoken) {
        setSearch(spoken);
        searchInputRef.current?.blur();
      } else {
        setVoiceError("I didn’t catch a member name. Please try again.");
      }
    };
    recognition.start();
  }

  function callOutBag(member: MemberResult) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const location = member.bag_number ? `Bag slot ${member.bag_number}` : "No bag slot is listed";
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${member.full_name ?? "Member"}. ${location}.`));
  }

  return (
    <>
      <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${kiosk ? "p-5 sm:p-7" : "p-3 sm:p-5"}`}>
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${kiosk ? "left-6 h-8 w-8" : "left-4 h-5 w-5"}`}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>

          <input
            ref={searchInputRef}
            autoFocus={!kiosk}
            type="search"
            inputMode="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={kiosk ? "Touch here to search" : "Name, bag #, or member #"}
            aria-label="Search members"
            className={`w-full border border-slate-300 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${kiosk ? "min-h-24 rounded-xl py-5 pl-16 pr-36 text-2xl sm:text-3xl" : "rounded-lg py-3.5 pl-12 pr-12 text-base sm:py-4 sm:text-lg"}`}
          />

          {kiosk && (
            <button type="button" onClick={startVoiceSearch} disabled={listening}
              className="absolute right-2 top-1/2 flex min-h-16 -translate-y-1/2 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-lg font-bold text-white shadow hover:bg-indigo-700 disabled:bg-rose-600"
              aria-label={listening ? "Listening" : "Tap to talk"}>
              <span aria-hidden="true">🎙</span>{listening ? "Listening…" : "Tap to Talk"}
            </button>
          )}
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${kiosk ? "h-16 w-16 text-4xl" : "h-11 w-11 text-2xl"}`}
              aria-label="Clear search"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {kiosk && voiceError && <div role="status" className="mt-3 rounded-xl bg-amber-50 px-5 py-3 text-lg font-medium text-amber-800">{voiceError}</div>}

      {!search && (
        <div className={`mt-5 rounded-2xl border border-slate-200 bg-white text-center ${kiosk ? "px-6 py-10 sm:mt-7 sm:px-10 sm:py-16" : "px-5 py-10 sm:mt-6 sm:px-6 sm:py-14"}`}>
          <div className={`mx-auto flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ${kiosk ? "h-20 w-20" : "h-14 w-14"}`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={kiosk ? "h-10 w-10" : "h-7 w-7"}
              aria-hidden="true"
            >
              <path d="M6 2h9l5 5v15H6z" />
              <path d="M14 2v6h6" />
              <path d="M9 13h6" />
              <path d="M9 17h4" />
            </svg>
          </div>

          <h3 className={`mt-5 font-bold text-slate-900 ${kiosk ? "text-2xl sm:text-3xl" : "text-lg"}`}>
            Find a Member Bag
          </h3>

          <p className={`mt-3 text-slate-500 ${kiosk ? "text-lg sm:text-xl" : "text-sm"}`}>
            {kiosk ? "Tap the search box and enter a name, bag number, or member number." : "Start typing a name, bag number, or member number."}
          </p>
        </div>
      )}

      {search && searching && (
        <div
          className={`mt-5 rounded-2xl border border-slate-200 bg-white text-center ${kiosk ? "px-6 py-12 sm:py-16" : "px-6 py-8 sm:mt-6 sm:py-10"}`}
          role="status"
        >
          <div className={`font-medium text-slate-500 ${kiosk ? "text-xl" : "text-sm"}`}>
            Searching...
          </div>
        </div>
      )}

      {error && (
        <div
          className={`mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 ${kiosk ? "text-xl" : "text-sm"}`}
          role="alert"
        >
          {error}
        </div>
      )}

      {search && !searching && !error && members.length === 0 && (
        <div className={`mt-5 rounded-2xl border border-slate-200 bg-white px-6 text-center ${kiosk ? "py-14 sm:py-16" : "py-10 sm:mt-6 sm:py-14"}`}>
          <h3 className={`font-bold text-slate-900 ${kiosk ? "text-2xl sm:text-3xl" : "text-lg"}`}>
            No members found
          </h3>

          <p className={`mt-3 break-words text-slate-500 ${kiosk ? "text-lg sm:text-xl" : "text-sm"}`}>
            No member matched “{search}”.
          </p>
        </div>
      )}

      {!searching && members.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={`flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 ${kiosk ? "px-6 py-5 sm:px-8" : "px-4 py-3 sm:px-5"}`}>
            <span className={`font-semibold text-slate-700 ${kiosk ? "text-lg sm:text-xl" : "text-sm"}`}>
              Search Results
            </span>

            <span className={`shrink-0 text-slate-400 ${kiosk ? "text-base sm:text-lg" : "text-xs"}`}>
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {members.map((member) => (
              <article
                key={member.id}
                className={`transition hover:bg-slate-50 ${kiosk ? "px-6 py-6 sm:grid sm:grid-cols-[minmax(0,1fr)_190px_250px] sm:items-center sm:gap-6 sm:px-8 sm:py-7" : "px-4 py-4 sm:grid sm:grid-cols-[minmax(0,1fr)_150px_190px] sm:items-center sm:gap-5 sm:px-6 sm:py-5"}`}
              >
                <div className="min-w-0">
                  <div className={`break-words font-bold text-slate-950 ${kiosk ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl"}`}>
                    {member.full_name ?? "Unnamed Member"}
                  </div>

                  <div className={`mt-2 text-slate-500 ${kiosk ? "text-lg" : "text-sm text-slate-400"}`}>
                    {member.member_number
                      ? `Member #${member.member_number}`
                      : "No member number"}
                  </div>
                </div>

                <div className="hidden sm:block">
                  <div className={`font-semibold uppercase tracking-wide text-slate-400 ${kiosk ? "text-sm" : "text-[10px]"}`}>
                    Member #
                  </div>

                  <div className={`mt-1 font-semibold text-slate-700 ${kiosk ? "text-2xl" : "text-lg"}`}>
                    {member.member_number ?? "—"}
                  </div>
                </div>

                <div className={`mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:mt-0 sm:block sm:border-0 sm:pt-0 sm:text-right ${kiosk ? "sm:min-w-[250px]" : ""}`}>
                  <div className={`font-semibold uppercase tracking-wide text-slate-400 ${kiosk ? "text-sm" : "text-[10px]"}`}>
                    Bag Number
                  </div>

                  {member.bag_number ? (
                    <div className={`inline-flex items-center justify-center rounded-xl bg-indigo-600 font-black text-white sm:mt-1 ${kiosk ? "min-h-20 min-w-[180px] px-6 py-4 text-4xl sm:text-5xl" : "min-w-[96px] rounded-lg px-4 py-2.5 text-2xl sm:min-w-[105px] sm:px-5 sm:py-2"}`}>
                      {member.bag_number}
                    </div>
                  ) : (
                    <div className={`font-semibold text-slate-400 sm:mt-1 ${kiosk ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>
                      No Bag
                    </div>
                  )}
                  {kiosk && <button type="button" onClick={() => callOutBag(member)} className="mt-3 min-h-12 rounded-lg border border-indigo-200 px-4 text-base font-bold text-indigo-700 hover:bg-indigo-50">🔊 Call Out Location</button>}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
