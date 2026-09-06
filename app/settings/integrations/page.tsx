import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import SettingsNav from "@/components/SettingsNav";
import IntegrationsManager from "../../../components/IntegrationsManager";

export default async function IntegrationsSettingsPage() {
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
          <SettingsNav active="integrations" />

          <section className="min-w-0">
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--golfops-text)]">
                Integrations
              </h2>

              <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                Connect GolfOps Live with the tools used by the Golf TEAM.
              </p>
            </div>

            <IntegrationsManager />
          </section>
        </div>
      </main>
    </div>
  );
}
