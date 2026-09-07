import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import SettingsNav from "@/components/SettingsNav";
import UserPermissionsManager, { type GolfOpsUserRow } from "@/components/UserPermissionsManager";

type PermissionRow = {
  user_id: string;
  tee_sheet: boolean;
  changes: boolean;
  pro_shop: boolean;
  reciprocals: boolean;
  bag_finder: boolean;
  golf_carts: boolean;
  outside_operations: boolean;
  tv: boolean;
};

export default async function UsersSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("club_id, role").eq("id", user.id).single();
  if (!profile?.club_id || profile.role !== "admin") redirect("/settings/account");

  const [usersResult, permissionsResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name, role, created_at").eq("club_id", profile.club_id).order("display_name"),
    supabase.from("user_permissions").select("user_id, tee_sheet, changes, pro_shop, reciprocals, bag_finder, golf_carts, outside_operations, tv").eq("club_id", profile.club_id),
  ]);

  if (usersResult.error) console.error("Users load error:", usersResult.error);
  if (permissionsResult.error) console.error("User permissions load error:", permissionsResult.error);

  const permissionMap = new Map<string, PermissionRow>();
  for (const permission of (permissionsResult.data ?? []) as PermissionRow[]) permissionMap.set(permission.user_id, permission);

  const emailMap = new Map<string, string | null>();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) console.error("Auth users load error:", error);
    else for (const authUser of data.users) emailMap.set(authUser.id, authUser.email ?? null);
  } else {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not configured for Admin user email display.");
  }

  const users: GolfOpsUserRow[] = (usersResult.data ?? []).map((profileUser) => {
    const permission = permissionMap.get(profileUser.id);
    return {
      id: profileUser.id,
      display_name: profileUser.display_name,
      email: emailMap.get(profileUser.id) ?? null,
      role: profileUser.role,
      tee_sheet: permission?.tee_sheet ?? true,
      changes: permission?.changes ?? true,
      pro_shop: permission?.pro_shop ?? true,
      reciprocals: permission?.reciprocals ?? true,
      bag_finder: permission?.bag_finder ?? true,
      golf_carts: permission?.golf_carts ?? true,
      outside_operations: permission?.outside_operations ?? false,
      tv: permission?.tv ?? true,
    };
  });

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="settings" />
      <header className="border-b border-[var(--golfops-border)] bg-[var(--golfops-nav)]">
        <div className="mx-auto max-w-7xl px-5 py-7">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">Manage your account, club, appearance, tee sheet, and integrations.</p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <SettingsNav active="users" />
          <section className="min-w-0">
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight">Users</h2>
              <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">Manage GolfOps Live users, Admin status, and module access.</p>
            </div>
            <UserPermissionsManager initialUsers={users} currentUserId={user.id} />
          </section>
        </div>
      </main>
    </div>
  );
}
