"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

const DEFAULT_SOURCE =
  "TwinEagles iPhone";

const EXTENSION_VERSION =
  "1.2.1";

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
                Import ForeTees tee sheets and lessons, synchronize ForeTees Admin bag slots, and send SchedulePop staffing to GolfOps Live.
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
            Recommended
          </span>
        </div>

        <div className="px-6 py-5">
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
                  SchedulePop.
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
                <div className="grid gap-6 lg:grid-cols-3">
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
                </div>
              </div>
            )}
          </div>
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