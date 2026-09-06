import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import SettingsNav from "@/components/SettingsNav";
import ClubSettingsManager from "@/components/ClubSettingsManager";

export default async function ClubSettingsPage() {
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

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="settings" />

      <header className="border-b border-[var(--golfops-border)] bg-[var(--golfops-nav)]">
        <div className="mx-auto max-w-7xl px-5 py-7">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--golfops-text)]">
            Settings
          </h1>

          <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
            Manage your account, club, appearance, tee sheet, and integrations.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <SettingsNav active="club" />

          <section className="min-w-0">
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--golfops-text)]">
                Club
              </h2>

              <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                Manage TwinEagles Club operational defaults.
              </p>
            </div>

            <ClubSettingsManager />
          </section>
        </div>
      </main>
    </div>
  );
}