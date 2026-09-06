"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  member_number: string | null;
  bag_number: string | null;
};

type MemberDatabaseManagerProps = {
  initialCount: number;
};

export default function MemberDatabaseManager({
  initialCount,
}: MemberDatabaseManagerProps) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [search, setSearch] =
    useState("");

  const [members, setMembers] =
    useState<Member[]>([]);

  const [memberCount, setMemberCount] =
    useState(initialCount);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [editingMember, setEditingMember] =
    useState<Member | null>(null);

  const [showAdd, setShowAdd] =
    useState(false);

  const [importing, setImporting] =
    useState(false);

  async function loadMembers(q = "") {
    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/settings/members?q=${encodeURIComponent(q)}`
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to load members."
        );
      }

      setMembers(
        result.members ?? []
      );

      if (
        typeof result.count ===
        "number"
      ) {
        setMemberCount(
          result.count
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load members."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          loadMembers(
            search.trim()
          );
        },
        250
      );

    return () =>
      window.clearTimeout(
        timeout
      );
  }, [search]);

  async function deleteMember(
    member: Member
  ) {
    const confirmed =
      window.confirm(
        `Delete ${member.full_name ?? "this member"} from the member database?`
      );

    if (!confirmed) {
      return;
    }

    const response =
      await fetch(
        `/api/settings/members/${member.id}`,
        {
          method: "DELETE",
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      window.alert(
        result?.error ||
          "Unable to delete member."
      );

      return;
    }

    await loadMembers(
      search
    );
  }

  async function importCsv(
    file: File
  ) {
    setImporting(true);
    setError(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/settings/members/import",
          {
            method: "POST",
            body: formData,
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to import member roster."
        );
      }

      window.alert(
        `Member database updated successfully.\n\n${result.imported} members imported.`
      );

      setSearch("");

      await loadMembers("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to import member roster."
      );
    } finally {
      setImporting(false);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[300px] flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />

            <path d="m21 21-4.3-4.3" />
          </svg>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search by name, member #, or bag #..."
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="button"
          onClick={() =>
            setShowAdd(true)
          }
          className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
        >
          + Add Member
        </button>

        <button
          type="button"
          disabled={importing}
          onClick={() =>
            fileInputRef.current?.click()
          }
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {importing
            ? "Importing..."
            : "Import CSV"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file =
              event.target.files?.[0];

            if (file) {
              importCsv(file);
            }
          }}
        />

        <a
          href="/api/settings/members/export"
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Export CSV
        </a>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-sm font-semibold text-slate-700">
            Member Database
          </span>

          <span className="text-xs text-slate-400">
            {memberCount.toLocaleString()} members
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1.5fr)_150px_130px_90px] border-b border-slate-200 bg-white px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <div>Member</div>
          <div>Member #</div>
          <div>Bag #</div>
          <div className="text-right">
            Actions
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No members found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map(
              (member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-[minmax(0,1.5fr)_150px_130px_90px] items-center px-5 py-3 text-sm hover:bg-slate-50"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {member.full_name ??
                        [
                          member.first_name,
                          member.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                    </div>
                  </div>

                  <div className="text-slate-600">
                    {member.member_number ??
                      "—"}
                  </div>

                  <div>
                    {member.bag_number ? (
                      <span className="rounded-md bg-indigo-50 px-2 py-1 font-bold text-indigo-700">
                        {member.bag_number}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        —
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingMember(
                          member
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                      title="Edit member"
                    >
                      ✎
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteMember(
                          member
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete member"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {(showAdd ||
        editingMember) && (
        <MemberEditor
          member={
            editingMember
          }
          onClose={() => {
            setShowAdd(false);
            setEditingMember(
              null
            );
          }}
          onSaved={async () => {
            setShowAdd(false);
            setEditingMember(
              null
            );

            await loadMembers(
              search
            );
          }}
        />
      )}
    </>
  );
}

function MemberEditor({
  member,
  onClose,
  onSaved,
}: {
  member: Member | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] =
    useState(
      member?.first_name ?? ""
    );

  const [lastName, setLastName] =
    useState(
      member?.last_name ?? ""
    );

  const [
    memberNumber,
    setMemberNumber,
  ] =
    useState(
      member?.member_number ??
        ""
    );

  const [bagNumber, setBagNumber] =
    useState(
      member?.bag_number ?? ""
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function save() {
    if (
      !firstName.trim() &&
      !lastName.trim()
    ) {
      setError(
        "Enter a member name."
      );

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url =
        member
          ? `/api/settings/members/${member.id}`
          : "/api/settings/members";

      const response =
        await fetch(url, {
          method:
            member
              ? "PUT"
              : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            first_name:
              firstName.trim(),

            last_name:
              lastName.trim(),

            member_number:
              memberNumber.trim() ||
              null,

            bag_number:
              bagNumber.trim() ||
              null,
          }),
        });

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save member."
        );
      }

      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save member."
      );

      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">
            {member
              ? "Edit Member"
              : "Add Member"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-xl text-slate-400"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-500">
              First Name

              <input
                value={firstName}
                onChange={(event) =>
                  setFirstName(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </label>

            <label className="text-xs font-semibold text-slate-500">
              Last Name

              <input
                value={lastName}
                onChange={(event) =>
                  setLastName(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-500">
            Member Number

            <input
              value={memberNumber}
              onChange={(event) =>
                setMemberNumber(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-500">
            Bag Number

            <input
              value={bagNumber}
              onChange={(event) =>
                setBagNumber(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Member"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}