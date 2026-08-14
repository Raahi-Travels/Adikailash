import { revalidatePath } from "next/cache";

import { Caution } from "@/components/icons";
import { adminGet, adminPost } from "@/lib/admin-api";

/**
 * The post-trip feedback queue, and the gate in front of a public review.
 *
 * Doc 07 numbers the flow: private feedback, then resolve material complaints, then
 * ask for a public review. This screen is where step 2 happens, and the ordering is
 * enforced by the API — the ask returns 409 while anything is open, with no override.
 *
 * So the page does not offer a disabled "ask anyway" button. A greyed control invites
 * somebody to look for the way round it; the honest interface shows what has to be
 * settled first and nothing else.
 */

export const dynamic = "force-dynamic";

const BUTTON =
  "rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight transition-transform active:scale-[0.98]";

type Complaint = {
  id: number;
  dimension: string;
  rating: number | null;
  detail: string | null;
  resolution_state: string;
  resolution_note: string | null;
  resolved_by: string | null;
};

type Feedback = {
  id: number;
  reservation_reference: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  recommend_score: number | null;
  what_went_well: string | null;
  what_went_wrong: string | null;
  ratings: Record<string, number>;
  complaints: Complaint[];
  open_complaint_count: number;
  review_request_blockers: string[];
  already_asked: boolean;
};

async function resolve(formData: FormData) {
  "use server";
  const id = String(formData.get("complaint_id"));
  await adminPost(`/admin/complaints/${id}/resolve`, {
    state: String(formData.get("state")),
    resolution_note: String(formData.get("resolution_note")),
  });
  revalidatePath("/admin/feedback");
}

async function askForReview(formData: FormData) {
  "use server";
  const id = String(formData.get("feedback_id"));
  await adminPost(`/admin/feedback/${id}/review-request`, {
    platform: String(formData.get("platform")),
    may_publish_written_review: formData.get("written") === "on",
    may_publish_images: formData.get("images") === "on",
    may_publish_story: formData.get("story") === "on",
  });
  revalidatePath("/admin/feedback");
}

export default async function FeedbackPage() {
  const rows = (await adminGet<Feedback[]>("/admin/feedback")) ?? [];

  return (
    <>
      <h1 className="text-2xl font-medium">Post-trip feedback</h1>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-ink-inverse/65">
        Private, and it stays private. Anything a traveller flagged has to be settled —
        with a note saying what was actually done — before we ask them for anything
        public. That order is the whole point of collecting this first.
      </p>

      {rows.length === 0 && (
        <p className="mt-8 text-[15px] text-ink-inverse/55">
          No feedback submitted yet.
        </p>
      )}

      <ul className="mt-8 space-y-6">
        {rows.map((f) => (
          <li
            key={f.id}
            className="rounded-lg bg-white/[0.04] px-5 py-5 ring-1 ring-white/10"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-lg">
                {f.reservation_reference ?? `Feedback ${f.id}`}
                {f.submitted_by && (
                  <span className="ml-2 text-sm text-ink-inverse/50">
                    from {f.submitted_by}
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-inverse/50">
                {f.recommend_score !== null
                  ? `${f.recommend_score}/10 would recommend`
                  : "recommendation unanswered"}
              </p>
            </div>

            {f.what_went_wrong && (
              <p className="mt-4 rounded-md bg-status-suspended/10 px-4 py-3 text-[15px] leading-relaxed ring-1 ring-status-suspended/25">
                {f.what_went_wrong}
              </p>
            )}
            {f.what_went_well && (
              <p className="mt-3 text-[15px] leading-relaxed text-ink-inverse/70">
                {f.what_went_well}
              </p>
            )}

            {f.complaints.filter((c) => c.resolution_state === "open").length > 0 && (
              <div className="mt-5 space-y-4">
                {f.complaints
                  .filter((c) => c.resolution_state === "open")
                  .map((c) => (
                    <form
                      key={c.id}
                      action={resolve}
                      className="rounded-md bg-white/[0.03] px-4 py-3 ring-1 ring-white/10"
                    >
                      <input type="hidden" name="complaint_id" value={c.id} />
                      <p className="flex items-center gap-2 text-sm">
                        <Caution className="size-4 shrink-0 text-status-suspended" />
                        {c.dimension.replaceAll("_", " ")}
                        {c.rating !== null && (
                          <span className="text-ink-inverse/45">rated {c.rating}/5</span>
                        )}
                      </p>
                      {c.detail && (
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-inverse/60">
                          {c.detail}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="min-w-64 flex-1">
                          <span className="text-xs text-ink-inverse/50">
                            What was actually done
                          </span>
                          <input
                            name="resolution_note"
                            required
                            minLength={10}
                            className="mt-1 w-full rounded-md bg-white/[0.06] px-2.5 py-1.5 text-sm text-ink-inverse ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-gold"
                          />
                        </label>
                        <select
                          name="state"
                          className="rounded-md bg-white/[0.06] px-2.5 py-1.5 text-sm text-ink-inverse ring-1 ring-white/15"
                        >
                          <option value="resolved">Resolved</option>
                          <option value="acknowledged">Acknowledged</option>
                        </select>
                        <button type="submit" className={BUTTON}>
                          Record
                        </button>
                      </div>
                    </form>
                  ))}
              </div>
            )}

            {f.review_request_blockers.length > 0 ? (
              /* No disabled button. A greyed control invites somebody to find the
                 way round it; this shows what has to happen instead. */
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-sm text-ink-inverse/50">
                  Before we can ask for a public review:
                </p>
                <ul className="mt-2 space-y-1.5">
                  {f.review_request_blockers.map((b, i) => (
                    <li
                      key={i}
                      className="max-w-[70ch] text-sm leading-relaxed text-ink-inverse/70"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <form action={askForReview} className="mt-5 border-t border-white/10 pt-4">
                <input type="hidden" name="feedback_id" value={f.id} />
                <p className="text-sm text-ink-inverse/50">
                  Nothing outstanding. Ask separately for each permission — agreeing to
                  write a sentence is not agreeing to a photograph.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <select
                    name="platform"
                    className="rounded-md bg-white/[0.06] px-2.5 py-1.5 text-sm text-ink-inverse ring-1 ring-white/15"
                  >
                    <option value="google">Google</option>
                    <option value="tripadvisor">TripAdvisor</option>
                    <option value="own_site">Our own site</option>
                  </select>
                  <label className="flex items-center gap-2 text-ink-inverse/70">
                    <input type="checkbox" name="written" className="size-4 accent-gold" />
                    Written review
                  </label>
                  <label className="flex items-center gap-2 text-ink-inverse/70">
                    <input type="checkbox" name="images" className="size-4 accent-gold" />
                    Images
                  </label>
                  <label className="flex items-center gap-2 text-ink-inverse/70">
                    <input type="checkbox" name="story" className="size-4 accent-gold" />
                    Their story
                  </label>
                  <button type="submit" className={BUTTON}>
                    Record that we asked
                  </button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
