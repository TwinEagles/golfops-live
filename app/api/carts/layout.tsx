import { redirect } from "next/navigation";
import { hasGolfOpsPermission } from "@/lib/permissions";

export default async function GolfCartsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed =
    await hasGolfOpsPermission(
      "golf_carts"
    );

  if (!allowed) {
    redirect("/settings/account");
  }

  return children;
}