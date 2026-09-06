import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import SettingsNav from "@/components/SettingsNav";
import AccountSettingsManager from "../../../components/AccountSettingsManager";

export default async function AccountSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
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
          <SettingsNav active="account" />

          <section className="min-w-0">
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--golfops-text)]">
                Account
              </h2>

              <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                Manage your GolfOps Live login and password.
              </p>
            </div>

            <AccountSettingsManager email={user.email ?? ""} />
          </section>
        </div>
      </main>
    </div>
  );
}
