import { redirect } from "next/navigation";
import { getGolfOpsAccess } from "@/lib/permissions";

export default async function HomePage() {
  const access = await getGolfOpsAccess();

  if (!access) redirect("/");
  const canOperations =
    access.isAdmin ||
    access.permissions.tee_sheet ||
    access.permissions.changes ||
    access.permissions.pro_shop ||
    access.permissions.golf_carts;

  if (canOperations) redirect("/operations");
  if (access.permissions.tv) redirect("/tv");
  if (access.permissions.reciprocals) redirect("/reciprocals");
  if (access.permissions.bag_finder) redirect("/bagfinder");
  if (access.permissions.golf_carts) redirect("/carts");

  redirect("/settings/account");
}
