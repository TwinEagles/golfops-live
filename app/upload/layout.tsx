import { redirect } from "next/navigation";
import { hasGolfOpsPermission } from "@/lib/permissions";

export default async function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed =
    await hasGolfOpsPermission(
      "tee_sheet"
    );

  if (!allowed) {
    redirect("/settings/account");
  }

  return children;
}