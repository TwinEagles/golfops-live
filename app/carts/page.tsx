import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasGolfOpsPermission } from "@/lib/permissions";
import AppNav from "@/components/AppNav";
import GolfCartsManager from "../../components/GolfCartsManager";

export default async function GolfCartsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const allowed =
    await hasGolfOpsPermission(
      "golf_carts"
    );

  if (!allowed) {
    redirect(
      "/settings/account"
    );
  }

  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

  if (!profile?.club_id) {
    redirect(
      "/settings/account"
    );
  }

  const {
    data: carts,
  } =
    await supabase
      .from("golf_carts")
      .select(`
        id,
        cart_number,
        status,
        notes
      `)
      .eq(
        "club_id",
        profile.club_id
      )
      .order(
        "cart_number"
      );

  const {
    data: cleaningHistory,
  } =
    await supabase
      .from(
        "cart_cleaning_history"
      )
      .select(`
        id,
        cart_id,
        cleaned_by,
        notes,
        cleaned_at
      `)
      .eq(
        "club_id",
        profile.club_id
      )
      .order(
        "cleaned_at",
        {
          ascending: false,
        }
      );

  const {
    data: damageHistory,
  } =
    await supabase
      .from("cart_damage")
      .select(`
        id,
        cart_id,
        description,
        reported_by,
        reported_at,
        resolved_at,
        resolved_by,
        resolution_notes
      `)
      .eq(
        "club_id",
        profile.club_id
      )
      .order(
        "reported_at",
        {
          ascending: false,
        }
      );

  const {
    data: operationalSettings,
  } =
    await supabase
      .from(
        "club_operational_settings"
      )
      .select("settings")
      .eq(
        "club_id",
        profile.club_id
      )
      .maybeSingle();

  const settings =
    operationalSettings?.settings &&
    typeof operationalSettings.settings ===
      "object"
      ? operationalSettings.settings
      : {};

  const detailingDays =
    typeof settings.cartDetailingDays ===
      "number"
      ? settings.cartDetailingDays
      : 30;

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <AppNav active="golf-carts" />

      <GolfCartsManager
        initialCarts={
          carts ?? []
        }
        cleaningHistory={
          cleaningHistory ?? []
        }
        damageHistory={
          damageHistory ?? []
        }
        initialDetailingDays={
          detailingDays
        }
      />
    </div>
  );
}