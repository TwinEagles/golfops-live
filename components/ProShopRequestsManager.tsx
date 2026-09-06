"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: number;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  member_number: string | null;
  bag_number: string | null;
};

type RequestType =
  | "PRACTICE"
  | "TAKEAWAY"
  | "LESSON";

type RequestRow = {
  id: number;
  request_type: RequestType;
  member_id: number | null;
  member_name_snapshot: string;
  member_number_snapshot: string | null;
  bag_number_snapshot: string | null;
  details: string | null;
  status:
    | "ACTIVE"
    | "COMPLETED"
    | "CANCELLED";
  created_at: string;
};

type Props = {
  initialMembers: Member[];
  initialRequests: RequestRow[];
};

function memberName(
  member: Member
) {
  return (
    member.full_name?.trim() ||
    [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Unknown Member"
  );
}

function requestLabel(
  type: RequestType
) {
  switch (type) {
    case "PRACTICE":
      return "Practice";
    case "TAKEAWAY":
      return "Takeaway";
    case "LESSON":
      return "Lesson";
  }
}

function requestStyle(
  type: RequestType
) {
  switch (type) {
    case "PRACTICE":
      return {
        background: "#2563eb",
        soft:
          "rgba(37, 99, 235, 0.15)",
        text: "#60a5fa",
      };
    case "TAKEAWAY":
      return {
        background: "#ea580c",
        soft:
          "rgba(234, 88, 12, 0.15)",
        text: "#fb923c",
      };
    case "LESSON":
      return {
        background: "#810bd0",
        soft:
          "rgba(129, 11, 208, 0.15)",
        text: "#c084fc",
      };
  }
}

function formatTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

export default function ProShopRequestsManager({
  initialMembers,
  initialRequests,
}: Props) {
  const router =
    useRouter();

  const [
    requests,
    setRequests,
  ] =
    useState<RequestRow[]>(
      initialRequests
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    selectedMember,
    setSelectedMember,
  ] =
    useState<Member | null>(
      null
    );

  const [
    details,
    setDetails,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState<RequestType | null>(
      null
    );

  const [
    workingId,
    setWorkingId,
  ] =
    useState<number | null>(
      null
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const normalizedSearch =
    search
      .trim()
      .toLowerCase();

  const matches =
    useMemo(() => {
      if (
        !normalizedSearch ||
        selectedMember
      ) {
        return [];
      }

      return initialMembers
        .filter((member) => {
          const haystack = [
            memberName(member),
            member.member_number ?? "",
            member.bag_number ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            normalizedSearch
          );
        })
        .slice(0, 10);
    }, [
      initialMembers,
      normalizedSearch,
      selectedMember,
    ]);

  async function createRequest(
    requestType: RequestType
  ) {
    if (!selectedMember) {
      return;
    }

    setSubmitting(
      requestType
    );
    setError(null);

    try {
      const response =
        await fetch(
          "/api/pro-shop/requests",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                memberId:
                  selectedMember.id,
                requestType,
                details:
                  details.trim() ||
                  null,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to create request."
        );
      }

      setRequests(
        (current) => [
          ...current,
          result.request,
        ]
      );

      setSelectedMember(
        null
      );
      setSearch("");
      setDetails("");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create request."
      );
    } finally {
      setSubmitting(
        null
      );
    }
  }

  async function updateRequest(
    id: number,
    status:
      | "COMPLETED"
      | "CANCELLED"
  ) {
    setWorkingId(id);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/pro-shop/requests",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                id,
                status,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to update request."
        );
      }

      setRequests(
        (current) =>
          current.filter(
            (request) =>
              request.id !== id
          )
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update request."
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div>
      <section className="mb-6 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] p-6">
        <h2 className="mb-4 text-sm font-semibold text-[var(--golfops-text-muted)]">
          Select Member
        </h2>

        <div className="relative">
          {selectedMember ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--golfops-accent)] bg-[var(--golfops-status,var(--golfops-surface-soft))] px-4 py-3">
              <div>
                <div className="font-semibold">
                  {memberName(
                    selectedMember
                  )}
                </div>

                <div className="mt-0.5 text-xs text-[var(--golfops-text-muted)]">
                  {selectedMember.bag_number
                    ? `Bag ${selectedMember.bag_number}`
                    : "No bag number"}
                  {selectedMember.member_number
                    ? ` • Member #${selectedMember.member_number}`
                    : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedMember(
                    null
                  );
                  setSearch("");
                }}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--golfops-text-muted)] hover:bg-[var(--golfops-surface-soft)]"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search by name or bag number..."
                className="w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg,var(--golfops-surface))] px-4 py-3 text-[var(--golfops-text)] outline-none focus:border-[var(--golfops-accent)]"
              />

              {matches.length >
                0 && (
                <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] shadow-xl">
                  {matches.map(
                    (member) => (
                      <button
                        type="button"
                        key={
                          member.id
                        }
                        onClick={() => {
                          setSelectedMember(
                            member
                          );
                          setSearch(
                            memberName(
                              member
                            )
                          );
                        }}
                        className="flex w-full items-center justify-between gap-4 border-b border-[var(--golfops-border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--golfops-surface-soft)]"
                      >
                        <div>
                          <div className="font-medium">
                            {memberName(
                              member
                            )}
                          </div>

                          <div className="mt-0.5 text-xs text-[var(--golfops-text-muted)]">
                            {member.member_number
                              ? `Member #${member.member_number}`
                              : "No member #"}
                          </div>
                        </div>

                        <div className="text-sm font-semibold text-[var(--golfops-accent-text)]">
                          {member.bag_number
                            ? `Bag ${member.bag_number}`
                            : "—"}
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <input
          value={details}
          onChange={(event) =>
            setDetails(
              event.target.value
            )
          }
          placeholder="Additional details (optional)"
          className="mt-3 w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg,var(--golfops-surface))] px-4 py-2.5 text-sm text-[var(--golfops-text)] outline-none focus:border-[var(--golfops-accent)]"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              "PRACTICE",
              "TAKEAWAY",
              "LESSON",
            ] as RequestType[]
          ).map(
            (type) => {
              const style =
                requestStyle(
                  type
                );

              return (
                <button
                  key={type}
                  type="button"
                  disabled={
                    !selectedMember ||
                    submitting !==
                      null
                  }
                  onClick={() =>
                    createRequest(
                      type
                    )
                  }
                  className="rounded-lg py-3 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-30"
                  style={{
                    background:
                      style.background,
                  }}
                >
                  {submitting ===
                  type
                    ? "Adding..."
                    : requestLabel(
                        type
                      )}
                </button>
              );
            }
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] p-6">
        <h2 className="mb-4 text-sm font-semibold text-[var(--golfops-text-muted)]">
          Active Requests (
          {requests.length})
        </h2>

        {requests.length ===
        0 ? (
          <p className="py-4 text-center text-[var(--golfops-text-dim)]">
            No active requests
          </p>
        ) : (
          <div className="divide-y divide-[var(--golfops-border)]">
            {requests.map(
              (request) => {
                const style =
                  requestStyle(
                    request.request_type
                  );

                return (
                  <div
                    key={
                      request.id
                    }
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
                        style={{
                          background:
                            style.soft,
                          color:
                            style.text,
                        }}
                      >
                        {requestLabel(
                          request.request_type
                        )}
                      </span>

                      <div className="min-w-0">
                        <div className="font-semibold">
                          {
                            request.member_name_snapshot
                          }
                        </div>

                        <div className="mt-0.5 text-xs text-[var(--golfops-text-muted)]">
                          {request.bag_number_snapshot
                            ? `Bag ${request.bag_number_snapshot}`
                            : "No bag number"}
                          {" • "}
                          {formatTime(
                            request.created_at
                          )}
                        </div>

                        {request.details && (
                          <div className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                            {
                              request.details
                            }
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={
                          workingId ===
                          request.id
                        }
                        onClick={() =>
                          updateRequest(
                            request.id,
                            "COMPLETED"
                          )
                        }
                        className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        Complete
                      </button>

                      <button
                        type="button"
                        disabled={
                          workingId ===
                          request.id
                        }
                        onClick={() =>
                          updateRequest(
                            request.id,
                            "CANCELLED"
                          )
                        }
                        className="rounded-lg border border-[var(--golfops-border)] px-3 py-2 text-sm font-semibold text-[var(--golfops-text-muted)] transition hover:bg-[var(--golfops-surface-soft)] disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}
