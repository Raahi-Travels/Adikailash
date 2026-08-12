"use client";

import { useState } from "react";

/**
 * The private post-trip form (doc 07 step 1).
 *
 * **Nothing here is published, and the form says so at the top.** Doc 07's whole
 * sequence depends on somebody telling us about a problem before they tell the
 * internet, and that bargain only holds if the page is explicit about which one this
 * is. A form that looks like it might become a public review gets sanitised answers.
 *
 * Ratings start unset rather than at 5. A pre-filled positive default is a thumb on
 * the scale, and doc 03 rules out dark patterns — but it is also just bad data: it
 * makes "didn't answer" indistinguishable from "was happy", and the API treats those
 * very differently.
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

function Stars({ name }: { name: string }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-1.5">
      {/* Unset by default. `null` posts as unanswered, not as a 1. */}
      <input type="hidden" name={name} value={value ?? ""} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setValue(n === value ? null : n)}
          aria-label={`${n} out of 5`}
          aria-pressed={value === n}
          className={`size-8 rounded-md text-sm transition-colors ${
            value !== null && n <= value
              ? "bg-gold text-midnight"
              : "bg-white/[0.06] text-ink-inverse/40 ring-1 ring-white/15 hover:bg-white/10"
          }`}
        >
          {n}
        </button>
      ))}
      {value !== null && (
        <button
          type="button"
          onClick={() => setValue(null)}
          className="ml-1 text-xs text-ink-inverse/35 underline underline-offset-2"
        >
          clear
        </button>
      )}
    </div>
  );
}

export function FeedbackForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<{ message: string; will_follow_up: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommend, setRecommend] = useState<number | null>(null);

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
    try {
      const res = await fetch(`${BASE}/feedback?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitted_by: str("submitted_by"),
          ...Object.fromEntries(DIMENSIONS.map((d) => [d.key, num(d.key)])),
          recommend_score: recommend,
          what_went_well: str("what_went_well"),
          what_went_wrong: str("what_went_wrong"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail ?? "We could not send that. Please try again.");
        setState("error");
        return;
      }
      setResult(data);
      setState("done");
    } catch {
      setError("We could not reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done" && result) {
    return (
      <div role="status" className="rounded-lg bg-white/[0.04] px-6 py-7 ring-1 ring-white/10">
        <h2 className="font-serif text-2xl">Thank you</h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-inverse/70">
          {result.message}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg bg-white/[0.04] px-6 py-7 ring-1 ring-white/10">
      <label className="block">
        <span className="text-xs text-ink-inverse/50">Your name</span>
        <input
          name="submitted_by"
          className="mt-1 w-full max-w-xs rounded-md bg-white/[0.06] px-3 py-2 text-[15px] text-ink-inverse ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-gold"
        />
      </label>

      <div className="mt-8 space-y-5 border-t border-white/12 pt-7">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="flex flex-wrap items-center justify-between gap-3">
            <span className="max-w-[38ch] text-[15px] leading-relaxed text-ink-inverse/75">
              {d.label}
            </span>
            <Stars name={d.key} />
          </div>
        ))}
        <p className="text-xs text-ink-inverse/35">
          Leave anything blank that you would rather not answer. Blank is not a low
          score — we record it as unanswered.
        </p>
      </div>

      <div className="mt-8 border-t border-white/12 pt-7">
        <span className="text-[15px] leading-relaxed text-ink-inverse/75">
          Would you tell somebody else to travel with us?
        </span>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRecommend(n === recommend ? null : n)}
              aria-pressed={recommend === n}
              className={`size-9 rounded-md text-sm transition-colors ${
                recommend === n
                  ? "bg-gold text-midnight"
                  : "bg-white/[0.06] text-ink-inverse/50 ring-1 ring-white/15 hover:bg-white/10"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-inverse/35">0 = definitely not · 10 = without hesitation</p>
      </div>

      <div className="mt-8 grid gap-5 border-t border-white/12 pt-7">
        <label className="block">
          <span className="text-xs text-ink-inverse/50">What went well</span>
          <textarea
            name="what_went_well"
            rows={3}
            className="mt-1 w-full rounded-md bg-white/[0.06] px-3 py-2 text-[15px] text-ink-inverse ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-inverse/50">What went wrong</span>
          <textarea
            name="what_went_wrong"
            rows={3}
            className="mt-1 w-full rounded-md bg-white/[0.06] px-3 py-2 text-[15px] text-ink-inverse ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-gold"
          />
          <span className="mt-1 block text-xs leading-relaxed text-ink-inverse/40">
            This is the most useful box on the page. Anything you write here reaches a
            person, and somebody will call you about it.
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-7 rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send"}
      </button>

      {state === "error" && error && (
        <p role="alert" className="mt-4 text-sm text-status-suspended">
          {error}
        </p>
      )}
    </form>
  );
}
