"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Where a group lead creates and turns off family links (doc 05, P1).
 *
 * **Revoking is as prominent as creating.** A share manager that makes it easy to
 * grant and hard to withdraw is a dark pattern with a friendly face, and doc 03 rules
 * those out. The person who shared a link with a relative and then thought better of
 * it should find "turn it off" in the same place, at the same size.
 *
 * The view count is shown for the same reason. A link forwarded round a family
 * WhatsApp group reads as thirty views, and the group lead is the only person who can
 * decide whether that is fine.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type Share = {
  id: number;
  label: string;
  url: string;
  expires_at: string;
  revoked_at: string | null;
  shows_check_ins: boolean;
  view_count: number;
  last_viewed_at: string | null;
};

export function FamilyShares({ token }: { token: string }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  // Declared with `useCallback` and re-read after every mutation. The list is short
  // and the source of truth is the server; optimistically patching local state here
  // would risk showing a link as live after the revoke that turned it off failed.
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetch(
        `${BASE}/family-shares?token=${encodeURIComponent(token)}`,
        { signal },
      );
      if (res.ok) setShares(await res.json());
    },
    [token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        await load(controller.signal);
      } catch {
        // A failed list leaves this section empty rather than erroring the whole
        // booking page around it.
      }
    })();
    return () => controller.abort();
  }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await fetch(`${BASE}/family-shares?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: data.get("label"),
          shows_check_ins: data.get("shows_check_ins") === "on",
        }),
      });
      form.reset();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    setBusy(true);
    try {
      await fetch(
        `${BASE}/family-shares/${id}/revoke?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  const live = shares.filter((s) => !s.revoked_at);

  return (
    <section className="mt-10 border-t border-tone-line pt-8">
      <h2 className="font-serif text-2xl">Let family follow along</h2>
      <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-tone-body">
        A link for somebody at home. They see the journey, roughly where you are each
        day, the coordinator&rsquo;s number and any route notice, and nothing else. No
        documents, no payments, no personal details about anybody travelling.
      </p>

      {live.length > 0 && (
        <ul className="mt-6 space-y-4">
          {live.map((share) => (
            <li
              key={share.id}
              className="rounded-lg bg-white/[0.04] px-4 py-4 ring-1 ring-tone-line"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[15px]">{share.label}</p>
                  <p className="mt-0.5 text-sm text-tone-muted">
                    {share.view_count === 0
                      ? "Not opened yet"
                      : `Opened ${share.view_count} time${share.view_count === 1 ? "" : "s"}`}
                    {!share.shows_check_ins && " · check-ins hidden"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(share.url);
                      setCopied(share.id);
                    }}
                    className="rounded-full bg-white/[0.08] px-4 py-1.5 text-sm ring-1 ring-tone-line hover:bg-white/[0.12]"
                  >
                    {copied === share.id ? "Copied" : "Copy link"}
                  </button>
                  {/* Same size, same place, no confirmation maze. */}
                  <button
                    type="button"
                    onClick={() => revoke(share.id)}
                    disabled={busy}
                    className="rounded-full bg-white/[0.08] px-4 py-1.5 text-sm ring-1 ring-tone-line hover:bg-white/[0.12] disabled:opacity-50"
                  >
                    Turn off
                  </button>
                </div>
              </div>
              <p className="mt-2 break-all text-xs text-tone-muted">{share.url}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1">
          <span className="text-xs text-tone-muted">Who is it for</span>
          <input
            name="label"
            required
            maxLength={120}
            placeholder="Amma"
            className="mt-1 w-full rounded-md bg-white/[0.06] px-3 py-2 text-[15px] text-tone-strong ring-1 ring-tone-line focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-tone-body">
          <input
            type="checkbox"
            name="shows_check_ins"
            defaultChecked
            className="size-4 accent-gold"
          />
          Show daily check-ins
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight disabled:opacity-60"
        >
          Create link
        </button>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-tone-muted">
        Links stop working two weeks after the journey ends, and you can turn any of
        them off at any time.
      </p>
    </section>
  );
}
