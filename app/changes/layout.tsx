import { redirect } from "next/navigation";
import { hasGolfOpsPermission } from "@/lib/permissions";

export default async function ChangesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed =
    await hasGolfOpsPermission(
      "changes"
    );

  if (!allowed) {
    redirect("/settings/account");
  }

  return children;
}