"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { signIn } from "@/lib/auth-client";

const FIELD =
  "mt-1.5 w-full rounded-md bg-white/[0.06] px-3 py-2 text-[15px] text-tone-strong ring-1 ring-tone-line focus:outline-none focus:ring-2 focus:ring-gold";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);

    const { error: err } = await signIn.email({
      email: String(data.get("email")),
      password: String(data.get("password")),
    });

    if (err) {
      // Deliberately not distinguishing "no such account" from "wrong password":
      // that difference tells an attacker which staff emails exist.
      setError("That email and password did not match an active staff account.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <main id="main" className="flex-1 register-dark px-4 py-24 text-tone-strong">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-medium">Staff sign-in</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-tone-body">
          Accounts are created by an administrator. There is no self sign-up.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm text-tone-body" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className={FIELD}
            />
          </div>
          <div>
            <label className="block text-sm text-tone-body" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={FIELD}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-status-suspended/15 px-4 py-3 text-sm ring-1 ring-status-suspended/30"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight disabled:opacity-60"
          >
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
