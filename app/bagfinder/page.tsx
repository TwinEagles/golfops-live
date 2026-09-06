import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BagFinderSearch from "@/components/BagFinderSearch";
import AppNav from "@/components/AppNav";

export default async function BagFinderPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) {
    return <main className="p-6 sm:p-10">Unable to determine your club.</main>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f4f4]">
      <AppNav active="bag-finder" />

      <main className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-5 sm:py-10">
        <div className="mb-5 sm:mb-6">
          <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">
            Bag Finder
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Search by member name, bag number, or member number.
          </p>
        </div>

        <BagFinderSearch />
      </main>
    </div>
  );
}
