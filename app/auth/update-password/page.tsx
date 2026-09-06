import UpdatePasswordManager from "@/components/UpdatePasswordManager";
export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-950">
            GolfOps Live
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Choose a new password for your account.
          </p>
        </div>

        <UpdatePasswordManager />
      </div>
    </main>
  );
}
