"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

type MemberResult = {
  id: string;
  full_name: string | null;
  member_number: string | null;
  bag_number: string | null;
};

type AddPlayerModalProps = {
  slotId: string;
  onClose: () => void;
};

export default function AddPlayerModal({
  slotId,
  onClose,
}: AddPlayerModalProps) {
  const router =
    useRouter();

  const [
    mode,
    setMode,
  ] =
    useState<
      "MEMBER" |
      "GUEST"
    >("MEMBER");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    members,
    setMembers,
  ] =
    useState<
      MemberResult[]
    >([]);

  const [
    searching,
    setSearching,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    guestName,
    setGuestName,
  ] =
    useState("");

  const [
    guestBag,
    setGuestBag,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    if (
      mode !== "MEMBER"
    ) {
      return;
    }

    const q =
      search.trim();

    if (!q) {
      setMembers([]);
      setSearching(false);
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

            if (
              !response.ok
            ) {
              throw new Error(
                result?.error ||
                  "Unable to search members."
              );
            }

            setMembers(
              result.members ??
                []
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
            setSearching(
              false
            );
          }
        },
        300
      );

    return () => {
      window.clearTimeout(
        timeout
      );

      controller.abort();
    };
  }, [
    search,
    mode,
  ]);

  async function addMember(
    member: MemberResult
  ) {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/tee-times/${slotId}/player`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              type:
                "MEMBER",

              member_id:
                member.id,
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result?.error ||
            "Unable to add member."
        );
      }

      onClose();

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add member."
      );

      setSaving(false);
    }
  }

  async function addGuest() {
    if (saving) {
      return;
    }

    const name =
      guestName.trim();

    if (!name) {
      setError(
        "Enter the guest's name."
      );

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/tee-times/${slotId}/player`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              type:
                "GUEST",

              player_name:
                name,

              bag_number:
                guestBag.trim() ||
                null,
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result?.error ||
            "Unable to add guest."
        );
      }

      onClose();

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add guest."
      );

      setSaving(false);
    }
  }

  return (
    <div
      className="
        fixed inset-0 z-[100]
        flex items-center
        justify-center
        bg-black/35
        p-4
      "
      onMouseDown={
        onClose
      }
    >
      <div
        className="
          w-full max-w-lg
          overflow-hidden
          rounded-xl
          bg-white
          shadow-2xl
        "
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Add Player
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Add a TwinEagles member or guest to this open tee-sheet position.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-8 w-8 items-center justify-center rounded-md text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        {/* MEMBER / GUEST TABS */}

        <div className="border-b border-slate-200 px-5 pt-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode(
                  "MEMBER"
                );

                setError(
                  null
                );
              }}
              className={[
                "rounded-md px-4 py-2 text-sm font-semibold",
                mode ===
                  "MEMBER"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500",
              ].join(" ")}
            >
              Member
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(
                  "GUEST"
                );

                setError(
                  null
                );
              }}
              className={[
                "rounded-md px-4 py-2 text-sm font-semibold",
                mode ===
                  "GUEST"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500",
              ].join(" ")}
            >
              Add Guest
            </button>
          </div>
        </div>

        <div className="p-5">
          {mode ===
          "MEMBER" ? (
            <>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search members
              </label>

              <input
                autoFocus
                type="search"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Name, bag number, or member number..."
                className="
                  w-full rounded-lg
                  border border-slate-300
                  px-4 py-3
                  text-sm
                  outline-none
                  focus:border-indigo-500
                "
              />

              <div className="mt-4 max-h-[320px] overflow-y-auto rounded-lg border border-slate-200">
                {searching ? (
                  <div className="p-6 text-center text-sm text-slate-400">
                    Searching...
                  </div>
                ) : members.length >
                  0 ? (
                  members.map(
                    (
                      member
                    ) => (
                      <button
                        key={
                          member.id
                        }
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          addMember(
                            member
                          )
                        }
                        className="
                          flex w-full
                          items-center
                          justify-between
                          border-b
                          border-slate-100
                          px-4 py-3
                          text-left
                          last:border-b-0
                          hover:bg-indigo-50
                          disabled:opacity-50
                        "
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {member.full_name ??
                              "Unnamed Member"}
                          </div>

                          {member.member_number && (
                            <div className="mt-0.5 text-xs text-slate-400">
                              Member #
                              {
                                member.member_number
                              }
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          {member.bag_number && (
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                              Bag{" "}
                              {
                                member.bag_number
                              }
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  )
                ) : search ? (
                  <div className="p-6 text-center text-sm text-slate-400">
                    No matching members found.
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-slate-400">
                    Start typing a member name or bag number.
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Guest name
              </label>

              <input
                autoFocus
                type="text"
                value={
                  guestName
                }
                onChange={(
                  event
                ) =>
                  setGuestName(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Guest name"
                className="
                  w-full rounded-lg
                  border border-slate-300
                  px-4 py-3
                  text-sm
                  outline-none
                  focus:border-indigo-500
                "
              />

              <label className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bag number
                <span className="ml-1 font-normal normal-case text-slate-400">
                  optional
                </span>
              </label>

              <input
                type="text"
                value={
                  guestBag
                }
                onChange={(
                  event
                ) =>
                  setGuestBag(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Bag number"
                className="
                  w-full rounded-lg
                  border border-slate-300
                  px-4 py-3
                  text-sm
                  outline-none
                  focus:border-indigo-500
                "
              />

              <button
                type="button"
                onClick={
                  addGuest
                }
                disabled={
                  saving
                }
                className="
                  mt-5 w-full
                  rounded-lg
                  bg-indigo-600
                  px-4 py-3
                  text-sm
                  font-bold
                  text-white
                  hover:bg-indigo-700
                  disabled:opacity-50
                "
              >
                {saving
                  ? "Adding Guest..."
                  : "Add Guest"}
              </button>
            </>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}