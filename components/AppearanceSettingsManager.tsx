"use client";

import {
  useEffect,
  useState,
} from "react";

type ThemeName =
  | "navy"
  | "midnight"
  | "forest"
  | "slate"
  | "crimson"
  | "gold"
  | "light";

type AppearanceSettings = {
  theme?: ThemeName;
  placardDesign?:
    | "bold"
    | "clean";
  logoPath?: string;
  [key: string]: unknown;
};

const DEFAULTS:
  AppearanceSettings = {
    theme: "light",
    placardDesign: "bold",
    logoPath:
      "/twineagles-logo.png",
  };

const THEMES: Array<{
  value: ThemeName;
  label: string;
  description: string;
  previewClass: string;
}> = [
  {
    value: "navy",
    label: "Navy",
    description:
      "Classic dark blue operations theme.",
    previewClass:
      "bg-[#0f172a] border-[#334155] text-white",
  },
  {
    value: "midnight",
    label: "Midnight",
    description:
      "Near-black high contrast theme.",
    previewClass:
      "bg-[#09090b] border-[#27272a] text-white",
  },
  {
    value: "forest",
    label: "Forest",
    description:
      "Deep green private club theme.",
    previewClass:
      "bg-[#071a12] border-[#14532d] text-white",
  },
  {
    value: "slate",
    label: "Slate",
    description:
      "Cool blue-gray operations theme.",
    previewClass:
      "bg-[#172033] border-[#334155] text-white",
  },
  {
    value: "crimson",
    label: "Crimson",
    description:
      "Dark red accent theme.",
    previewClass:
      "bg-[#240d0d] border-[#7f1d1d] text-white",
  },
  {
    value: "gold",
    label: "Gold",
    description:
      "Dark theme with warm gold accents.",
    previewClass:
      "bg-[#1b1608] border-[#854d0e] text-white",
  },
  {
    value: "light",
    label: "Light",
    description:
      "Bright GolfOps Live operations theme.",
    previewClass:
      "bg-white border-slate-300 text-slate-900",
  },
];

function applyTheme(
  theme:
    | ThemeName
    | undefined
) {
  const resolvedTheme =
    theme ?? "light";

  document.documentElement.setAttribute(
    "data-theme",
    resolvedTheme
  );

  document.body.dataset.theme =
    resolvedTheme;
}

export default function AppearanceSettingsManager() {
  const [
    settings,
    setSettings,
  ] =
    useState<AppearanceSettings>(
      DEFAULTS
    );

  const [
    savedSettings,
    setSavedSettings,
  ] =
    useState<AppearanceSettings>(
      DEFAULTS
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    saved,
    setSaved,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    themeMessage,
    setThemeMessage,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    loadSettings();
  }, []);

  /*
    Keep the visible GolfOps theme synchronized with
    the selected Appearance card immediately.
    This also protects against another render restoring
    the previously loaded theme while the user is previewing.
  */
  useEffect(() => {
    if (!loading && settings.theme) {
      applyTheme(settings.theme);
    }
  }, [loading, settings.theme]);

  async function loadSettings() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/settings/club"
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to load appearance settings."
        );
      }

      const loaded = {
        ...DEFAULTS,
        ...(result.settings ??
          {}),
      };

      setSettings(
        loaded
      );

      setSavedSettings(
        loaded
      );

      applyTheme(
        loaded.theme
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load appearance settings."
      );
    } finally {
      setLoading(false);
    }
  }

  async function chooseTheme(
    theme: ThemeName
  ) {
    const previousTheme =
      savedSettings.theme ??
      "light";

    const nextSettings = {
      ...settings,
      theme,
    };

    setSettings(
      nextSettings
    );

    applyTheme(theme);

    setThemeMessage(null);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/settings/club",
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                theme,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save theme."
        );
      }

      const savedResult = {
        ...savedSettings,
        ...(result.settings ??
          {}),
        theme,
      };

      setSavedSettings(
        savedResult
      );

      setSettings(
        (current) => ({
          ...current,
          ...(result.settings ??
            {}),
          theme,
        })
      );

      const label =
        THEMES.find(
          (item) =>
            item.value === theme
        )?.label ??
        theme;

      setThemeMessage(
        `Appearance changed to ${label}`
      );

      window.setTimeout(
        () =>
          setThemeMessage(
            null
          ),
        2200
      );
    } catch (err) {
      applyTheme(
        previousTheme
      );

      setSettings(
        (current) => ({
          ...current,
          theme:
            previousTheme,
        })
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save theme."
      );
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/settings/club",
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                settings
              ),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save appearance settings."
        );
      }

      const savedResult = {
        ...settings,
        ...(result.settings ??
          {}),
      };

      setSettings(
        savedResult
      );

      setSavedSettings(
        savedResult
      );

      applyTheme(
        savedResult.theme
      );

      setSaved(true);

      window.setTimeout(
        () =>
          setSaved(false),
        2500
      );
    } catch (err) {
      /*
        If saving fails, return the UI
        to the last confirmed theme.
      */

      applyTheme(
        savedSettings.theme
      );

      setSettings(
        savedSettings
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save appearance settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        Loading appearance
        settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            Theme
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Choose the visual
            theme for GolfOps Live.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {THEMES.map(
              (theme) => {
                const active =
                  settings.theme ===
                  theme.value;

                return (
                  <button
                    key={
                      theme.value
                    }
                    type="button"
                    onClick={() => {
                      void chooseTheme(
                        theme.value
                      );
                    }}
                    className={[
                      "rounded-xl border-2 p-4 text-left transition",
                      theme.previewClass,
                      active
                        ? "ring-2 ring-indigo-500 ring-offset-2"
                        : "hover:opacity-90",
                    ].join(
                      " "
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold">
                        {
                          theme.label
                        }
                      </div>

                      {active && (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-xs opacity-70">
                      {
                        theme.description
                      }
                    </div>
                  </button>
                );
              }
            )}
          </div>

          <div className="mt-4 text-xs leading-5 text-slate-500">
            Choose a color theme for
            GolfOps Live. Your selection
            previews immediately. Click
            Change GolfOps Appearance
            to save the full Appearance
            settings.
          </div>

          {themeMessage && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              {themeMessage}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            Branding
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            TwinEagles Club
            branding used
            throughout GolfOps Live.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">
                Club Logo
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Used in GolfOps
                Live navigation and
                printed cart signs.
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
                <img
                  src={
                    settings.logoPath ||
                    "/twineagles-logo.png"
                  }
                  alt="TwinEagles Club logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="text-xs text-slate-500">
                Current logo

                <div className="mt-1 font-mono text-[11px] text-slate-400">
                  {
                    settings.logoPath ||
                    "/twineagles-logo.png"
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="text-sm font-bold text-slate-900">
              Logo Upload
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              The current
              TwinEagles logo is
              already installed.
              Secure logo
              upload/remove controls
              can be added when
              production file storage
              is connected.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            Cart Sign Appearance
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Choose the default
            visual design for
            printed cart signs.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  placardDesign:
                    "bold",
                })
              }
              className={[
                "rounded-xl border-2 p-5 text-left transition",
                settings.placardDesign ===
                "bold"
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              ].join(
                " "
              )}
            >
              <div className="text-lg font-black text-slate-950">
                Bold
              </div>

              <div className="mt-2 text-sm font-bold text-slate-800">
                SMITH / JONES
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Larger traditional
                cart-sign typography.
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  placardDesign:
                    "clean",
                })
              }
              className={[
                "rounded-xl border-2 p-5 text-left transition",
                settings.placardDesign ===
                "clean"
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              ].join(
                " "
              )}
            >
              <div className="text-lg font-semibold text-slate-950">
                Clean
              </div>

              <div className="mt-2 text-sm font-medium text-slate-700">
                Smith / Jones
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Modern, lighter
                cart-sign typography.
              </div>
            </button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 pb-8">
        {saved && (
          <span className="text-sm font-semibold text-green-600">
            Appearance saved
          </span>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={
            saveSettings
          }
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Change GolfOps Appearance"}
        </button>
      </div>
    </div>
  );
}
