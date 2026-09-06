import { redirect } from "next/navigation";
import { hasGolfOpsPermission } from "@/lib/permissions";

export default async function TvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed =
    await hasGolfOpsPermission(
      "tv"
    );

  if (!allowed) {
    redirect("/settings/account");
  }

  return children;
}