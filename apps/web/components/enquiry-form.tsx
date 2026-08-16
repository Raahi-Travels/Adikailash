"use client";

import { useRef, useState } from "react";

import {
  captureAttribution,
  trackBehaviour,
  trackBusiness,
} from "@/lib/analytics";
import { submitEnquiry, type JourneySummary } from "@/lib/api";

/**
 * Enquiry form.
 *
 * Doc 03: "Ask only what is necessary for the current stage", "Collect explicit
 * communication consent", "Do not require account creation to ask a question",
 * "Avoid dark patterns, pre-checked marketing consent".
 *
 * So: no document fields, no medical history, no account. Promotional consent is
 * unchecked by default and separate from the permission to reply about this enquiry.
 */

const FIELD =
  "mt-2 w-full rounded-md bg-ink/[0.04] px-3.5 py-2.5 text-[15px] text-tone-strong ring-1 ring-tone-line placeholder:text-tone-muted focus:outline-none focus:ring-2 focus:ring-gold";
const LABEL = "block text-sm text-tone-body";

export function EnquiryForm({ journeys }: { journeys: JourneySummary[] }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  /** Fires once, on the first real keystroke. A page view is not a form start. */
  function onFirstInput() {
    if (started.current) return;
    started.current = true;
    trackBehaviour("enquiry_form_started", captureAttribution());
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError(null);

    try {
      const created = await submitEnquiry({
        name: form.get("name") || null,
        phone: form.get("phone") || null,
        email: form.get("email") || null,
        origin_city: form.get("origin_city") || null,
        journey_slug: form.get("journey_slug") || null,
        group_size: form.get("group_size") ? Number(form.get("group_size")) : null,
        is_senior_inclusive: form.get("is_senior_inclusive") === "on",
        primary_concern: form.get("primary_concern") || null,
        landing_page: window.location.pathname,
        referrer: document.referrer || null,
        consents: [
          {
            purpose: "route_status_alerts",
            channel: "whatsapp",
            granted: form.get("status_alerts") === "on",
          },
          {
            purpose: "promotional",
            channel: "whatsapp",
            granted: form.get("promotional") === "on",
          },
        ],
      });

      // Business event, and only here. Doc 07: "Use server-confirmed business events
      // ... rather than treating button clicks as sales." The submit click above is
      // not a lead; this line runs only after the API returned one.
      trackBusiness("lead_created", {
        lead_id: created?.id ?? null,
        journey: String(form.get("journey_slug") ?? "") || null,
        ...captureAttribution(),
      });
      if (form.get("status_alerts") === "on" || form.get("promotional") === "on") {
        trackBusiness("consent_granted", { lead_id: created?.id ?? null });
      }

      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div
        role="status"
        className="rounded-lg bg-surface-raised px-6 py-8 ring-1 ring-tone-line"
      >
        <h2 className="font-serif text-2xl text-tone-strong">Thank you.</h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-tone-body">
          Your enquiry has reached us. A person will read it and reply, rather than an
          automated sequence. If your question is about dates or permits, we may ask a
          few things back before we can answer properly.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      onInput={onFirstInput}
      className="space-y-6"
      noValidate
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="name">
            Your name
          </label>
          <input id="name" name="name" className={FIELD} autoComplete="name" />
        </div>
        <div>
          <label className={LABEL} htmlFor="origin_city">
            Travelling from
          </label>
          <input
            id="origin_city"
            name="origin_city"
            className={FIELD}
            placeholder="Delhi, Lucknow, elsewhere"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="phone">
            Phone or WhatsApp
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className={FIELD}
            autoComplete="tel"
            aria-describedby="contact-help"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className={FIELD}
            autoComplete="email"
            aria-describedby="contact-help"
          />
        </div>
      </div>
      <p id="contact-help" className="text-sm text-tone-muted">
        One of the two is enough. We only need a way to reply.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="journey_slug">
            Which journey
          </label>
          <select id="journey_slug" name="journey_slug" className={FIELD} defaultValue="">
            <option value="">Not sure yet</option>
            {journeys.map((j) => (
              <option key={j.slug} value={j.slug}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="group_size">
            How many travelling
          </label>
          <input
            id="group_size"
            name="group_size"
            type="number"
            min={1}
            max={100}
            className={FIELD}
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-[15px] text-tone-body">
        <input
          type="checkbox"
          name="is_senior_inclusive"
          className="mt-1 size-4 accent-gold"
        />
        <span>
          Someone in our group is a senior traveller
          <span className="mt-0.5 block text-sm text-tone-muted">
            Helps us suggest a slower pace. We do not use this to judge anyone&rsquo;s
            fitness.
          </span>
        </span>
      </label>

      <div>
        <label className={LABEL} htmlFor="primary_concern">
          What are you most unsure about?
        </label>
        <textarea
          id="primary_concern"
          name="primary_concern"
          rows={4}
          className={FIELD}
          placeholder="Altitude, taking parents, dates, permits, room quality"
        />
      </div>

      <fieldset className="space-y-3 border-t border-tone-line pt-6">
        <legend className="text-sm text-tone-body">
          What may we send you?
        </legend>
        <p className="text-sm text-tone-muted">
          Replying to this enquiry needs no permission. These are separate, and both
          start off.
        </p>
        <label className="flex items-start gap-3 text-[15px] text-tone-body">
          <input type="checkbox" name="status_alerts" className="mt-1 size-4 accent-gold" />
          <span>Tell me when route or permit status changes</span>
        </label>
        <label className="flex items-start gap-3 text-[15px] text-tone-body">
          <input type="checkbox" name="promotional" className="mt-1 size-4 accent-gold" />
          <span>Send me new departures and occasional updates</span>
        </label>
      </fieldset>

      {state === "error" && error && (
        <p role="alert" className="rounded-md bg-status-suspended/15 px-4 py-3 text-[15px] text-tone-strong ring-1 ring-status-suspended/30">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {state === "sending" ? "Sending" : "Send enquiry"}
      </button>
    </form>
  );
}
