"use client";

import { useState } from "react";
import Link from "next/link";
import {
  parseForeTeesHtml,
  type ForeTeesParseResult,
} from "@/lib/foretees-parser";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ForeTeesParseResult | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    setFile(selectedFile);
    setMessage("");
    setResult(null);
  }

  async function handleUpload() {
    if (!file) {
      setMessage("Please select a ForeTees file first.");
      setResult(null);
      return;
    }

    try {
      const html = await file.text();
      const parsed = parseForeTeesHtml(html);

      setResult(parsed);

      if (parsed.teeTimes.length === 0) {
        setMessage(
          "The file was read, but no ForeTees tee times were found."
        );
        return;
      }

      setMessage("ForeTees file parsed successfully.");
    } catch (error) {
      console.error("ForeTees parsing error:", error);
      setResult(null);
      setMessage("Unable to read this ForeTees file.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex min-h-20 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
GolfOps Live              </h1>

              <p className="text-sm text-slate-500">
                TwinEagles Club
              </p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">
            Upload Tee Sheet
          </h2>

          <p className="mt-2 text-slate-600">
            Import a ForeTees Proshop Print/Report file.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <h3 className="text-lg font-semibold text-slate-900">
              Select ForeTees File
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Accepted file types: HTML, HTM, or XLS
            </p>

            <input
              type="file"
              accept=".html,.htm,.xls"
              onChange={handleFileChange}
              className="mt-6 block w-full text-sm text-slate-600"
            />

            {file && (
              <div className="mt-6 rounded-lg bg-white p-4 text-left">
                <p className="text-sm font-semibold text-slate-900">
                  Selected File
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {file.name}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-5">
            <h4 className="font-semibold text-slate-900">
              ForeTees Instructions
            </h4>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              From ForeTees, open the Proshop Print/Report tee sheet and
              select the -ALL- course option. Save the report as an HTML,
              HTM, or XLS file and upload it here.
            </p>
          </div>

          <button
            onClick={handleUpload}
            className="mt-6 w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Import Tee Sheet
          </button>

          {message && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">
                {message}
              </p>
            </div>
          )}

          {result && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Import Preview
              </h3>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tee Sheet Date
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {result.sheetDate ?? "Not found"}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tee Times Found
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {result.teeTimes.length}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Players Found
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {result.occupiedPlayers}
                  </p>
                </div>
              </div>

              {result.teeTimes.length > 0 && (
                <div className="mt-6 rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    First Tee Time Detected
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {result.teeTimes[0].teeTime} ·{" "}
                    {result.teeTimes[0].course} · Hole{" "}
                    {result.teeTimes[0].startingHole}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}