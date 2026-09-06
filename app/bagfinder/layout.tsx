import { redirect } from "next/navigation";
import { hasGolfOpsPermission } from "@/lib/permissions";

export default async function BagFinderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed =
    await hasGolfOpsPermission(
      "bag_finder"
    );

  if (!allowed) {
    redirect("/settings/account");
  }

  return children;
}