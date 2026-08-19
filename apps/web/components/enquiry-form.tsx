"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { QuietAction } from "@/components/ui/action";
import { Surface } from "@/components/ui/surface";
import {
  captureAttribution,
  trackBehaviour,
  trackBusiness,
} from "@/lib/analytics";
import { submitEnquiry, type JourneySummary } from "@/lib/api";

/**
 * ============================================================================
 * THE SHARED FORM KIT, plus the general enquiry form.
 * ============================================================================
 *
 * The kit at the top of this file is used by `specialist-enquiry-form.tsx` and
 * `feedback-form.tsx` too. **It belongs in `components/ui/form.tsx` and it is
 * here instead for one reason:** the redesign was built by ten agents working
 * concurrently on separate file sets, and a new shared module would have landed
 * in somebody else's lane. Moving it is a rename and three imports. See the
 * handover note.
 *
 * What the kit gives every field on the site:
 *
 *   rest     the shared `.field` boundary, measured at 3:1 (WCAG 1.4.11)
 *   hover    the boundary steps up to `--color-tone-body`
 *   filled   the boundary steps up to `--color-tone-muted`, set from `onInput`
 *            rather than a CSS pseudo-class because `:not(:placeholder-shown)`
 *            does not exist for a `<select>` or a `<textarea>` without one
 *   focus    the gold 2px outline at 2px offset, from `.field:focus-visible`
 *   error    a 2px `--color-status-suspended` ring, `aria-invalid`, and a
 *            message wired through `aria-describedby`
 *   loading  the submit disabled, `aria-busy` on the form, a live region
 *   success  the form is replaced by a panel that takes focus
 *
 * The error ring is an inline style and not a class. It has to beat both the
 * hover utility and `.field:focus-visible`, and it must not be defeated by
 * whichever of two same-layer utilities Tailwind happens to emit last. It sets
 * `box-shadow` only, so the gold focus *outline* still shows on top of it: a
 * field that is both invalid and focused reads as both.
 *
 * Doc 03 governs what may be asked: "Ask only what is necessary for the current
 * stage", "Collect explicit communication consent", "Do not require account
 * creation to ask a question", "Avoid dark patterns, pre-checked marketing
 * consent". So there are no document fields, no medical history, no account, and
 * promotional consent starts off and is separate from the permission to reply.
 */

/* -------------------------------------------------------------------------- */
/* The kit                                                                     */
/* -------------------------------------------------------------------------- */

const CONTROL =
  "field hover:shadow-[0_0_0_1px_var(--color-tone-body)] data-filled:shadow-[0_0_0_1px_var(--color-tone-muted)]";

const ERROR_STYLE: React.CSSProperties = {
  boxShadow:
    "inset 0 1px 2px oklch(0.15 0.02 245 / 0.06), 0 0 0 2px var(--color-status-suspended)",
};

/** Marks a control as carrying a value, for the `data-filled` edge. */
function markFilled(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (el.value) el.dataset.filled = "true";
  else delete el.dataset.filled;
}

function onControlInput(
  event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) {
  markFilled(event.currentTarget);
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="type-meta measure-meta mt-2 flex items-start gap-2 text-status-suspended"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="mt-0.5 size-4 shrink-0">
        <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 4.4v4.3M8 11.1v.7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/**
 * One labelled control.
 *
 * The label is always a real `<label>` and never a placeholder: a placeholder
 * disappears the moment somebody types, which is exactly when they are most
 * likely to have forgotten what the box was for. Guidance that used to live in
 * placeholders is a persistent `.field-hint` beneath the label instead.
 */
export function Field({
  name,
  label,
  type = "text",
  rows,
  hint,
  error,
  optional = false,
  autoComplete,
  inputMode,
  min,
  max,
  defaultValue,
  className = "",
  onInput,
}: {
  name: string;
  label: string;
  type?: string;
  /** Renders a `<textarea>` of this many rows instead of an `<input>`. */
  rows?: number;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  min?: number;
  max?: number;
  defaultValue?: string;
  className?: string;
  onInput?: () => void;
}) {
  const id = `f-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    name,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy,
    className: `${CONTROL} mt-2`,
    style: error ? ERROR_STYLE : undefined,
    onInput: (
      e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      onControlInput(e);
      onInput?.();
    },
    defaultValue,
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="type-meta block font-semibold text-tone-strong">
        {label}
        {optional && <span className="font-normal text-tone-body"> (optional)</span>}
      </label>
      {rows ? (
        <textarea rows={rows} {...shared} />
      ) : (
        <input
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          min={min}
          max={max}
          {...shared}
        />
      )}
      {hint && (
        <p id={hintId} className="field-hint mt-2">
          {hint}
        </p>
      )}
      {error && errorId && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

/** The same, wrapping a `<select>`. Its chevron and height come from `.field`. */
export function SelectField({
  name,
  label,
  hint,
  children,
  className = "",
  onInput,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  onInput?: () => void;
}) {
  const id = `f-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="type-meta block font-semibold text-tone-strong">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue=""
        aria-describedby={hintId}
        className={`${CONTROL} mt-2`}
        onInput={(e) => {
          onControlInput(e);
          onInput?.();
        }}
      >
        {children}
      </select>
      {hint && (
        <p id={hintId} className="field-hint mt-2">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A checkbox row.
 *
 * 44px minimum height with the box centred in it, because the tap target is the
 * row and not the 20px square. The accent is the register's own `open` status
 * colour rather than gold: gold is budgeted at one filled object per viewport and
 * that object is the submit button.
 */
export function CheckRow({
  name,
  value,
  children,
  hint,
}: {
  name: string;
  value?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
      <input
        type="checkbox"
        name={name}
        value={value}
        className="mt-0.5 size-5 shrink-0 accent-status-open"
      />
      <span className="type-body measure-card">
        {children}
        {hint && <span className="field-hint mt-1 block">{hint}</span>}
      </span>
    </label>
  );
}

/** A form section. Space and a serif legend, never a rule and never an eyebrow. */
export function FormGroup({
  legend,
  note,
  children,
  className = "",
}: {
  legend: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="type-title-2 text-tone-strong">{legend}</legend>
      {note && <p className="field-hint mt-2">{note}</p>}
      <div className="mt-6">{children}</div>
    </fieldset>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-4 animate-spin motion-reduce:animate-none">
      <circle
        cx="8"
        cy="8"
        r="6.4"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.7"
      />
      <path
        d="M8 1.6a6.4 6.4 0 0 1 6.4 6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The one gold object on the page. 48px minimum, `.type-meta` at weight 600. */
export function Submit({
  busy,
  children,
  busyLabel = "Sending",
}: {
  busy: boolean;
  children: ReactNode;
  busyLabel?: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="cta-gold type-meta inline-flex min-h-12 items-center justify-center gap-2.5 rounded-pill px-7 font-semibold transition-transform duration-[var(--dur-press)] ease-standard active:scale-[0.97] disabled:cursor-progress disabled:opacity-75 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {busy && <Spinner />}
      {busy ? busyLabel : children}
    </button>
  );
}

/** Network and server failures. Field-level problems never come through here. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-action bg-status-suspended/10 px-5 py-4 shadow-[0_0_0_1px_var(--color-status-suspended)]"
    >
      <p className="type-body measure-card text-tone-strong">{children}</p>
    </div>
  );
}

/**
 * What replaces the form once it has been sent.
 *
 * It takes focus on mount, so a keyboard or screen-reader user is not left at a
 * submit button that no longer exists with no announcement of what happened.
 */
export function FormSuccess({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);

  return (
    <Surface radius="frame" className="p-6 sm:p-9">
      <div ref={panel} tabIndex={-1} role="status" className="outline-none">
        <svg viewBox="0 0 24 24" aria-hidden className="size-9 text-status-open">
          <circle cx="12" cy="12" r="10.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="m7.6 12.4 2.9 2.9 5.9-6.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2 className="type-title-1 mt-5 text-tone-strong">{title}</h2>
        <div className="type-body mt-4 text-tone-body">{children}</div>
        {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* The general enquiry form                                                    */
/* -------------------------------------------------------------------------- */

type Errors = Partial<Record<"phone" | "email", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Everything here is optional except a way to reply, and that one rule is
 * enforced across two fields rather than on either of them: the page has always
 * said "one of the two is enough", so requiring both would be a worse form and
 * requiring neither would produce leads nobody can answer.
 */
function validate(form: FormData): Errors {
  const errors: Errors = {};
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!phone && !email) {
    const message = "Please give us one of these, so we have a way to reply.";
    errors.phone = message;
    errors.email = message;
  } else if (email && !EMAIL.test(email)) {
    errors.email = "That does not look like an email address.";
  }
  return errors;
}

export function EnquiryForm({ journeys }: { journeys: JourneySummary[] }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const started = useRef(false);
  const attempted = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  /** Fires once, on the first real keystroke. A page view is not a form start. */
  function onFirstInput() {
    if (started.current) return;
    started.current = true;
    trackBehaviour("enquiry_form_started", captureAttribution());
  }

  /** After a failed attempt, errors clear as they are fixed rather than on resubmit. */
  function revalidate() {
    if (!attempted.current || !formRef.current) return;
    setErrors(validate(new FormData(formRef.current)));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    attempted.current = true;

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(`f-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    setState("sending");
    setFailure(null);

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
      setFailure(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <FormSuccess
        title="Your enquiry has reached us."
        actions={
          <>
            <QuietAction href="/plan">Read the planning guide</QuietAction>
            <QuietAction href="/status">See what we have verified</QuietAction>
          </>
        }
      >
        <p>
          A person will read it and reply, rather than an automated sequence. If your
          question is about dates or permits, we may ask a few things back before we
          can answer it properly.
        </p>
      </FormSuccess>
    );
  }

  const busy = state === "sending";

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onInput={onFirstInput}
      aria-busy={busy}
      noValidate
      className="space-y-[var(--space-xl)]"
    >
      <FormGroup
        legend="How we reach you"
        note="A phone number or an email address. One of the two is enough, and everything else on this form is optional."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Field name="name" label="Your name" optional autoComplete="name" />
          <Field
            name="origin_city"
            label="Travelling from"
            optional
            hint="Delhi, Lucknow, or somewhere else entirely."
          />
          <Field
            name="phone"
            label="Phone or WhatsApp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={errors.phone}
            onInput={revalidate}
          />
          <Field
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            error={errors.email}
            onInput={revalidate}
          />
        </div>
      </FormGroup>

      <FormGroup legend="Where you are headed">
        <div className="grid gap-6 sm:grid-cols-2">
          <SelectField
            name="journey_slug"
            label="Which journey"
          >
            <option value="">Not sure yet</option>
            {journeys.map((j) => (
              <option key={j.slug} value={j.slug}>
                {j.name}
              </option>
            ))}
          </SelectField>
          <Field
            name="group_size"
            label="How many travelling"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            optional
          />
        </div>
        <div className="mt-5">
          <CheckRow
            name="is_senior_inclusive"
            hint="Helps us suggest a slower pace. We do not use it to judge anyone's fitness."
          >
            Someone in our group is a senior traveller
          </CheckRow>
        </div>
      </FormGroup>

      <FormGroup legend="What you are unsure about">
        <Field
          name="primary_concern"
          label="Tell us in your own words"
          optional
          rows={5}
          hint="Altitude, taking parents, dates, permits, room quality. Whatever is actually stopping you."
        />
      </FormGroup>

      {/*
        The one panel on this page, and it is here because these two boxes are the
        only thing on the form that grants us a permission. Both start off, and
        replying to the enquiry itself needs neither.
      */}
      <Surface className="p-5 sm:p-6">
        <fieldset>
          <legend className="type-body font-semibold text-tone-strong">
            What may we send you?
          </legend>
          <p className="field-hint mt-2">
            Replying to this enquiry needs no permission. These are separate, and both
            start off.
          </p>
          <div className="mt-3">
            <CheckRow name="status_alerts">
              Tell me when route or permit status changes
            </CheckRow>
            <CheckRow name="promotional">
              Send me new departures and occasional updates
            </CheckRow>
          </div>
        </fieldset>
      </Surface>

      {state === "error" && failure && <FormAlert>{failure}</FormAlert>}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Submit busy={busy}>Send enquiry</Submit>
        <p aria-live="polite" className="type-meta text-tone-body">
          {busy ? "Sending your enquiry." : ""}
        </p>
      </div>
    </form>
  );
}
