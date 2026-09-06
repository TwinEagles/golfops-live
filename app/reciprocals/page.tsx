import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import ReciprocalsManager from "@/components/ReciprocalsManager";

export default async function ReciprocalsPage() {
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

  const { data: requests, error } =
    await supabase
      .from("reciprocal_requests")
      .select(`
        id,
        member_id,
        member_name,
        member_number,
        member_email,
        member_phone,
        reciprocal_club_id,
        course_choice_text,
        course_alternates,
        preferred_date,
        preferred_time,
        time_range,
        number_of_players,
        group_members,
        status,
        call_due_at,
                call_notes,
        confirmation_number,
        decline_reason,
        source,
        created_at,
        updated_at,
        course_pick,
        confirmed_tee_time,
        staff_initials,
        reciprocal_club:reciprocal_clubs (
          id,
          name,
          address,
          phone,
          contact_person,
          advance_days,
          member_fee_summary,
          guest_fee_summary,
          payment_methods,
          notes,
          courses,
          closures
        )
      `)
      .eq("club_id", profile.club_id)
      .order("call_due_at", {
        ascending: true,
        nullsFirst: false,
      })
      .order("preferred_date", {
        ascending: true,
      });

  if (error) {
    console.error(
      "Reciprocals load error:",
      error
    );
  }

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="proshop" />

      <ReciprocalsManager
        initialRequests={
          requests ?? []
        }
      />
    </div>
  );
}
