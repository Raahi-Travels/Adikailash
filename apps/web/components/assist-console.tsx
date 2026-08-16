"use client";

import { useState } from "react";

/**
 * Where a coordinator asks the assistant for a draft.
 *
 * Two decisions shape this screen.
 *
 * **The evidence sits under the draft, always.** Not behind a disclosure, not on
 * hover. Doc 08 requires a source reference for operational answers, and a citation
 * somebody has to click is a citation nobody checks. The passages are the thing being
 * reviewed; the draft is a convenience on top of them.
 *
 * **A refusal is not an error.** It renders as guidance for the coordinator, in the
 * same visual weight as an answer, because "this needs a person and a doctor" is the
 * correct and useful output for a question about somebody's heart — not a failure of
 * the tool. Styling it as a warning would teach people to retry until it gives in.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type Passage = {
  kind: string;
  title: string;
  text: string;
  source_ref: string;
  url_path: string | null;
  score: number;
};

type Result = {
  answer: string;
  citations: string[];
  refusal: string | null;
  staff_guidance: string | null;
  needs_human: boolean;
  model: string | null;
  quoted_status: string | null;
  passages: Passage[];
};

const REFUSAL_LABEL: Record<string, string> = {
  medical: "Medical: a person, and a doctor",
  commercial: "Price or policy: a person decides",
  promise: "Cannot be promised",
  complaint: "Complaint: needs an owner",
  status_stale: "Our last check is too old to repeat",
  no_grounding: "We have not published this",
};

export function AssistConsole() {
  const [result, setResult] = useState<Result | null>(null);
  const [state, setState] = useState<"idle" | "asking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = String(new FormData(event.currentTarget).get("question") ?? "");
    setState("asking");
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin/assist`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        setError(`The assistant returned ${res.status}.`);
        setState("error");
        return;
      }
      setResult(await res.json());
      setState("idle");
    } catch {
      setError("Could not reach the API.");
      setState("error");
    }
  }

  return (
    <div className="mt-8">
      <form onSubmit={ask} className="flex flex-wrap items-end gap-3">
        <label className="min-w-72 flex-1">
          <span className="text-xs text-tone-muted">Their question</span>
          <input
            name="question"
            required
            minLength={3}
            placeholder="Where do I get the inner line permit?"
            className="mt-1 w-full rounded-md bg-white/[0.06] px-3 py-2 text-[15px] text-tone-strong ring-1 ring-tone-line focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </label>
        <button
          type="submit"
          disabled={state === "asking"}
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight disabled:opacity-60"
        >
          {state === "asking" ? "Looking…" : "Draft a reply"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-status-suspended">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          {result.refusal ? (
            /* Same weight as an answer. This *is* the answer. */
            <section className="rounded-lg bg-white/[0.05] px-5 py-5 ring-1 ring-tone-line">
              <h2 className="text-sm text-tone-muted">
                {REFUSAL_LABEL[result.refusal] ?? result.refusal}
              </h2>
              <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-tone-body">
                {result.staff_guidance}
              </p>
            </section>
          ) : (
            <section className="rounded-lg bg-white/[0.05] px-5 py-5 ring-1 ring-tone-line">
              <h2 className="text-sm text-tone-muted">
                Draft {result.model ? `· ${result.model}` : "· not generated"}
              </h2>
              {result.answer ? (
                <p className="mt-3 max-w-[70ch] whitespace-pre-wrap text-[15px] leading-relaxed">
                  {result.answer}
                </p>
              ) : (
                <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-tone-body">
                  {result.staff_guidance}
                </p>
              )}
            </section>
          )}

          {result.quoted_status && (
            <section className="rounded-lg bg-status-limited/10 px-5 py-5 ring-1 ring-status-limited/25">
              <h2 className="text-sm text-tone-body">Verified route record</h2>
              <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-tone-body">
                {result.quoted_status}
              </p>
              <p className="mt-2 text-xs text-tone-muted">
                Send this with its timestamp. Without it, it is a claim about now
                rather than a record of a check.
              </p>
            </section>
          )}

          {result.passages.length > 0 && (
            <section>
              <h2 className="text-sm text-tone-muted">
                What it was allowed to use. Check the draft against these
              </h2>
              <ul className="mt-3 space-y-3">
                {result.passages.map((p) => (
                  <li
                    key={p.source_ref}
                    className="rounded-md bg-white/[0.03] px-4 py-3 ring-1 ring-tone-line"
                  >
                    <p className="text-sm text-tone-body">
                      {p.title}
                      <span className="ml-2 text-xs text-tone-muted">
                        {p.source_ref} · {p.score}
                      </span>
                    </p>
                    <p className="mt-1.5 max-w-[70ch] text-[15px] leading-relaxed text-tone-body">
                      {p.text}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="border-t border-tone-line pt-5 text-xs leading-relaxed text-tone-muted">
            Read it before you send it. It answers only from our own published
            content, which means it is wrong whenever that content is, and it has no
            way of knowing that.
          </p>
        </div>
      )}
    </div>
  );
}
