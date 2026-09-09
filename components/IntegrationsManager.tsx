"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

const DEFAULT_SOURCE =
  "TwinEagles iPhone";

const EXTENSION_VERSION =
  "1.3.3";

const EXTENSION_RELEASE_DATE =
  "September 9, 2026";

const extensionApplications = [
  {
    name: "ForeTees",
    description:
      "Imports tee sheets and lesson schedules into GolfOps Live.",
    workflows: [
      "Tee sheet imports",
      "Lesson imports",
      "Day-of change monitoring",
    ],
  },
  {
    name: "ForeTees Admin",
    description:
      "Synchronizes saved member bag-slot changes with Bag Finder.",
    workflows: [
      "Bag Finder updates",
    ],
  },
  {
    name: "SchedulePop",
    description:
      "Imports printable staffing schedules for Staff Schedule and Operations.",
    workflows: [
      "Staff schedule imports",
    ],
  },
  {
    name: "PACE / Textron GPS",
    description:
      "Synchronizes current cart and pace-of-play status for the live Tee Sheet.",
    workflows: [
      "Live cart pace synchronization",
    ],
  },
];

const releaseHistory = [
  {
    version: "1.3.3",
    date: "September 9, 2026",
    current: true,
    highlights: [
      "Captures the starter-entered PACE cart label, such as 21 Kovach, with each live cart-status update.",
      "Automatically fills a missing cart number when the PACE label uniquely matches one pairing on today's tee sheet.",
      "Never replaces an existing GolfOps cart assignment and skips ambiguous or conflicting matches.",
      "Adds each automatic PACE cart assignment to GolfOps Changes and the TV display.",
    ],
  },
  {
    version: "1.3.2",
    date: "September 9, 2026",
    current: false,
    highlights: [
      "Monitors today's normal live ForeTees tee sheet; staff do not need to keep a Print/Report page open.",
      "Uses the authenticated -ALL- Bag Report link embedded in the live sheet to check for updates once per minute.",
      "Routes detected additions, removals, replacements, time changes, and starting-hole changes into GolfOps Changes and the TV display.",
      "Sends a new snapshot only when the underlying tee-sheet rows change.",
      "Preserves GolfOps cart assignments, check-ins, and manual tee-sheet overrides during monitored updates.",
    ],
  },
  {
    version: "1.3.1",
    date: "September 9, 2026",
    current: false,
    highlights: [
      "Introduced day-of ForeTees change monitoring and mobile Tee Sheet pace formatting.",
      "Superseded by version 1.3.2, which monitors the normal live ForeTees tee sheet.",
    ],
  },
  {
    version: "1.3.0",
    date: "September 8, 2026",
    current: false,
    highlights: [
      "Added PACE / Textron GPS cart-status synchronization.",
      "Updates GolfOps Live approximately once per minute while the authenticated PACE page is open.",
      "Powers live hole, pace status, estimated finish, and feed-freshness information on today's Tee Sheet.",
      "Limits captured PACE information to operational cart status; coordinates and device identifiers are not stored.",
    ],
  },
  {
    version: "1.2.1",
    date: "September 8, 2026",
    current: false,
    highlights: [
      "Added ForeTees Admin bag-slot synchronization with Bag Finder.",
      "Supports member lists opened by last-name letter or View All.",
      "Sends an updated bag number after Save and Close and confirms the GolfOps update on screen.",
      "Retains ForeTees tee sheet, lesson, and SchedulePop staffing imports.",
    ],
  },
];

export default function IntegrationsManager() {
  const [
    sourceLabel,
    setSourceLabel,
  ] = useState(
    DEFAULT_SOURCE
  );

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    showChromeGuide,
    setShowChromeGuide,
  ] = useState(false);

  const [
    showBookmarkletGuide,
    setShowBookmarkletGuide,
  ] = useState(true);

  useEffect(() => {
    const saved =
      window.localStorage.getItem(
        "golfops-bookmarklet-source"
      );

    if (saved) {
      setSourceLabel(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "golfops-bookmarklet-source",
      sourceLabel
    );
  }, [sourceLabel]);

  /*
    The mobile bookmarklet UI is ready here.

    The actual ForeTees-to-GolfOps Live send
    endpoint should be wired to the same import
    pipeline used by the Chrome extension before
    this bookmarklet is put into staff production.
  */

  const bookmarkletCode =
    useMemo(() => {
      const source =
        sourceLabel.trim() ||
        DEFAULT_SOURCE;

      return [
        "javascript:(()=>{",
        `const source=${JSON.stringify(
          source
        )};`,
        'alert("GolfOps Live mobile import is ready for final connection. Source: "+source);',
        "})();",
      ].join("");
    }, [sourceLabel]);

  async function copyBookmarklet() {
    await navigator.clipboard.writeText(
      bookmarkletCode
    );

    setCopied(true);

    window.setTimeout(
      () =>
        setCopied(false),
      2000
    );
  }

  return (
    <div className="space-y-6">
      {/* CHROME EXTENSION */}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-5 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl">
              🧩
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-950">
                  Chrome Extension
                </h2>

                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                  Version{" "}
                  {EXTENSION_VERSION}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Import ForeTees tee sheets and lessons, monitor day-of tee-sheet changes, synchronize ForeTees Admin bag slots, send SchedulePop staffing, and connect live PACE cart status to GolfOps Live.
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
            Recommended
          </span>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-950">
                  Applications and automated workflows
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  One extension connects four applications and six GolfOps workflows.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                4 applications · 6 workflows
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {extensionApplications.map((application) => (
                <article
                  key={application.name}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-slate-950">
                      {application.name}
                    </h4>

                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      Active
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {application.description}
                  </p>

                  <ul className="mt-3 space-y-2">
                    {application.workflows.map((workflow) => (
                      <li
                        key={workflow}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs text-indigo-700">
                          ✓
                        </span>

                        <span>{workflow}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
                  Current Release
                </div>

                <h3 className="mt-1 text-lg font-bold text-slate-950">
                  Version {EXTENSION_VERSION}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Released {EXTENSION_RELEASE_DATE}
                </p>
              </div>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm">
                Latest Version
              </span>
            </div>

            <div className="mt-4">
              <div className="text-sm font-bold text-slate-900">
                What&apos;s new
              </div>

              <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-600 lg:grid-cols-2">
                {releaseHistory[0].highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex gap-2"
                  >
                    <span className="font-bold text-indigo-600">•</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Desktop setup
                </h3>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Install version{" "}
                  {EXTENSION_VERSION},
                  sign in with your
                  GolfOps Live account,
                  and use the extension
                  with ForeTees,
                  ForeTees Admin, and
                  SchedulePop. On the
                  ForeTees workstation,
                  keep today's normal
                  live tee sheet open to
                  monitor day-of changes.
                  On the
                  designated PACE
                  workstation, keep the
                  authenticated PACE page
                  open to synchronize live
                  cart status.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/downloads/golfops-live-chrome-extension.zip?v=${EXTENSION_VERSION}`}
                  download
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
                >
                  Download Version{" "}
                  {EXTENSION_VERSION}
                </a>

                <button
                  type="button"
                  onClick={() =>
                    setShowChromeGuide(
                      !showChromeGuide
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  {showChromeGuide
                    ? "Hide guide"
                    : "Open guide"}
                </button>
              </div>
            </div>

            {showChromeGuide && (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                  <GuideBlock
                    title="Install"
                    steps={[
                      `Download GolfOps Live Chrome Extension version ${EXTENSION_VERSION}.`,
                      "Extract the ZIP to a permanent folder on the workstation.",
                      "In Chrome, open chrome://extensions and turn on Developer mode.",
                      "Choose Load unpacked and select the extracted extension folder.",
                      "Open the GolfOps Live extension and sign in with your GolfOps Live account.",
                    ]}
                  />

                  <GuideBlock
                    title="Send a tee sheet"
                    steps={[
                      "Open ForeTees and select the tee-sheet date you want to import.",
                      "Set Course to -ALL-.",
                      "Click the blue printer icon above the tee sheet.",
                      "Select Bag Report, then Double Line, then Large Font.",
                      "Allow the report page to load while the extension sends it automatically.",
                      "Wait for the green Import Successful confirmation.",
                      "Return to today's normal live ForeTees tee sheet and leave it open; GolfOps checks it once per minute for day-of changes.",
                      "The Print/Report page does not need to remain open after the initial import.",
                      "Return to GolfOps Live and verify the imported date and player count.",
                    ]}
                  />

                  <GuideBlock
                    title="Update Bag Finder"
                    steps={[
                      "Open the ForeTees System Administration Member List.",
                      "Select a last-name letter or choose View All.",
                      "Click Edit beside the member.",
                      "Update the Bag Storage Number.",
                      "Click Save and Close.",
                      "Wait for the green GolfOps Bag Finder confirmation.",
                    ]}
                  />

                  <GuideBlock
                    title="Connect PACE"
                    steps={[
                      "Install the current extension version on the designated PACE workstation.",
                      "Open the GolfOps Live extension and confirm that it is signed in.",
                      "Open tekgps.net/main and sign in to PACE.",
                      "Keep the PACE tab open, Chrome running, and the workstation awake.",
                      "Wait for the green confirmation that the PACE carts synchronized with GolfOps Live.",
                    ]}
                  />
                </div>
              </div>
            )}
          </div>

          <details className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Extension version history
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Review the changes included with each distributed version.
                </p>
              </div>

              <span className="text-lg font-bold text-slate-400">
                +
              </span>
            </summary>

            <div className="border-t border-slate-200 px-5 py-5">
              <div className="space-y-5">
                {releaseHistory.map((release) => (
                  <article
                    key={release.version}
                    className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-950">
                          Version {release.version}
                        </span>

                        {release.current && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {release.date}
                      </div>
                    </div>

                    <ul className="space-y-2 text-sm leading-6 text-slate-600">
                      {release.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="flex gap-2"
                        >
                          <span className="font-bold text-indigo-600">•</span>
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* IPHONE BOOKMARKLET */}

      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl">
              📱
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                iPhone Bookmarklet
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Create a Safari
                bookmark that can send
                a ForeTees page to
                GolfOps Live from an
                iPhone.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label
              htmlFor="sourceLabel"
              className="block text-sm font-bold text-slate-900"
            >
              Source label
            </label>

            <p className="mt-1 text-xs text-slate-500">
              Identifies which device
              or staff workflow
              submitted the tee sheet.
            </p>

            <input
              id="sourceLabel"
              type="text"
              value={sourceLabel}
              onChange={(event) =>
                setSourceLabel(
                  event.target.value
                )
              }
              className="mt-3 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="TwinEagles iPhone"
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bookmarklet code
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Copy this code into
                  the URL field of a
                  Safari bookmark.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  copyBookmarklet
                }
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
              >
                {copied
                  ? "Copied"
                  : "Copy bookmarklet code"}
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg bg-slate-950 px-4 py-4">
              <code className="whitespace-nowrap text-xs text-slate-200">
                {bookmarkletCode}
              </code>
            </div>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              The mobile bookmarklet
              presentation is ready.
              Before staff use it, we
              will connect this button
              to the same authenticated
              GolfOps Live import
              pipeline used by the
              Chrome extension.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() =>
                setShowBookmarkletGuide(
                  !showBookmarkletGuide
                )
              }
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Instructions
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  One-time
                  installation and
                  daily use.
                </p>
              </div>

              <span className="text-lg text-slate-400">
                {showBookmarkletGuide
                  ? "−"
                  : "+"}
              </span>
            </button>

            {showBookmarkletGuide && (
              <div className="grid gap-6 border-t border-slate-200 px-5 py-5 md:grid-cols-2">
                <GuideBlock
                  title="Install · One Time"
                  steps={[
                    "In Safari, bookmark any page.",
                    "Edit the bookmark name to Send to GolfOps Live.",
                    "Copy the bookmarklet code shown above.",
                    "Edit the bookmark again and replace its URL with the copied code.",
                    "Save the bookmark.",
                  ]}
                />

                <GuideBlock
                  title="Use"
                  steps={[
                    "Open ForeTees in Safari and display the desired tee sheet.",
                    "Open your Safari bookmarks.",
                    "Tap Send to GolfOps Live.",
                    "Return to GolfOps Live and verify the imported tee sheet.",
                  ]}
                />
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Desktop workstations
            should use the GolfOps Live
            Chrome extension whenever
            possible.
          </p>
        </div>
      </section>
    </div>
  );
}

function GuideBlock({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <div>
      <h4 className="text-sm font-bold text-slate-900">
        {title}
      </h4>

      <ol className="mt-3 space-y-2">
        {steps.map(
          (
            step,
            index
          ) => (
            <li
              key={step}
              className="flex gap-3 text-sm leading-6 text-slate-600"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {index + 1}
              </span>

              <span>
                {step}
              </span>
            </li>
          )
        )}
      </ol>
    </div>
  );
}
