"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

type Member = {
  id: number;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  member_number: string | null;
  bag_number: string | null;
  email?: string | null;
  phone?: string | null;
};

type ReciprocalClub = {
  id: number;
  name: string;
  advance_days: number | null;
  courses: string[] | null;
  notes: string | null;
  member_fee_summary: string | null;
  guest_fee_summary: string | null;
};

function memberDisplayName(
  member: Member
) {
  return (
    member.full_name?.trim() ||
    `${member.first_name ?? ""} ${
      member.last_name ?? ""
    }`.trim()
  );
}

function emptyPlayers() {
  return Array.from(
    { length: 16 },
    () => ""
  );
}

export default function ReciprocalBookingForm({
  members,
  clubs,
}: {
  members: Member[];
  clubs: ReciprocalClub[];
}) {
  const router = useRouter();

  const [
    memberSearch,
    setMemberSearch,
  ] = useState("");

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState<number | null>(
    null
  );

  const [
    preferredDate,
    setPreferredDate,
  ] = useState("");

  const [
    preferredTime,
    setPreferredTime,
  ] = useState("");

  const [
    timeRange,
    setTimeRange,
  ] = useState("");

  const [
    primaryClubId,
    setPrimaryClubId,
  ] = useState<number | null>(
    null
  );

  const [
    coursePick,
    setCoursePick,
  ] = useState("");

  const [
    alternate1,
    setAlternate1,
  ] = useState("");

  const [
    alternate2,
    setAlternate2,
  ] = useState("");

  const [
    players,
    setPlayers,
  ] = useState<string[]>(
    emptyPlayers()
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const selectedMember =
    useMemo(
      () =>
        members.find(
          (member) =>
            member.id ===
            selectedMemberId
        ) ?? null,
      [
        members,
        selectedMemberId,
      ]
    );

  const selectedClub =
    useMemo(
      () =>
        clubs.find(
          (club) =>
            club.id ===
            primaryClubId
        ) ?? null,
      [
        clubs,
        primaryClubId,
      ]
    );

  const memberResults =
    useMemo(() => {
      const query =
        memberSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return members
        .filter((member) => {
          const name =
            memberDisplayName(
              member
            ).toLowerCase();

          const number =
            (
              member.member_number ??
              ""
            ).toLowerCase();

          const bag =
            (
              member.bag_number ??
              ""
            ).toLowerCase();

          return (
            name.includes(query) ||
            number.includes(query) ||
            bag.includes(query)
          );
        })
        .slice(0, 8);
    }, [
      memberSearch,
      members,
    ]);

  function selectMember(
    member: Member
  ) {
    setSelectedMemberId(
      member.id
    );

    const name =
      memberDisplayName(
        member
      );

    setMemberSearch(name);

    setPlayers((current) => {
      const next = [
        ...current,
      ];

      if (!next[0]) {
        next[0] = name;
      }

      return next;
    });
  }

  function updatePlayer(
    index: number,
    value: string
  ) {
    setPlayers((current) =>
      current.map(
        (player, playerIndex) =>
          playerIndex === index
            ? value
            : player
      )
    );
  }

  async function submit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError(null);

    if (!selectedMember) {
      setError(
        "Select a member."
      );
      return;
    }

    if (!preferredDate) {
      setError(
        "Select the preferred date."
      );
      return;
    }

    if (!selectedClub) {
      setError(
        "Select a reciprocal club."
      );
      return;
    }

    const groups = [];

    for (
      let groupIndex = 0;
      groupIndex < 4;
      groupIndex += 1
    ) {
      const groupPlayers =
        players
          .slice(
            groupIndex * 4,
            groupIndex * 4 + 4
          )
          .map((value) =>
            value.trim()
          )
          .filter(Boolean);

      if (
        groupPlayers.length > 0
      ) {
        groups.push({
          group:
            groupIndex + 1,
          players:
            groupPlayers,
        });
      }
    }

    const numberOfPlayers =
      groups.reduce(
        (
          total,
          group
        ) =>
          total +
          group.players.length,
        0
      );

    if (
      numberOfPlayers === 0
    ) {
      setError(
        "Enter at least one player."
      );
      return;
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          "/api/reciprocals",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                member_id:
                  selectedMember.id,
                reciprocal_club_id:
                  selectedClub.id,
                course_pick:
                  coursePick.trim() ||
                  null,
                course_alternates:
                  [
                    alternate1,
                    alternate2,
                  ]
                    .map((value) =>
                      value.trim()
                    )
                    .filter(
                      Boolean
                    ),
                preferred_date:
                  preferredDate,
                preferred_time:
                  preferredTime.trim() ||
                  null,
                time_range:
                  timeRange.trim() ||
                  null,
                group_members:
                  groups,
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
          result.error ||
            "Unable to create reciprocal request."
        );
      }

      router.push(
        "/reciprocals"
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create reciprocal request."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[980px] px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Book Reciprocal
          </h1>

          <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
            Create a reciprocal request for a TwinEagles member.
          </p>
        </div>

        <Link
          href="/reciprocals"
          className="text-sm font-medium text-[var(--golfops-text-muted)] hover:text-[var(--golfops-text)]"
        >
          ← Back to Reciprocals
        </Link>
      </div>

      <form
        onSubmit={submit}
        className="space-y-5"
      >
        <section className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-5">
          <h2 className="mb-4 text-base font-semibold">
            Member
          </h2>

          <div className="relative">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
              Member Name / Member # / Bag #
            </label>

            <input
              value={memberSearch}
              onChange={(event) => {
                setMemberSearch(
                  event.target.value
                );
                setSelectedMemberId(
                  null
                );
              }}
              placeholder="Search member..."
              className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--golfops-accent)]"
            />

            {!selectedMember &&
              memberResults.length >
                0 && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] shadow-xl">
                  {memberResults.map(
                    (member) => (
                      <button
                        key={
                          member.id
                        }
                        type="button"
                        onClick={() =>
                          selectMember(
                            member
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 border-b border-[var(--golfops-border)] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--golfops-surface-soft)]"
                      >
                        <span>
                          {memberDisplayName(
                            member
                          )}
                        </span>

                        <span className="text-xs text-[var(--golfops-text-dim)]">
                          {member.member_number
                            ? `#${member.member_number}`
                            : ""}
                          {member.bag_number
                            ? `  Bag ${member.bag_number}`
                            : ""}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}
          </div>

          {selectedMember && (
            <div className="mt-3 text-xs text-[var(--golfops-text-muted)]">
              Selected:{" "}
              <strong className="text-[var(--golfops-text)]">
                {memberDisplayName(
                  selectedMember
                )}
              </strong>
              {selectedMember.member_number &&
                ` • Member #${selectedMember.member_number}`}
              {selectedMember.bag_number &&
                ` • Bag ${selectedMember.bag_number}`}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-5">
          <h2 className="mb-4 text-base font-semibold">
            Request
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Preferred Date
              </span>

              <input
                type="date"
                value={
                  preferredDate
                }
                onChange={(event) =>
                  setPreferredDate(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Primary Club
              </span>

              <select
                value={
                  primaryClubId ??
                  ""
                }
                onChange={(event) => {
                  const value =
                    Number(
                      event.target.value
                    );

                  setPrimaryClubId(
                    Number.isFinite(
                      value
                    ) && value > 0
                      ? value
                      : null
                  );

                  setCoursePick(
                    ""
                  );
                }}
                className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm"
              >
                <option value="">
                  Select club...
                </option>

                {clubs.map(
                  (club) => (
                    <option
                      key={club.id}
                      value={club.id}
                    >
                      {club.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Preferred Time
              </span>

              <input
                value={
                  preferredTime
                }
                onChange={(event) =>
                  setPreferredTime(
                    event.target.value
                  )
                }
                placeholder="e.g. 9:00 AM"
                className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Acceptable Time Range
              </span>

              <input
                value={timeRange}
                onChange={(event) =>
                  setTimeRange(
                    event.target.value
                  )
                }
                placeholder="e.g. 8:30 - 11:30 AM"
                className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm"
              />
            </label>

            {selectedClub &&
              (selectedClub.courses ??
                []).length >
                0 && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                    Course
                  </span>

                  <select
                    value={
                      coursePick
                    }
                    onChange={(event) =>
                      setCoursePick(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm"
                  >
                    <option value="">
                      Any course
                    </option>

                    {(
                      selectedClub.courses ??
                      []
                    ).map(
                      (course) => (
                        <option
                          key={
                            course
                          }
                          value={
                            course
                          }
                        >
                          {
                            course
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Alternate Club 1
              </span>

              <input
                value={alternate1}
                onChange={(event) =>
                  setAlternate1(
                    event.target.value
                  )
                }
                placeholder="Optional"
                className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                Alternate Club 2
              </span>

              <input
                value={alternate2}
                onChange={(event) =>
                  setAlternate2(
                    event.target.value
                  )
                }
                placeholder="Optional"
                className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          {selectedClub && (
            <div className="mt-4 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface-muted)] p-3 text-xs text-[var(--golfops-text-muted)]">
              <strong className="text-[var(--golfops-text)]">
                {
                  selectedClub.name
                }
              </strong>

              {selectedClub.advance_days !=
                null && (
                <div className="mt-1">
                  Tee times typically booked{" "}
                  {
                    selectedClub.advance_days
                  }{" "}
                  day
                  {selectedClub.advance_days ===
                  1
                    ? ""
                    : "s"}{" "}
                  in advance.
                </div>
              )}

              {selectedClub.member_fee_summary && (
                <div className="mt-1">
                  {
                    selectedClub.member_fee_summary
                  }
                </div>
              )}

              {selectedClub.guest_fee_summary && (
                <div className="mt-1">
                  {
                    selectedClub.guest_fee_summary
                  }
                </div>
              )}

              {selectedClub.notes && (
                <div className="mt-1">
                  {
                    selectedClub.notes
                  }
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-5">
          <h2 className="mb-1 text-base font-semibold">
            Players
          </h2>

          <p className="mb-4 text-xs text-[var(--golfops-text-muted)]">
            Up to four groups of four players.
          </p>

          <div className="space-y-5">
            {Array.from({
              length: 4,
            }).map(
              (
                _,
                groupIndex
              ) => (
                <div
                  key={
                    groupIndex
                  }
                >
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--golfops-text-dim)]">
                    Group{" "}
                    {
                      groupIndex +
                      1
                    }
                  </div>

                  <div className="grid gap-2 md:grid-cols-4">
                    {Array.from({
                      length: 4,
                    }).map(
                      (
                        _,
                        playerIndex
                      ) => {
                        const index =
                          groupIndex *
                            4 +
                          playerIndex;

                        return (
                          <input
                            key={
                              index
                            }
                            value={
                              players[
                                index
                              ]
                            }
                            onChange={(
                              event
                            ) =>
                              updatePlayer(
                                index,
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder={`Player ${
                              playerIndex +
                              1
                            }`}
                            className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-bg)] px-3 py-2.5 text-sm"
                          />
                        );
                      }
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/reciprocals"
            className="rounded-lg border border-[var(--golfops-border)] px-4 py-2.5 text-sm font-semibold text-[var(--golfops-text-muted)] hover:bg-[var(--golfops-surface-soft)]"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--golfops-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Creating..."
              : "Create Reciprocal Request"}
          </button>
        </div>
      </form>
    </main>
  );
}
