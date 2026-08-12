"use client";

import { useState } from "react";

/**
 * The private/international and B2B ground-handling forms.
 *
 * One component, two field sets, because both post the same `/leads` endpoint with a
 * different `enquiry_kind`. Doc 04 wants one sales pipeline; a three-person team with
 * three inboxes will read the quietest one once a week.
 *
 * **Every field except a contact method is optional, and that is a design decision
 * rather than laziness.** Doc 03 says "Ask only what is necessary for the current
 * stage", and the current stage is getting somebody in Ohio to write to us at all. A
 * fourteen-field required form on a first contact converts a curious traveller into
 * a bounce. The rest of it is what the consultation call is for.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type Kind = "private_or_international" | "b2b_ground_handling";

const FIELD = "mt-1 w-full rounded-md bg-white/[0.06] px-3 py-2 text-[15px] text-ink-inverse ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-gold";
const LABEL = "text-xs text-ink-inverse/50";

function Field({
  name,
  label,
  hint,
  type = "text",
  rows,
  required,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      {/* `truncate` keeps a long label on one line: a label that wraps makes its
          cell taller and knocks the adjacent column's field out of alignment. */}
      <span className={`${LABEL} block truncate`}>
        {label}
        {!required && <span className="text-ink-inverse/30"> — optional</span>}
      </span>
      {rows ? (
        <textarea name={name} rows={rows} className={FIELD} />
      ) : (
        <input name={name} type={type} required={required} className={FIELD} />
      )}
      {hint && <span className="mt-1 block text-xs leading-relaxed text-ink-inverse/40">{hint}</span>}
    </label>
  );
}

export function SpecialistEnquiryForm({ kind }: { kind: Kind }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const isB2B = kind === "b2b_ground_handling";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const get = (k: string) => {
      const v = f.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };

    setState("sending");
    try {
      const res = await fetch(`${BASE}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enquiry_kind: kind,
          name: get("name"),
          email: get("email"),
          phone: get("phone"),
          country: get("country"),
          group_size: get("group_size") ? Number(get("group_size")) : null,
          primary_concern: get("primary_concern"),
          landing_page: window.location.pathname,
          detail: {
            date_flexibility: get("date_flexibility"),
            age_range: get("age_range"),
            experience_preference: get("experience_preference"),
            gateway_needs: get("gateway_needs"),
            interests: get("interests"),
            time_zone: get("time_zone") ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            consultation_window: get("consultation_window"),
            consultation_channel: get("consultation_channel"),
            accessibility_needs: get("accessibility_needs"),
            company_name: get("company_name"),
            company_role: get("company_role"),
            company_website: get("company_website"),
            company_registration: get("company_registration"),
            services_needed: f.getAll("services_needed").join(", ") || null,
            volume_estimate: get("volume_estimate"),
            season_of_interest: get("season_of_interest"),
          },
          consents: [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.detail ?? "We could not send that. Please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setMessage("We could not reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="rounded-lg bg-white/[0.04] px-6 py-7 ring-1 ring-white/10">
        <h2 className="font-serif text-2xl">Thank you</h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-inverse/70">
          {isB2B
            ? "One of the three of us will read this and reply. If we cannot handle the volume or the dates you need, we will say so rather than take the enquiry and work it out later."
            : "One of the three of us will read this and write back to arrange a call at a time that is reasonable where you are. The outcome of that call is a proposal, not a booking."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg bg-white/[0.04] px-6 py-7 ring-1 ring-white/10">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Your name" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="phone" label="Phone or WhatsApp" />
        {isB2B ? (
          <>
            <Field name="company_name" label="Company" required />
            <Field name="company_role" label="Your role" />
            <Field name="company_website" label="Website" />
            <Field
              name="company_registration"
              label="GST or registration no."
              hint="Not checked now. It is a starting point for the conversation."
            />
            <Field name="volume_estimate" label="Rough volume" hint="An estimate is fine. We treat it as one." />
            <Field name="season_of_interest" label="Season" />
          </>
        ) : (
          <>
            <Field name="country" label="Country you are travelling from" />
            <Field name="group_size" label="How many of you" type="number" />
            <Field name="age_range" label="Age range" hint="&ldquo;62 to 74, one post-surgery&rdquo; tells us more than two numbers." />
            <Field name="consultation_window" label="When can you talk" hint="In your own local terms. We will work around it." />
          </>
        )}
      </div>

      {isB2B ? (
        <fieldset className="mt-6">
          <legend className={LABEL}>What you need from us</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {["Airport and gateway transfers", "Inner line permits", "Accommodation", "Full ground handling", "Vehicles and drivers", "Local coordinator"].map(
              (service) => (
                <label key={service} className="flex items-center gap-2 text-sm text-ink-inverse/70">
                  <input type="checkbox" name="services_needed" value={service} className="size-4 accent-gold" />
                  {service}
                </label>
              ),
            )}
          </div>
        </fieldset>
      ) : (
        <div className="mt-5 grid gap-5">
          <Field name="date_flexibility" label="Dates, and how flexible they are" rows={2} hint="&ldquo;The week after Diwali, or next year if the passes are bad&rdquo; is a real answer." />
          <Field name="gateway_needs" label="Airport and gateway" rows={2} />
          <Field name="experience_preference" label="Trekking experience and comfort" rows={2} />
          <Field name="interests" label="What draws you to this" rows={2} />
        </div>
      )}

      <div className="mt-5">
        <Field
          name="primary_concern"
          label={isB2B ? "Anything else we should know" : "What you are most unsure about"}
          rows={3}
        />
      </div>

      {!isB2B && (
        <div className="mt-5 rounded-md bg-white/[0.03] px-4 py-4 ring-1 ring-white/10">
          {/*
            Doc 03: "Any accessibility or support needs the traveller CHOOSES to
            disclose." Set apart, explained, and never required — a required health
            field on a first-contact form is both a worse experience and a worse
            data-protection position.
          */}
          <Field
            name="accessibility_needs"
            label="Accessibility or support needs"
            rows={2}
            hint="Only if you want to. It helps us plan honestly, and it is never shown to anybody outside the three of us."
          />
        </div>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-6 rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : isB2B ? "Send enquiry" : "Request a consultation"}
      </button>

      {state === "error" && message && (
        <p role="alert" className="mt-4 text-sm text-status-suspended">
          {message}
        </p>
      )}

      <p className="mt-5 text-xs leading-relaxed text-ink-inverse/40">
        We will never ask for identity documents or payment details through this form.
      </p>
    </form>
  );
}
