import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGolfOpsAccess } from "@/lib/permissions";

type AppNavProps = {
  active:
    | "tee-sheet"
    | "tv"
    | "changes"
    | "pro-shop"
    | "upload"
    | "bag-finder"
    | "golf-carts"
    | "proshop"
    | "settings";

  selectedDate?: string;
};

function todayString() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export default async function AppNav({
  active,
  selectedDate,
}: AppNavProps) {
  const access = await getGolfOpsAccess();

  const canTeeSheet =
    access?.isAdmin ||
    access?.permissions.tee_sheet === true;

  const canTv =
    access?.isAdmin ||
    access?.permissions.tv === true;

  const canChanges =
    access?.isAdmin ||
    access?.permissions.changes === true;

  const canProShop =
    access?.isAdmin ||
    access?.permissions.pro_shop === true;

  const canReciprocals =
    access?.isAdmin ||
    access?.permissions.reciprocals === true;

  const canBagFinder =
    access?.isAdmin ||
    access?.permissions.bag_finder === true;

  const canGolfCarts =
    access?.isAdmin ||
    access?.permissions.golf_carts === true;

  /*
    Upload is part of Tee Sheet access.
    Staff who can manage the tee sheet can
    also use the ForeTees import workflow.
  */
  const canUpload = canTeeSheet;

  const datedSuffix =
    selectedDate
      ? `?date=${selectedDate}`
      : "";

  const homeHref =
    canTeeSheet
      ? `/dashboard${datedSuffix}`
      : canTv
        ? `/tv${datedSuffix}`
        : canChanges
          ? `/changes${datedSuffix}`
          : canProShop
            ? "/proshop"
            : canReciprocals
              ? "/reciprocals"
              : canBagFinder
                ? "/bagfinder"
                : canGolfCarts
                  ? "/carts"
                  : "/settings/account";

  let changeCount = 0;

  if (
    access?.clubId &&
    canChanges
  ) {
    const supabase =
      await createClient();

    let badgeDate =
      selectedDate ?? null;

    if (!badgeDate) {
      const {
        data: latestOpenChange,
      } =
        await supabase
          .from("tee_sheet_changes")
          .select("sheet_date")
          .eq(
            "club_id",
            access.clubId
          )
          .eq(
            "status",
            "OPEN"
          )
          .gte(
            "sheet_date",
            todayString()
          )
          .order(
            "sheet_date",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

      badgeDate =
        latestOpenChange?.sheet_date ??
        null;
    }

    if (badgeDate) {
      const { count } =
        await supabase
          .from("tee_sheet_changes")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "club_id",
            access.clubId
          )
          .eq(
            "sheet_date",
            badgeDate
          )
          .eq(
            "status",
            "OPEN"
          );

      changeCount =
        count ?? 0;
    }
  }

  function navClass(
    name: AppNavProps["active"]
  ) {
    if (active === name) {
      return "rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white";
    }

    return "rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-100";
  }

  const proShopActive =
    active === "pro-shop" ||
    active === "proshop";

  const proShopClass =
    proShopActive
      ? "rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white"
      : "rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-100";

  async function signOut() {
    "use server";

    const supabase =
      await createClient();

    await supabase.auth.signOut();

    redirect("/");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4">
        {/* BRAND */}

        <Link
          href={homeHref}
          className="flex shrink-0 items-center gap-3 py-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
            TE
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              GolfOps Live
            </h1>

            <p className="text-[11px] text-slate-400">
              TwinEagles Club
            </p>
          </div>
        </Link>

        {/* NAVIGATION */}

        <div className="flex min-w-0 items-center gap-2">
          <nav className="flex items-center gap-1 text-sm">
            {canTeeSheet && (
              <Link
                href={`/dashboard${datedSuffix}`}
                className={navClass(
                  "tee-sheet"
                )}
              >
                Tee Sheet
              </Link>
            )}

            {canTv && (
              <Link
                href={`/tv${datedSuffix}`}
                className={navClass(
                  "tv"
                )}
              >
                TV
              </Link>
            )}

            {canChanges && (
              <Link
                href={`/changes${datedSuffix}`}
                className={[
                  navClass(
                    "changes"
                  ),
                  "flex items-center gap-2",
                ].join(" ")}
              >
                <span>
                  Changes
                </span>

                {changeCount > 0 && (
                  <span
                    className={[
                      "flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",

                      active ===
                      "changes"
                        ? "bg-white text-indigo-600"
                        : "bg-red-500 text-white",
                    ].join(" ")}
                  >
                    {changeCount >
                    99
                      ? "99+"
                      : changeCount}
                  </span>
                )}
              </Link>
            )}

            {/* PRO SHOP + RECIPROCALS */}

            {canProShop && (
              <div className="group relative">
                <Link
                  href="/proshop"
                  className={[
                    proShopClass,
                    "flex items-center gap-1.5",
                  ].join(" ")}
                  aria-haspopup={
                    canReciprocals
                      ? "true"
                      : undefined
                  }
                >
                  <span>
                    Pro Shop
                  </span>

                  {canReciprocals && (
                    <svg
                      className="h-3 w-3 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </Link>

                {canReciprocals && (
                  <div className="invisible absolute left-0 top-full z-50 min-w-[170px] pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      <Link
                        href="/reciprocals"
                        className="block px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                      >
                        Reciprocals
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!canProShop &&
              canReciprocals && (
                <Link
                  href="/reciprocals"
                  className={navClass(
                    "proshop"
                  )}
                >
                  Reciprocals
                </Link>
              )}

            {canUpload && (
              <Link
                href="/upload"
                className={navClass(
                  "upload"
                )}
              >
                Upload
              </Link>
            )}

            {canBagFinder && (
              <Link
                href="/bagfinder"
                className={navClass(
                  "bag-finder"
                )}
              >
                Bag Finder
              </Link>
            )}

            {canGolfCarts && (
              <Link
                href="/carts"
                className={navClass(
                  "golf-carts"
                )}
              >
                Golf Carts
              </Link>
            )}

            <Link
              href="/settings/account"
              className={navClass(
                "settings"
              )}
            >
              Settings
            </Link>
          </nav>

          <form
            action={signOut}
            className="shrink-0"
          >
            <button
              type="submit"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
            >
              Log Out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
