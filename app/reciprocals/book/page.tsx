import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import ReciprocalBookingForm from "../../../components/ReciprocalBookingForm";

export default async function BookReciprocalPage() {
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
    return <main className="p-10">Unable to determine your club.</main>;
  }

  const [{ data: members, error: membersError }, { data: clubs, error: clubsError }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, full_name, first_name, last_name, member_number, bag_number")
        .eq("club_id", profile.club_id)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }),

      supabase
        .from("reciprocal_clubs")
        .select("id, name, advance_days, courses, notes, member_fee_summary, guest_fee_summary")
        .eq("club_id", profile.club_id)
        .eq("active", true)
        .order("name", { ascending: true }),
    ]);

  if (membersError) {
    console.error("Reciprocal member load error:", membersError);
  }

  if (clubsError) {
    console.error("Reciprocal club load error:", clubsError);
  }

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="proshop" />
      <ReciprocalBookingForm members={members ?? []} clubs={clubs ?? []} />
    </div>
  );
}
