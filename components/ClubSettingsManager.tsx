"use client";

import { useEffect, useState } from "react";

type ClubSettings = {
  placardDesign: "bold" | "clean";
  cutAndStack: boolean;
  holeOrder: "1-18" | "18-1";
  showPlayedTodayStar?: boolean;
  showClearedChanges?: boolean;
  clearedChangesRetentionDays?: number;
  showPreloadBagStar?: boolean;
  cleanUpNames?: boolean;
  cleanupLabels?: string[];
  cleanupTags?: string[];
  customCleanupRules?: Array<{
    value: string;
    mode: "start" | "anywhere";
    enabled: boolean;
  }>;
  [key: string]: unknown;
};

const DEFAULT_SETTINGS: ClubSettings = {
  placardDesign: "bold",
  cutAndStack: true,
  holeOrder: "1-18",
};

export default function ClubSettingsManager() {
  const [settings, setSettings] =
    useState<ClubSettings>(DEFAULT_SETTINGS);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch("/api/settings/club");

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to load settings."
        );
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...(result.settings ?? {}),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load settings."
      );
    } finally {
      setLoading(false);
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
              JSON.stringify(settings),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save settings."
        );
      }

      setSettings({
        ...settings,
        ...(result.settings ?? {}),
      });

      setSaved(true);

      window.setTimeout(
        () => setSaved(false),
        2500
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        Loading settings...
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
            Cart Signs
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Default settings when printing cart placards.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          <SettingRow
            title="Default Design"
            description="Choose the initial cart sign design."
          >
            <select
              value={settings.placardDesign}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  placardDesign:
                    event.target.value as
                      | "bold"
                      | "clean",
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="bold">
                Bold
              </option>

              <option value="clean">
                Clean
              </option>
            </select>
          </SettingRow>

          <SettingRow
            title="Cut & Stack"
            description="Automatically enable Cut & Stack when opening cart signs."
          >
            <Toggle
              enabled={settings.cutAndStack}
              onChange={(enabled) =>
                setSettings({
                  ...settings,
                  cutAndStack: enabled,
                })
              }
            />
          </SettingRow>

          <SettingRow
            title="Default Hole Order"
            description="Choose how cart signs are initially ordered."
          >
            <select
              value={settings.holeOrder}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  holeOrder:
                    event.target.value as
                      | "1-18"
                      | "18-1",
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="1-18">
                1 → 18
              </option>

              <option value="18-1">
                18 → 1
              </option>
            </select>
          </SettingRow>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm font-semibold text-green-600">
            Settings saved
          </span>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={saveSettings}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-5">
      <div>
        <div className="text-sm font-bold text-slate-900">
          {title}
        </div>

        <div className="mt-1 text-xs text-slate-500">
          {description}
        </div>
      </div>

      <div className="shrink-0">
        {children}
      </div>
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (
    enabled: boolean
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(!enabled)
      }
      className={`relative h-7 w-12 rounded-full transition ${
        enabled
          ? "bg-indigo-600"
          : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
          enabled
            ? "left-6"
            : "left-1"
        }`}
      />
    </button>
  );
}
