"use client";

import { useRef, useState } from "react";

import {
  CheckRow,
  Field,
  FormAlert,
  FormGroup,
  FormSuccess,
  Submit,
} from "@/components/enquiry-form";
import { QuietAction } from "@/components/ui/action";

/**
 * The private/international and B2B ground-handling forms.
 *
 * One component, two field sets, because both post the same `/leads` endpoint
 * with a different `enquiry_kind`. Doc 04 wants one sales pipeline; a three-person
 * team with three inboxes will read the quietest one once a week.
 *
 * **Every field except a name and a contact address is optional, and that is a
 * design decision rather than laziness.** Doc 03 says "Ask only what is necessary
 * for the current stage", and the current stage is getting somebody in Ohio to
 * write to us at all. A fourteen-field required form on a first contact converts a
 * curious traveller into a bounce. The rest of it is what the consultation call is
 * for.
 *
 * The field kit, and the reason it lives in `enquiry-form.tsx`, are documented at
 * the top of that file.
 *
 * Two shapes changed in the redesign and both were defects rather than taste:
 *
 * 1. The form no longer sits in a card, and the accessibility question no longer
 *    sits in a tinted panel *inside* that card. Nested surfaces are banned site
 *    wide, and the inner panel had the additional problem of drawing a box around
 *    the one question on the page that a person might feel self-conscious
 *    answering. It is now a labelled group like every other.
 * 2. Labels were `text-xs` and `truncate`, so a long label silently lost its end
 *    rather than wrapping. They are `.type-meta` at 15px and they wrap.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type Kind = "private_or_international" | "b2b_ground_handling";

const SERVICES = [
  "Airport and gateway transfers",
  "Inner line permits",
  "Accommodation",
  "Full ground handling",
  "Vehicles and drivers",
  "Local coordinator",
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Errors = Partial<Record<"name" | "email" | "company_name", string>>;

function validate(form: FormData, isB2B: boolean): Errors {
  const errors: Errors = {};
  const value = (key: string) => String(form.get(key) ?? "").trim();

  if (!value("name")) errors.name = "We would like to know who we are writing back to.";

  const email = value("email");
  if (!email) errors.email = "An email address is how the proposal reaches you.";
  else if (!EMAIL.test(email)) errors.email = "That does not look like an email address.";

  if (isB2B && !value("company_name")) {
    errors.company_name = "Which company are you writing on behalf of?";
  }
  return errors;
}

export function SpecialistEnquiryForm({ kind }: { kind: Kind }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const attempted = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const isB2B = kind === "b2b_ground_handling";

  function revalidate() {
    if (!attempted.current || !formRef.current) return;
    setErrors(validate(new FormData(formRef.current), isB2B));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    attempted.current = true;

    const found = validate(f, isB2B);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(`f-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    const get = (k: string) => {
      const v = f.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };

    setState("sending");
    setFailure(null);
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
        setFailure(data.detail ?? "We could not send that. Please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setFailure("We could not reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <FormSuccess
        title={isB2B ? "Your enquiry has reached us." : "Your request has reached us."}
        actions={
          <>
            <QuietAction href="/journeys">See the journeys</QuietAction>
            <QuietAction href="/plan">Read the planning guide</QuietAction>
          </>
        }
      >
        <p>
          {isB2B
            ? "One of the three of us will read this and reply. If we cannot handle the volume or the dates you need, we will say so rather than take the enquiry and work it out later."
            : "One of the three of us will read this and write back to arrange a call at a time that is reasonable where you are. The outcome of that call is a proposal, not a booking."}
        </p>
      </FormSuccess>
    );
  }

  const busy = state === "sending";

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      aria-busy={busy}
      noValidate
      className="space-y-[var(--space-xl)]"
    >
      <FormGroup
        legend="How we reach you"
        note={
          isB2B
            ? "The only three things this form insists on. Everything below is optional."
            : "The only two things this form insists on. Everything below is optional, and the call is what the rest is for."
        }
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            name="name"
            label="Your name"
            autoComplete="name"
            error={errors.name}
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
          <Field
            name="phone"
            label="Phone or WhatsApp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            optional
          />
          {isB2B && (
            <Field
              name="company_name"
              label="Company"
              autoComplete="organization"
              error={errors.company_name}
              onInput={revalidate}
            />
          )}
        </div>
      </FormGroup>

      {isB2B ? (
        <>
          <FormGroup legend="Your company">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field name="company_role" label="Your role" optional />
              <Field name="company_website" label="Website" optional />
              <Field
                name="company_registration"
                label="GST or registration number"
                optional
                hint="Not checked now. It is a starting point for the conversation."
              />
              <Field
                name="season_of_interest"
                label="Season you are asking about"
                optional
              />
            </div>
          </FormGroup>

          <FormGroup
            legend="What you need from us"
            note="Tick as many as apply. None of it is a commitment."
          >
            <div className="grid gap-x-8 sm:grid-cols-2">
              {SERVICES.map((service) => (
                <CheckRow key={service} name="services_needed" value={service}>
                  {service}
                </CheckRow>
              ))}
            </div>
            <div className="mt-6 sm:max-w-[26rem]">
              <Field
                name="volume_estimate"
                label="Rough volume"
                optional
                hint="An estimate is fine. We will treat it as one."
              />
            </div>
          </FormGroup>
        </>
      ) : (
        <>
          <FormGroup legend="Who is travelling">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                name="country"
                label="Country you are travelling from"
                autoComplete="country-name"
                optional
              />
              <Field
                name="group_size"
                label="How many of you"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                optional
              />
              <Field
                name="age_range"
                label="Age range"
                optional
                hint="62 to 74, one post surgery, tells us more than two numbers do."
                className="sm:col-span-2"
              />
            </div>
          </FormGroup>

          <FormGroup legend="Dates, and how firm they are">
            <div className="grid gap-6">
              <Field
                name="date_flexibility"
                label="When you are thinking of travelling"
                rows={2}
                optional
                hint="The week after Diwali, or next year if the passes are bad, is a real answer."
              />
              <Field
                name="consultation_window"
                label="When you can talk"
                optional
                hint="In your own local terms. We will work around it."
              />
              <Field
                name="gateway_needs"
                label="Airport and gateway"
                rows={2}
                optional
              />
            </div>
          </FormGroup>

          <FormGroup legend="What the journey should feel like">
            <div className="grid gap-6">
              <Field
                name="experience_preference"
                label="Trekking experience and comfort"
                rows={2}
                optional
              />
              <Field name="interests" label="What draws you to this" rows={2} optional />
            </div>
          </FormGroup>
        </>
      )}

      <FormGroup legend={isB2B ? "Anything else we should know" : "What you are unsure about"}>
        <Field
          name="primary_concern"
          label={isB2B ? "Tell us in your own words" : "Tell us in your own words"}
          rows={4}
          optional
        />
      </FormGroup>

      {!isB2B && (
        /*
          Doc 03: "Any accessibility or support needs the traveller CHOOSES to
          disclose." A labelled group and not a panel: a box drawn around this one
          question makes it look like a form somebody has to clear, and a required
          health field on a first contact is both a worse experience and a worse
          data-protection position.
        */
        <FormGroup
          legend="Accessibility or support needs"
          note="Only if you want to. It helps us plan honestly, and it is never shown to anybody outside the three of us."
        >
          <Field
            name="accessibility_needs"
            label="Anything we should plan around"
            rows={3}
            optional
          />
        </FormGroup>
      )}

      {state === "error" && failure && <FormAlert>{failure}</FormAlert>}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Submit busy={busy}>
          {isB2B ? "Send enquiry" : "Request a consultation"}
        </Submit>
        <p aria-live="polite" className="type-meta text-tone-body">
          {busy ? "Sending your enquiry." : ""}
        </p>
      </div>

      <p className="type-meta measure-meta text-tone-body">
        We will never ask for identity documents or payment details through this form.
      </p>
    </form>
  );
}
