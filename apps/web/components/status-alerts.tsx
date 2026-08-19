"use client";

import { useState } from "react";

import { Surface } from "@/components/ui/surface";

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
 *
 * Written against the type and shape systems rather than against raw utilities. It
 * used not to be, and the audit found it by measurement: 12px field labels, a 14px
 * call to action next to 15px ones everywhere else, a consent sentence running to
 * 93 characters, and an 8px-radius panel with a visible hairline border on a site
 * whose brief begins "no borders". It was the last template shape on the site.
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
      <Surface className="px-6 py-6 sm:px-8 sm:py-7">
        <div role="status">
          <h3 className="type-title-2 text-tone-strong">Almost there</h3>
          <p className="type-body measure-card mt-3 text-tone-body">{message}</p>
        </div>
      </Surface>
    );
  }

  return (
    <Surface as="section" className="px-6 py-6 sm:px-8 sm:py-7">
      <form onSubmit={onSubmit}>
        <h3 className="type-title-2 text-tone-strong">Tell me when this changes</h3>
        <p className="type-body measure-card mt-3 text-tone-body">
          We will message you when the route status actually changes. Not when we
          re-check it and find nothing new, which is most days.
        </p>

        <div className="mt-[var(--space-lg)] flex flex-wrap items-end gap-4">
          <label className="min-w-52 flex-1">
            <span className="type-meta block font-semibold text-tone-strong">Email</span>
            <input
              name="destination"
              type="email"
              required
              className="field mt-2 hover:shadow-[0_0_0_1px_var(--color-tone-body)]"
            />
          </label>
          <label className="min-w-44 flex-1">
            <span className="type-meta block font-semibold text-tone-strong">
              Your name <span className="font-normal text-tone-body">(optional)</span>
            </span>
            <input
              name="name"
              className="field mt-2 hover:shadow-[0_0_0_1px_var(--color-tone-body)]"
            />
          </label>
          <button
            type="submit"
            disabled={state === "sending"}
            className="cta-gold type-meta inline-flex min-h-12 shrink-0 items-center whitespace-nowrap rounded-pill px-6 font-semibold transition-transform duration-[var(--dur-press)] ease-standard active:scale-[0.97] disabled:cursor-progress disabled:opacity-75 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {state === "sending" ? "Setting up" : "Send me changes"}
          </button>
        </div>

        {/* Unchecked by default. Submitting is not agreeing. */}
        <label className="mt-[var(--space-md)] flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
          <input
            type="checkbox"
            name="consent"
            className="mt-1 size-5 shrink-0 accent-status-open"
          />
          <span className="type-body measure-card text-tone-body">
            Yes, email me when the route or permit status changes. We will confirm the
            address first, and every message carries a one-click unsubscribe.
          </span>
        </label>

        {state === "error" && message && (
          <p role="alert" className="type-body measure-card mt-4 text-status-suspended">
            {message}
          </p>
        )}
      </form>
    </Surface>
  );
}
