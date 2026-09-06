import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MemberDatabaseManager from "@/components/MemberDatabaseManager";
import AppNav from "@/components/AppNav";

export default async function MembersSettingsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select(
        "club_id, role"
      )
      .eq("id", user.id)
      .single();

  if (
    !profile?.club_id ||
    profile.role !==
      "admin"
  ) {
    redirect(
      "/settings/account"
    );
  }

  const { count } =
    await supabase
      .from("members")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "club_id",
        profile.club_id
      );

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <AppNav active="settings" />

      <main className="mx-auto max-w-[1100px] px-5 py-9">
        <Link
          href="/settings"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          ← Settings
        </Link>

        <div className="mb-6 mt-4">
          <h2 className="text-3xl font-bold text-slate-950">
            Member Database
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage the member roster used by Bag Finder, ForeTees matching, and manual tee-sheet additions.
          </p>
        </div>

        <MemberDatabaseManager
          initialCount={
            count ?? 0
          }
        />
      </main>
    </div>
  );
}