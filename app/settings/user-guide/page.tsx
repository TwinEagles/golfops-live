import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import SettingsNav from "@/components/SettingsNav";

const CURRENT_VERSION = "1.1";
const CURRENT_DATE = "September 8, 2026";

export default async function UserGuideSettingsPage() {
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
    redirect("/settings/account");
  }

  return (
    <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]">
      <AppNav active="settings" />

      <header className="border-b border-[var(--golfops-border)] bg-[var(--golfops-nav)]">
        <div className="mx-auto max-w-7xl px-5 py-7">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
            Manage your account, club, appearance, tee sheet, and integrations.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <SettingsNav active="user-guide" />

          <section className="min-w-0">
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight">User Guide</h2>
              <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">
                Training, operating guidance, and documented GolfOps Live updates.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] shadow-sm">
              <div className="border-b border-[var(--golfops-border)] px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--golfops-accent)]">
                    Current Manual
                  </div>
                  <h3 className="mt-2 text-2xl font-bold">GolfOps Live New Staff Quick-Start Guide</h3>
                  <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">
                    Version {CURRENT_VERSION} · Updated {CURRENT_DATE}
                  </p>
                </div>

                <a
                  href="/api/user-guide/download"
                  className="mt-5 inline-flex items-center justify-center rounded-lg bg-[var(--golfops-accent)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 sm:mt-0"
                >
                  Download PDF
                </a>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <h3 className="text-lg font-bold">Included in version 1.1</h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--golfops-text-muted)]">
                    <li className="flex gap-3"><span className="text-[var(--golfops-accent)]">✓</span><span>Starter Display, Displays navigation, and Starter permissions</span></li>
                    <li className="flex gap-3"><span className="text-[var(--golfops-accent)]">✓</span><span>Perry Weather on Starter and Operations</span></li>
                    <li className="flex gap-3"><span className="text-[var(--golfops-accent)]">✓</span><span>SchedulePop staffing and Outside Operations checklists and handoffs</span></li>
                    <li className="flex gap-3"><span className="text-[var(--golfops-accent)]">✓</span><span>ForeTees Admin bag-slot synchronization with Bag Finder</span></li>
                    <li className="flex gap-3"><span className="text-[var(--golfops-accent)]">✓</span><span>Updated Tee Sheet, cart assignment, cart sign, and extension 1.2.1 guidance</span></li>
                  </ul>
                </div>

                <aside className="rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface-soft)] p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--golfops-text-dim)]">Document Details</div>
                  <dl className="mt-4 space-y-4 text-sm">
                    <div><dt className="text-[var(--golfops-text-muted)]">Owner</dt><dd className="mt-1 font-semibold">Director of Golf</dd></div>
                    <div><dt className="text-[var(--golfops-text-muted)]">Format</dt><dd className="mt-1 font-semibold">PDF · 11 pages</dd></div>
                    <div><dt className="text-[var(--golfops-text-muted)]">Audience</dt><dd className="mt-1 font-semibold">Golf TEAM</dd></div>
                  </dl>
                </aside>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] p-6 shadow-sm">
              <h3 className="text-lg font-bold">Manual Version History</h3>

              <div className="mt-5 space-y-5">
                <article className="border-l-4 border-[var(--golfops-accent)] pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold">Version 1.1</h4>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">Current</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">September 8, 2026</p>
                  <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">Added current display, weather, staffing, Outside Operations, Bag Finder synchronization, Tee Sheet, and extension workflows.</p>
                </article>

                <article className="border-l-4 border-[var(--golfops-border)] pl-4">
                  <h4 className="font-bold">Version 1.0</h4>
                  <p className="mt-1 text-sm text-[var(--golfops-text-muted)]">September 6, 2026</p>
                  <p className="mt-2 text-sm text-[var(--golfops-text-muted)]">Initial GolfOps Live new-staff quick-start guide.</p>
                </article>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
