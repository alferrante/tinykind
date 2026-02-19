import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TinyKind Admin Login",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const showError = params?.error === "1";
  const passwordConfigured = Boolean(process.env.ADMIN_PASSWORD);

  return (
    <main className="shell min-h-screen py-10">
      <section className="panel mx-auto max-w-lg p-6 md:p-8">
        <h1 className="text-3xl text-[#fff5df]">Admin Login</h1>
        <p className="mt-2 text-sm text-[#dce7ff]">
          Private page for TinyKind submissions.
        </p>

        {!passwordConfigured ? (
          <p className="mt-5 rounded-xl border border-[#8a2e2e] bg-[#fff3f3] p-3 text-sm text-[#8a2e2e]">
            ADMIN_PASSWORD is not configured on the server.
          </p>
        ) : null}

        <form action="/api/admin/login" className="mt-5 grid gap-3" method="post">
          <label className="grid gap-1 text-sm font-medium text-[#fff5df]">
            Password
            <input
              className="field"
              name="password"
              placeholder="Enter admin password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <input type="hidden" name="next" value="/admin" />
          <button className="btn btn-primary mt-1" type="submit" disabled={!passwordConfigured}>
            Sign in
          </button>
          {showError ? <div className="text-sm text-[#a22d2d]">Invalid password.</div> : null}
        </form>
      </section>
    </main>
  );
}
