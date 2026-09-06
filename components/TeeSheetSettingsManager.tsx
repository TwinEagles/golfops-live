"use client";

import { useEffect, useMemo, useState } from "react";

type CustomRule = {
  value: string;
  mode: "start" | "anywhere";
  enabled: boolean;
};

type TeeSheetSettings = {
  showPlayedTodayStar?: boolean;
  cleanUpNames?: boolean;
  cleanupLabels?: string[];
  cleanupTags?: string[];
  customCleanupRules?: CustomRule[];
  showClearedChanges?: boolean;
  clearedChangesRetentionDays?: number;
  [key: string]: unknown;
};

const DEFAULT_LABELS = [
  "Talon",
  "Eagle",
  "PGA/Industry",
  "PGA Golf Pass",
  "PGA",
  "Event Guest",
  "Fam Guest",
  "Recip Guest",
  "Reciprocal",
  "Recip",
  "Guest",
  "Staff",
  "Member",
  "Outing",
];

const DEFAULT_TAGS = [
  "SPT",
  "RNT",
  "SOC",
  "PGM",
  "JPGA",
  "BBE",
];

const DEFAULTS: TeeSheetSettings = {
  showPlayedTodayStar: true,
  cleanUpNames: true,
  cleanupLabels: DEFAULT_LABELS,
  cleanupTags: DEFAULT_TAGS,
  customCleanupRules: [],
  showClearedChanges: false,
  clearedChangesRetentionDays: 30,
};

export default function TeeSheetSettingsManager() {
  const [settings, setSettings] =
    useState<TeeSheetSettings>(DEFAULTS);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [customValue, setCustomValue] =
    useState("");

  const [customMode, setCustomMode] =
    useState<"start" | "anywhere">("start");

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
        ...DEFAULTS,
        ...(result.settings ?? {}),
        cleanupLabels:
          Array.isArray(
            result.settings?.cleanupLabels
          )
            ? result.settings.cleanupLabels
            : DEFAULT_LABELS,
        cleanupTags:
          Array.isArray(
            result.settings?.cleanupTags
          )
            ? result.settings.cleanupTags
            : DEFAULT_TAGS,
        customCleanupRules:
          Array.isArray(
            result.settings?.customCleanupRules
          )
            ? result.settings.customCleanupRules
            : [],
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
        await fetch("/api/settings/club", {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify(settings),
        });

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

  const cleanupLabels =
    useMemo(
      () =>
        Array.isArray(
          settings.cleanupLabels
        )
          ? settings.cleanupLabels
          : [],
      [settings.cleanupLabels]
    );

  const cleanupTags =
    useMemo(
      () =>
        Array.isArray(
          settings.cleanupTags
        )
          ? settings.cleanupTags
          : [],
      [settings.cleanupTags]
    );

  const customRules =
    useMemo(
      () =>
        Array.isArray(
          settings.customCleanupRules
        )
          ? settings.customCleanupRules
          : [],
      [settings.customCleanupRules]
    );

  function toggleLabel(value: string) {
    setSettings({
      ...settings,
      cleanupLabels:
        cleanupLabels.includes(value)
          ? cleanupLabels.filter(
              (item) => item !== value
            )
          : [
              ...cleanupLabels,
              value,
            ],
    });
  }

  function toggleTag(value: string) {
    setSettings({
      ...settings,
      cleanupTags:
        cleanupTags.includes(value)
          ? cleanupTags.filter(
              (item) => item !== value
            )
          : [
              ...cleanupTags,
              value,
            ],
    });
  }

  function addCustomRule() {
    const value =
      customValue.trim();

    if (!value) {
      return;
    }

    const exists =
      customRules.some(
        (rule) =>
          rule.value.toLowerCase() ===
            value.toLowerCase() &&
          rule.mode === customMode
      );

    if (exists) {
      setCustomValue("");
      return;
    }

    setSettings({
      ...settings,
      customCleanupRules: [
        ...customRules,
        {
          value,
          mode: customMode,
          enabled: true,
        },
      ],
    });

    setCustomValue("");
  }

  function toggleCustomRule(index: number) {
    setSettings({
      ...settings,
      customCleanupRules:
        customRules.map(
          (rule, ruleIndex) =>
            ruleIndex === index
              ? {
                  ...rule,
                  enabled:
                    !rule.enabled,
                }
              : rule
        ),
    });
  }

  function removeCustomRule(index: number) {
    setSettings({
      ...settings,
      customCleanupRules:
        customRules.filter(
          (_, ruleIndex) =>
            ruleIndex !== index
        ),
    });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        Loading tee sheet settings...
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

      <Section
        title="Tee Sheet Display"
        description="Control operational indicators shown to the Golf TEAM."
      >
        <SettingRow
          title="Playing Today Star"
          description="Show a star on a future tee sheet when that golfer also appears on today's tee sheet."
        >
          <Toggle
            enabled={
              settings.showPlayedTodayStar !==
              false
            }
            onChange={(enabled) =>
              setSettings({
                ...settings,
                showPlayedTodayStar:
                  enabled,
              })
            }
          />
        </SettingRow>
      </Section>

      <Section
        title="Cart Sign Name Cleanup"
        description="Clean up ForeTees names and labels before they appear on printed cart signs."
      >
        <SettingRow
          title="Clean Up Names"
          description="Turn ForeTees labels and short tags into cleaner player names."
        >
          <Toggle
            enabled={
              settings.cleanUpNames !==
              false
            }
            onChange={(enabled) =>
              setSettings({
                ...settings,
                cleanUpNames:
                  enabled,
              })
            }
          />
        </SettingRow>

        <div className="px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Labels — Start of a Name
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Enabled labels are removed from the start of a ForeTees name before printing.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEFAULT_LABELS.map(
              (label) => (
                <RuleCard
                  key={label}
                  label={label}
                  enabled={
                    cleanupLabels.includes(
                      label
                    )
                  }
                  onToggle={() =>
                    toggleLabel(label)
                  }
                />
              )
            )}
          </div>

          <div className="mt-7 text-xs font-bold uppercase tracking-wide text-slate-400">
            Tags — Removed Anywhere
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Enabled short codes are removed anywhere in the name.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEFAULT_TAGS.map(
              (tag) => (
                <RuleCard
                  key={tag}
                  label={tag}
                  enabled={
                    cleanupTags.includes(
                      tag
                    )
                  }
                  onToggle={() =>
                    toggleTag(tag)
                  }
                />
              )
            )}
          </div>

          <div className="mt-7 text-xs font-bold uppercase tracking-wide text-slate-400">
            Add Your Own
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={customValue}
              onChange={(event) =>
                setCustomValue(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  event.preventDefault();
                  addCustomRule();
                }
              }}
              placeholder="Word or code..."
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

            <div className="flex rounded-lg border border-slate-300 bg-white p-1">
              <button
                type="button"
                onClick={() =>
                  setCustomMode("start")
                }
                className={[
                  "rounded-md px-3 py-1.5 text-xs font-bold",
                  customMode === "start"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600",
                ].join(" ")}
              >
                Start
              </button>

              <button
                type="button"
                onClick={() =>
                  setCustomMode(
                    "anywhere"
                  )
                }
                className={[
                  "rounded-md px-3 py-1.5 text-xs font-bold",
                  customMode ===
                  "anywhere"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600",
                ].join(" ")}
              >
                Anywhere
              </button>
            </div>

            <button
              type="button"
              onClick={addCustomRule}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
            >
              Add
            </button>
          </div>

          {customRules.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {customRules.map(
                (rule, index) => (
                  <div
                    key={`${rule.value}-${rule.mode}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">
                        {rule.value}
                      </div>

                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {rule.mode ===
                        "start"
                          ? "Start of name"
                          : "Anywhere"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Toggle
                        enabled={
                          rule.enabled
                        }
                        onChange={() =>
                          toggleCustomRule(
                            index
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeCustomRule(
                            index
                          )
                        }
                        className="text-lg leading-none text-slate-400 hover:text-red-500"
                        aria-label={`Remove ${rule.value}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Changes"
        description="Set defaults for cleared changes and change-history cleanup."
      >
        <SettingRow
          title="Show Cleared Changes"
          description="Show cleared changes by default when opening the Changes page."
        >
          <Toggle
            enabled={
              settings.showClearedChanges ===
              true
            }
            onChange={(enabled) =>
              setSettings({
                ...settings,
                showClearedChanges:
                  enabled,
              })
            }
          />
        </SettingRow>

        <SettingRow
          title="Cleared Change History"
          description="How long cleared changes should remain available before cleanup."
        >
          <select
            value={
              settings.clearedChangesRetentionDays ??
              30
            }
            onChange={(event) =>
              setSettings({
                ...settings,
                clearedChangesRetentionDays:
                  Number(
                    event.target.value
                  ),
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
          </select>
        </SettingRow>
      </Section>

      <div className="flex items-center justify-end gap-3 pb-8">
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <h3 className="font-bold text-slate-900">
          {title}
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {children}
      </div>
    </section>
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

function RuleCard({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-sm font-bold text-slate-800">
        {label}
      </span>

      <Toggle
        enabled={enabled}
        onChange={onToggle}
      />
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
