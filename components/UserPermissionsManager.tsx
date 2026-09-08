"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Includes the Admin-controlled Outside Operations module permission.

export type GolfOpsUserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  tee_sheet: boolean;
  changes: boolean;
  pro_shop: boolean;
  reciprocals: boolean;
  bag_finder: boolean;
  golf_carts: boolean;
  outside_operations: boolean;
  tv: boolean;
  starter: boolean;
};

type PermissionKey =
  | "tee_sheet"
  | "changes"
  | "pro_shop"
  | "reciprocals"
  | "bag_finder"
  | "golf_carts"
  | "outside_operations"
  | "tv"
  | "starter";

const permissionColumns: Array<{ key: PermissionKey; label: string }> = [
  { key: "tee_sheet", label: "Tee Sheet" },
  { key: "changes", label: "Changes" },
  { key: "pro_shop", label: "Pro Shop" },
  { key: "reciprocals", label: "Reciprocals" },
  { key: "bag_finder", label: "Bag Finder" },
  { key: "golf_carts", label: "Golf Carts" },
  { key: "outside_operations", label: "Outside Ops" },
  { key: "tv", label: "TV" },
  { key: "starter", label: "Starter" },
];

const defaultPermissions: Record<PermissionKey, boolean> = {
  tee_sheet: true,
  changes: true,
  pro_shop: true,
  reciprocals: true,
  bag_finder: true,
  golf_carts: true,
  outside_operations: true,
  tv: true,
  starter: false,
};

function AccessCheckbox({
  checked,
  disabled,
  title,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={[
        "inline-flex h-8 w-8 items-center justify-center",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
      title={title}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 cursor-pointer rounded border-[var(--golfops-border)] accent-[var(--golfops-accent)] disabled:cursor-not-allowed"
      />
    </label>
  );
}

export default function UserPermissionsManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: GolfOpsUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [users, setUsers] = useState<GolfOpsUserRow[]>(initialUsers);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAddUser, setShowAddUser] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newAdmin, setNewAdmin] = useState(false);
  const [newPermissions, setNewPermissions] =
    useState<Record<PermissionKey, boolean>>({ ...defaultPermissions });

  function updateLocalUser(userId: string, patch: Partial<GolfOpsUserRow>) {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, ...patch } : user
      )
    );
  }

  function resetCreateForm() {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewAdmin(false);
    setNewPermissions({ ...defaultPermissions });
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!newName.trim()) {
      setError("Name is required.");
      return;
    }

    if (!newEmail.trim() || !newEmail.includes("@")) {
      setError("A valid email address is required.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          admin: newAdmin,
          permissions: newAdmin
            ? { ...defaultPermissions }
            : newPermissions,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.ok || !result?.user) {
        throw new Error(result?.error || "Unable to create user.");
      }

      const created = result.user;

      setUsers((current) =>
        [
          ...current,
          {
            id: created.id,
            display_name: created.display_name,
            email: created.email ?? null,
            role: created.role,
            tee_sheet: created.permissions?.tee_sheet ?? true,
            changes: created.permissions?.changes ?? true,
            pro_shop: created.permissions?.pro_shop ?? true,
            reciprocals: created.permissions?.reciprocals ?? true,
            bag_finder: created.permissions?.bag_finder ?? true,
            golf_carts: created.permissions?.golf_carts ?? true,
            outside_operations: created.permissions?.outside_operations ?? true,
            tv: created.permissions?.tv ?? true,
            starter: created.permissions?.starter ?? false,
          },
        ].sort((a, b) =>
          (a.display_name ?? "").localeCompare(b.display_name ?? "")
        )
      );

      setMessage(`${created.display_name} was created successfully.`);
      resetCreateForm();
      setShowAddUser(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create user."
      );
    } finally {
      setCreating(false);
    }
  }

  async function setAdmin(user: GolfOpsUserRow, enabled: boolean) {
    const key = `${user.id}:admin`;
    if (savingKey) return;

    setError(null);
    setMessage(null);
    setSavingKey(key);

    const previousRole = user.role;
    updateLocalUser(user.id, { role: enabled ? "admin" : "staff" });

    const { error: rpcError } = await supabase.rpc(
      "set_golfops_admin_status",
      {
        target_user_id: user.id,
        admin_enabled: enabled,
      }
    );

    if (rpcError) {
      updateLocalUser(user.id, { role: previousRole });
      setError(rpcError.message);
      setSavingKey(null);
      return;
    }

    setMessage(
      enabled
        ? `${user.display_name || "User"} now has Admin access.`
        : `${user.display_name || "User"} is now a standard User.`
    );

    setSavingKey(null);
    router.refresh();
  }

  async function setPermission(
    user: GolfOpsUserRow,
    permission: PermissionKey,
    enabled: boolean
  ) {
    const key = `${user.id}:${permission}`;
    if (savingKey || user.role === "admin") return;

    setError(null);
    setMessage(null);
    setSavingKey(key);

    const previous = user[permission];
    updateLocalUser(user.id, { [permission]: enabled });

    const { error: rpcError } = await supabase.rpc(
      "set_golfops_user_permission",
      {
        target_user_id: user.id,
        permission_name: permission,
        permission_enabled: enabled,
      }
    );

    if (rpcError) {
      updateLocalUser(user.id, { [permission]: previous });
      setError(rpcError.message);
      setSavingKey(null);
      return;
    }

    setMessage(`${user.display_name || "User"} access updated.`);
    setSavingKey(null);
  }

  async function removeUser(user: GolfOpsUserRow) {
    if (user.id === currentUserId || savingKey || removingUserId) return;

    const userName = user.display_name || user.email || "this user";
    const confirmed = window.confirm(
      `Remove ${userName} from GolfOps Live?\n\nThis permanently deletes their login and access. This action cannot be undone.`
    );

    if (!confirmed) return;

    setError(null);
    setMessage(null);
    setRemovingUserId(user.id);

    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Unable to remove user.");
      }

      setUsers((current) =>
        current.filter((currentUser) => currentUser.id !== user.id)
      );
      setMessage(`${userName} was removed successfully.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove user.");
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)]">
        <div className="border-b border-[var(--golfops-border)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">GolfOps Users</h3>
              <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                Admin provides full access. Standard Users can be assigned access by module.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-[var(--golfops-text-dim)]">
                {users.length} {users.length === 1 ? "user" : "users"}
              </div>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setShowAddUser((current) => !current);
                }}
                className="rounded-lg bg-[var(--golfops-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                {showAddUser ? "Cancel" : "+ Add User"}
              </button>
            </div>
          </div>
        </div>

        {showAddUser && (
          <div className="border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-5 py-5">
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div>
                <h4 className="text-base font-semibold">Add GolfOps User</h4>
                <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                  Create the employee login and choose their initial access.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold">Name</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Employee name"
                    autoComplete="name"
                    className="mt-2 w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg)] px-3 py-2.5 text-sm text-[var(--golfops-text)] outline-none focus:ring-2 focus:ring-[var(--golfops-accent)]"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Email</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="name@thetwineaglesclub.com"
                    autoComplete="email"
                    className="mt-2 w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg)] px-3 py-2.5 text-sm text-[var(--golfops-text)] outline-none focus:ring-2 focus:ring-[var(--golfops-accent)]"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">
                    Temporary Password
                  </span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className="mt-2 w-full rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-input-bg)] px-3 py-2.5 text-sm text-[var(--golfops-text)] outline-none focus:ring-2 focus:ring-[var(--golfops-accent)]"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">Admin</div>
                    <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                      Admins automatically receive every module plus Club, Members, Tee Sheet Settings, and User Management.
                    </p>
                  </div>

                  <AccessCheckbox checked={newAdmin} onChange={setNewAdmin} />
                </div>
              </div>

              <div>
                <div className="mb-3">
                  <div className="font-semibold">Module Access</div>
                  <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                    Account, Appearance, and Integrations are available to every GolfOps User.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {permissionColumns.map((column) => (
                    <label
                      key={column.key}
                      className={[
                        "flex items-center justify-between gap-3 rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] px-4 py-3",
                        newAdmin ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      <span className="text-sm font-semibold">
                        {column.label}
                      </span>

                      <AccessCheckbox
                        checked={
                          newAdmin ? true : newPermissions[column.key]
                        }
                        disabled={newAdmin}
                        onChange={(checked) =>
                          setNewPermissions((current) => ({
                            ...current,
                            [column.key]: checked,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => {
                    resetCreateForm();
                    setShowAddUser(false);
                  }}
                  className="rounded-lg border border-[var(--golfops-border)] bg-[var(--golfops-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--golfops-text)]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-[var(--golfops-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-[1645px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)]">
                <th className="sticky left-0 z-10 min-w-[235px] bg-[var(--golfops-surface-soft)] px-5 py-3 text-left font-semibold">
                  User
                </th>
                <th className="min-w-[220px] px-4 py-3 text-left font-semibold">
                  Email
                </th>
                <th className="w-[95px] px-3 py-3 text-center font-semibold">
                  Admin
                </th>

                {permissionColumns.map((column) => (
                  <th
                    key={column.key}
                    className="min-w-[105px] px-3 py-3 text-center font-semibold"
                  >
                    {column.label}
                  </th>
                ))}

                <th className="min-w-[120px] px-4 py-3 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isAdmin = user.role === "admin";
                const isCurrentUser = user.id === currentUserId;

                return (
                  <tr
                    key={user.id}
                    className="border-b border-[var(--golfops-border)] last:border-b-0"
                  >
                    <td className="sticky left-0 z-10 bg-[var(--golfops-surface)] px-5 py-4">
                      <div className="font-semibold">
                        {user.display_name || "Unnamed User"}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--golfops-text-dim)]">
                        <span>{isAdmin ? "Admin" : "User"}</span>

                        {isCurrentUser && (
                          <span className="rounded-full bg-[var(--golfops-surface-soft)] px-2 py-0.5 font-semibold">
                            You
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-left text-sm text-[var(--golfops-text-muted)]">
                      {user.email || "No email available"}
                    </td>

                    <td className="px-3 py-4 text-center">
                      <AccessCheckbox
                        checked={isAdmin}
                        disabled={isCurrentUser || savingKey !== null}
                        title={
                          isCurrentUser
                            ? "You cannot remove your own Admin access."
                            : isAdmin
                              ? "Remove Admin access"
                              : "Grant Admin access"
                        }
                        onChange={(checked) => setAdmin(user, checked)}
                      />
                    </td>

                    {permissionColumns.map((column) => {
                      const checked = isAdmin ? true : user[column.key];
                      const disabled = isAdmin || savingKey !== null;

                      return (
                        <td
                          key={column.key}
                          className="px-3 py-4 text-center"
                        >
                          <AccessCheckbox
                            checked={checked}
                            disabled={disabled}
                            title={
                              isAdmin
                                ? "Admin users automatically have access to every module."
                                : `${checked ? "Disable" : "Enable"} ${column.label} access`
                            }
                            onChange={(next) =>
                              setPermission(user, column.key, next)
                            }
                          />
                        </td>
                      );
                    })}

                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        disabled={
                          isCurrentUser ||
                          savingKey !== null ||
                          removingUserId !== null
                        }
                        onClick={() => removeUser(user)}
                        title={
                          isCurrentUser
                            ? "You cannot remove your own account."
                            : `Remove ${user.display_name || "user"}`
                        }
                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {removingUserId === user.id ? "Removing..." : "Remove"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] px-5 py-4">
        <div className="font-semibold">Settings access</div>
        <p className="mt-1 text-sm leading-6 text-[var(--golfops-text-muted)]">
          Every GolfOps User can access Account, Appearance, and Integrations. Club, Members, Tee Sheet Settings, and User Management are reserved for Admins.
        </p>
      </div>
    </div>
  );
}
