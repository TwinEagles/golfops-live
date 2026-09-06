"use client";

import { useState } from "react";

export default function AccountSettingsManager({
  email,
}: {
  email: string;
}) {
  const [sending, setSending] =
    useState(false);

  const [sent, setSent] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function sendResetLink() {
    setSending(true);
    setSent(false);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/account/password-reset",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to send reset link."
        );
      }

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send reset link."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {sent && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Password reset email sent. Check your inbox and follow the secure link to choose a new password.
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            Login
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Your GolfOps Live account credentials.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">
                Email
              </div>

              <div className="mt-1 text-sm text-slate-500">
                {email || "No email address available"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">
                Password
              </div>

              <div className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                For security, password changes require email verification. GolfOps Live will send a secure reset link to your account email.
              </div>
            </div>

            <button
              type="button"
              disabled={
                sending ||
                !email
              }
              onClick={sendResetLink}
              className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending
                ? "Sending..."
                : "Send Reset Link"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
