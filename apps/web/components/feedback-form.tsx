"use client";

import { useRef, useState } from "react";

import {
  Field,
  FormAlert,
  FormGroup,
  FormSuccess,
  Submit,
} from "@/components/enquiry-form";

/**
 * The private post-trip form (doc 07 step 1).
 *
 * **Nothing here is published, and the page says so before it asks anything.**
 * Doc 07's whole sequence depends on somebody telling us about a problem before
 * they tell the internet, and that bargain only holds if the page is explicit
 * about which one this is. A form that looks like it might become a public review
 * gets sanitised answers.
 *
 * Ratings start unset rather than at 5. A pre-filled positive default is a thumb
 * on the scale, and doc 03 rules out dark patterns, but it is also just bad data:
 * it makes "did not answer" indistinguishable from "was happy", and the API
 * treats those very differently.
 *
 * The scales were `<button aria-pressed>` with a hidden input behind them, at
 * 32px. They are now real radio groups: arrow keys move through a scale for free,
 * a screen reader announces "3 of 5" rather than "pressed", and every target is
 * 44px. Unsetting a radio is the one thing a radio group cannot do from the
 * keyboard alone, so each row keeps an explicit Clear, which appears only once
 * there is something to clear.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

const DIMENSIONS: { key: string; label: string }[] = [
  { key: "sales_promise_accuracy", label: "Did we deliver what we said we would?" },
  { key: "preparation", label: "Were you prepared for what the journey asked of you?" },
  { key: "pickup_and_transport", label: "Pickup, vehicles and the driving" },
  { key: "accommodation", label: "Where you stayed" },
  { key: "coordinator_support", label: "The coordinator who travelled with you" },
  { key: "route_communication", label: "How we told you about route changes" },
  { key: "spiritual_and_cultural", label: "The experience itself" },
];

/**
 * One option on a scale.
 *
 * The input is `sr-only` and the visible chip is its `peer`, so the whole 44px
 * chip is the label, the tick is the browser's own radio semantics, and the focus
 * ring is the site's gold at the same offset as every other control.
 */
function ScaleOption({
  name,
  value,
  checked,
  onSelect,
}: {
  name: string;
  value: number;
  checked: boolean;
  onSelect: (value: number) => void;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span
        className="type-meta flex size-11 items-center justify-center rounded-pill text-tone-body tabular-nums shadow-[0_0_0_1px_var(--color-field-edge)] peer-checked:bg-tone-strong peer-checked:text-tone-raised peer-checked:shadow-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
      >
        {value}
      </span>
    </label>
  );
}

function ScaleRow({
  name,
  label,
  options,
  /** The eleven-point scale needs the full width, so its question is the legend. */
  labelHidden = false,
}: {
  name: string;
  label: string;
  options: number[];
  labelHidden?: boolean;
}) {
  const [value, setValue] = useState<number | null>(null);
  const groupId = `scale-${name}`;

  return (
    <div
      className={
        labelHidden
          ? "py-1"
          : "grid gap-3 py-1 md:grid-cols-[1fr_auto] md:items-center md:gap-8"
      }
    >
      <span id={groupId} className={labelHidden ? "sr-only" : "type-body measure-card text-tone-body"}>
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-labelledby={groupId} className="flex flex-wrap gap-2">
          {options.map((n) => (
            <ScaleOption
              key={n}
              name={name}
              value={n}
              checked={value === n}
              onSelect={setValue}
            />
          ))}
        </div>
        {/* Always in the layout, so choosing a value does not shunt the scale
            sideways; only hidden from sight and from the tab order until there
            is something for it to clear. */}
        <button
          type="button"
          onClick={() => setValue(null)}
          tabIndex={value === null ? -1 : undefined}
          aria-hidden={value === null ? true : undefined}
          className={`type-meta min-h-11 rounded-pill px-3 text-tone-body underline underline-offset-4 hover:text-tone-strong ${
            value === null ? "invisible" : ""
          }`}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function FeedbackForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<{ message: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const num = (k: string) => {
      const v = f.get(k);
      return typeof v === "string" && v !== "" ? Number(v) : null;
    };
    const str = (k: string) => {
      const v = f.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };

    setState("sending");
    setFailure(null);
    try {
      const res = await fetch(`${BASE}/feedback?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitted_by: str("submitted_by"),
          ...Object.fromEntries(DIMENSIONS.map((d) => [d.key, num(d.key)])),
          recommend_score: num("recommend_score"),
          what_went_well: str("what_went_well"),
          what_went_wrong: str("what_went_wrong"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFailure(data.detail ?? "We could not send that. Please try again.");
        setState("error");
        return;
      }
      setResult(data);
      setState("done");
    } catch {
      setFailure("We could not reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done" && result) {
    return (
      <FormSuccess title="Thank you.">
        <p>{result.message}</p>
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
      <FormGroup legend="Who is writing">
        <div className="sm:max-w-[24rem]">
          <Field name="submitted_by" label="Your name" optional autoComplete="name" />
        </div>
      </FormGroup>

      <FormGroup
        legend="How it went"
        note="One is poor and five is excellent. Leave anything blank that you would rather not answer: blank is not a low score, we record it as unanswered."
      >
        <div className="grid gap-7">
          {DIMENSIONS.map((d) => (
            <ScaleRow
              key={d.key}
              name={d.key}
              label={d.label}
              options={[1, 2, 3, 4, 5]}
            />
          ))}
        </div>
      </FormGroup>

      <FormGroup
        legend="Would you tell somebody else to travel with us?"
        note="Nought is definitely not. Ten is without hesitation."
      >
        <ScaleRow
          name="recommend_score"
          label="On a scale of nought to ten."
          options={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          labelHidden
        />
      </FormGroup>

      <FormGroup legend="In your own words">
        <div className="grid gap-6">
          <Field name="what_went_well" label="What went well" rows={4} optional />
          <Field
            name="what_went_wrong"
            label="What went wrong"
            rows={4}
            optional
            hint="This is the most useful box on the page. Anything you write here reaches a person, and somebody will call you about it."
          />
        </div>
      </FormGroup>

      {state === "error" && failure && <FormAlert>{failure}</FormAlert>}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Submit busy={busy}>Send</Submit>
        <p aria-live="polite" className="type-meta text-tone-body">
          {busy ? "Sending your feedback." : ""}
        </p>
      </div>
    </form>
  );
}
