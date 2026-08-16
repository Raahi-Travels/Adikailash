"use client";

import { useState } from "react";

/**
 * Subscribe to route alerts.
 *
 * Deliberately plain, and deliberately honest about what it will and will not send.
 * The promise on the button is the product: we message when the road changes, not
 * every time we re-check it. Doc 07 asks for nurture; the way that fails is volume.
 *
 * Consent is an explicit checkbox rather than implied by pressing the button. Doc 03
 * bans dark patterns and India's DPDP Act requires consent to be demonstrable, and a
 * form where submitting counts as agreeing is neither.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

export function StatusAlerts({ segmentSlug }: { segmentSlug?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setMessage(null);

    try {
      const res = await fetch(`${BASE}/status-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          destination: form.get("destination"),
          name: form.get("name") || null,
          route_segment_slug: segmentSlug ?? null,
          source_page: window.location.pathname,
          consent: form.get("consent") === "on",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.detail ?? "We could not set that up. Please try again.");
        setState("error");
        return;
      }
      setMessage(data.message);
      setState("done");
    } catch {
      setMessage("We could not reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="rounded-lg bg-surface-raised px-5 py-5 ring-1 ring-tone-line">
        <h3 className="text-lg text-tone-strong">Almost there</h3>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-tone-body">
          {message}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg bg-ink/[0.04] px-5 py-5 ring-1 ring-tone-line">
      <h3 className="text-lg">Tell me when this changes</h3>
      <p className="mt-2 max-w-[58ch] text-[15px] leading-relaxed text-tone-body">
        We will message you when the route status actually changes. Not when we
        re-check it and find nothing new, which is most days.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-52 flex-1">
          <span className="text-xs text-tone-muted">Email</span>
          <input
            name="destination"
            type="email"
            required
            className="mt-1 w-full rounded-md bg-ink/[0.04] px-3 py-2 text-[15px] text-tone-strong ring-1 ring-tone-line focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </label>
        <label className="min-w-36">
          <span className="text-xs text-tone-muted">Name, optional</span>
          <input
            name="name"
            className="mt-1 w-full rounded-md bg-ink/[0.04] px-3 py-2 text-[15px] text-tone-strong ring-1 ring-tone-line focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </label>
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {state === "sending" ? "Setting up…" : "Send me changes"}
        </button>
      </div>

      {/* Unchecked by default. Submitting is not agreeing. */}
      <label className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-tone-body">
        <input type="checkbox" name="consent" className="mt-1 size-4 shrink-0 accent-gold" />
        <span>
          Yes, email me when the route or permit status changes. We will confirm the
          address first, and every message carries a one-click unsubscribe.
        </span>
      </label>

      {state === "error" && message && (
        <p role="alert" className="mt-3 text-sm text-status-suspended">
          {message}
        </p>
      )}
    </form>
  );
}
