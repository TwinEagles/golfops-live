import { createClient } from "@/lib/supabase/server";

export type PermissionKey =
  | "tee_sheet"
  | "changes"
  | "pro_shop"
  | "reciprocals"
  | "bag_finder"
  | "golf_carts"
  | "outside_operations"
  | "tv";

export type GolfOpsAccess = {
  userId: string;
  clubId: string;
  role: string;
  isAdmin: boolean;
  permissions: Record<PermissionKey, boolean>;
};

const ALL_ACCESS: Record<PermissionKey, boolean> = {
  tee_sheet: true,
  changes: true,
  pro_shop: true,
  reciprocals: true,
  bag_finder: true,
  golf_carts: true,
  outside_operations: true,
  tv: true,
};

export async function getGolfOpsAccess(): Promise<GolfOpsAccess | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) return null;
  const isAdmin = profile.role === "admin";

  if (isAdmin) {
    return { userId: user.id, clubId: profile.club_id, role: profile.role, isAdmin: true, permissions: { ...ALL_ACCESS } };
  }

  const { data: permissionRow } = await supabase
    .from("user_permissions")
    .select("tee_sheet, changes, pro_shop, reciprocals, bag_finder, golf_carts, outside_operations, tv")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    clubId: profile.club_id,
    role: profile.role,
    isAdmin: false,
    permissions: {
      tee_sheet: permissionRow?.tee_sheet ?? false,
      changes: permissionRow?.changes ?? false,
      pro_shop: permissionRow?.pro_shop ?? false,
      reciprocals: permissionRow?.reciprocals ?? false,
      bag_finder: permissionRow?.bag_finder ?? false,
      golf_carts: permissionRow?.golf_carts ?? false,
      outside_operations: permissionRow?.outside_operations ?? false,
      tv: permissionRow?.tv ?? false,
    },
  };
}

export async function hasGolfOpsPermission(permission: PermissionKey) {
  const access = await getGolfOpsAccess();
  if (!access) return false;
  return access.isAdmin || access.permissions[permission] === true;
}
