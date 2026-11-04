import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";
import BagFinderSearch from "@/components/BagFinderSearch";

export default async function BagFinderKioskPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?next=%2Fbagfinder%2Fkiosk");
  }

  if (!(await hasGolfOpsPermission("bag_finder"))) {
    redirect("/settings/account");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
        <p className="text-2xl font-semibold text-slate-700">
          Unable to determine your club.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-indigo-600 sm:text-base">
              TwinEagles Club
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              Bag Finder
            </h1>
          </div>
          <p className="hidden text-lg font-medium text-slate-500 sm:block">
            Tap to search or speak a member’s name
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-10 sm:py-10">
        <p className="mb-5 text-lg font-medium text-slate-600 sm:mb-7 sm:text-2xl">
          Search by member name, bag number, or member number.
        </p>
        <BagFinderSearch kiosk />
      </main>
    </div>
  );
}
