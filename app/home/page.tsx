import { redirect } from "next/navigation";
import { getGolfOpsAccess } from "@/lib/permissions";

export default async function HomePage() {
  const access = await getGolfOpsAccess();

  if (!access) redirect("/");
  if (access.isAdmin || access.permissions.tee_sheet) redirect("/dashboard");
  if (access.permissions.tv) redirect("/tv");
  if (access.permissions.changes) redirect("/changes");
  if (access.permissions.pro_shop) redirect("/proshop");
  if (access.permissions.reciprocals) redirect("/reciprocals");
  if (access.permissions.bag_finder) redirect("/bagfinder");
  if (access.permissions.golf_carts) redirect("/carts");

  redirect("/settings/account");
}
