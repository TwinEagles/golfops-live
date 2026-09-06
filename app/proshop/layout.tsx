import { redirect } from "next/navigation";
import { hasGolfOpsPermission } from "@/lib/permissions";

export default async function ProShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed =
    await hasGolfOpsPermission(
      "pro_shop"
    );

  if (!allowed) {
    redirect("/settings/account");
  }

  return children;
}