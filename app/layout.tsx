import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ALLOWED_THEMES = new Set([
  "light",
  "navy",
  "midnight",
  "forest",
  "slate",
  "crimson",
  "gold",
]);

export const metadata: Metadata = {
  title: "GolfOps Live",
  description:
    "Golf operations management for The TwinEagles Club.",
};

async function getSavedTheme() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return "light";
    }

    const {
      data: profile,
    } =
      await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .maybeSingle();

    if (!profile?.club_id) {
      return "light";
    }

    const {
      data: settingsRow,
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
      settingsRow?.settings;

    if (
      !settings ||
      typeof settings !==
        "object"
    ) {
      return "light";
    }

    const theme =
      (
        settings as
          Record<
            string,
            unknown
          >
      ).theme;

    return (
      typeof theme ===
        "string" &&
      ALLOWED_THEMES.has(theme)
    )
      ? theme
      : "light";
  } catch (error) {
    console.error(
      "Unable to load GolfOps Live theme:",
      error
    );

    return "light";
  }
}

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const theme =
    await getSavedTheme();

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
