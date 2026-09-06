import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import ProShopRequestsManager from "@/components/ProShopRequestsManager";

type Member = {
  id: number;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  member_number: string | null;
  bag_number: string | null;
};

type RequestRow = {
  id: number;
  request_type: "PRACTICE" | "TAKEAWAY" | "LESSON";
  member_id: number | null;
  member_name_snapshot: string;
  member_number_snapshot: string | null;
  bag_number_snapshot: string | null;
  details: string | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  created_at: string;
};

export default async function ProShopPage() {
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
    return (
      <main className="p-10">
        Unable to determine your club.
      </main>
    );
  }

  const [
    membersResult,
    requestsResult,
  ] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id, full_name, first_name, last_name, member_number, bag_number"
      )
      .eq("club_id", profile.club_id)
      .order("last_name", {
        ascending: true,
      })
      .order("first_name", {
        ascending: true,
      }),

    supabase
      .from("pro_shop_requests")
      .select(`
        id,
        request_type,
        member_id,
        member_name_snapshot,
        member_number_snapshot,
        bag_number_snapshot,
        details,
        status,
        created_at
      `)
      .eq("club_id", profile.club_id)
      .eq("status", "ACTIVE")
      .order("created_at", {
        ascending: true,
      }),
  ]);

  if (membersResult.error) {
    console.error(
      "Pro Shop member load error:",
      membersResult.error
    );
  }

  if (requestsResult.error) {
    console.error(
      "Pro Shop request load error:",
      requestsResult.error
    );
  }

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="proshop" />

      <main className="mx-auto max-w-[1000px] px-4 py-6">
        <h1 className="mb-5 text-2xl font-bold tracking-tight">
          Pro Shop
        </h1>

        <ProShopRequestsManager
          initialMembers={
            (membersResult.data ?? []) as Member[]
          }
          initialRequests={
            (requestsResult.data ?? []) as RequestRow[]
          }
        />
      </main>
    </div>
  );
}
