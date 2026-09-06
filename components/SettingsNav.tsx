import Link from "next/link";
import { getGolfOpsAccess } from "@/lib/permissions";

type SettingsNavProps = {
  active:
    | "account"
    | "club"
    | "appearance"
    | "members"
    | "users"
    | "tee-sheet"
    | "integrations";
};

const userItems = [
  {
    key: "account",
    label: "Account",
    href: "/settings/account",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19a6 6 0 00-12 0m9-10a4 4 0 11-8 0 4 4 0 018 0Z"
        />
      </svg>
    ),
  },
  {
    key: "appearance",
    label: "Appearance",
    href: "/settings/appearance",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3a9 9 0 100 18h1.5a2.5 2.5 0 000-5H12a1.5 1.5 0 010-3h3a6 6 0 000-12h-3Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 9h.01M9.5 6.5h.01M14.5 6.5h.01"
        />
      </svg>
    ),
  },
  {
    key: "integrations",
    label: "Integrations",
    href: "/settings/integrations",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 13.5l3-3m-6.75 6.75l-1.5 1.5a3.182 3.182 0 11-4.5-4.5l3-3a3.182 3.182 0 014.5 0m9-4.5l1.5-1.5a3.182 3.182 0 114.5 4.5l-3 3a3.182 3.182 0 01-4.5 0"
        />
      </svg>
    ),
  },
] as const;

const adminItems = [
  {
    key: "club",
    label: "Club",
    href: "/settings/club",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 21h18M5 21V9l7-5 7 5v12M8 13h8M8 17h8"
        />
      </svg>
    ),
  },
  {
    key: "members",
    label: "Members",
    href: "/settings/members",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8Zm13 10v-2a4 4 0 00-3-3.87m-2-11.96a4 4 0 010 7.75"
        />
      </svg>
    ),
  },
  {
    key: "users",
    label: "Users",
    href: "/settings/users",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19a6 6 0 00-12 0m9-10a4 4 0 11-8 0 4 4 0 018 0Zm4-1v6m3-3h-6"
        />
      </svg>
    ),
  },
  {
    key: "tee-sheet",
    label: "Tee Sheet",
    href: "/settings/tee-sheet",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 13h2m4 0h2m-8 4h2m4 0h2"
        />
      </svg>
    ),
  },
] as const;

export default async function SettingsNav({
  active,
}: SettingsNavProps) {
  const access =
    await getGolfOpsAccess();

  const items =
    access?.isAdmin
      ? [
          userItems[0],
          adminItems[0],
          userItems[1],
          adminItems[1],
          adminItems[2],
          adminItems[3],
          userItems[2],
        ]
      : userItems;

  return (
    <aside>
      <nav className="space-y-2">
        {items.map((item) => {
          const isActive =
            active === item.key;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-xl border-l-4 px-4 py-3 text-sm font-semibold transition",
                isActive
                  ? "border-[var(--golfops-accent)] bg-[var(--golfops-surface-soft)] text-[var(--golfops-text)]"
                  : "border-transparent text-[var(--golfops-text-muted)] hover:bg-[var(--golfops-surface-soft)] hover:text-[var(--golfops-text)]",
              ].join(" ")}
            >
              <span
                className={
                  isActive
                    ? "text-[var(--golfops-accent)]"
                    : "text-[var(--golfops-text-dim)]"
                }
              >
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
