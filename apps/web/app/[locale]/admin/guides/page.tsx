import { Caution } from "@/components/icons";
import { adminGet } from "@/lib/admin-api";

/**
 * The guide library, ordered by what needs a person.
 *
 * Doc 07 makes original local information the acquisition engine, and doc 03 requires
 * every guide to carry a last-reviewed date and a content owner. That commitment is
 * the thing that decays: a guide reviewed in March and still claiming currency in
 * October is making a promise nobody kept, and on permits or road conditions it is
 * actively misleading rather than merely old.
 *
 * So the list is sorted stalest first — the API does this, and the page does not
 * offer a way to re-sort it. A library sorted alphabetically is a library where the
 * out-of-date page sits quietly between two fresh ones.
 *
 * The time-sensitive marker matters more than the age. A stale packing list is
 * untidy; a stale permit guide sends somebody to the wrong office.
 */

export const dynamic = "force-dynamic";

type Guide = {
  slug: string;
  cluster: string;
  title: string;
  answer: string;
  is_pillar: boolean;
  author: string | null;
  reviewed_by: string | null;
  last_reviewed_at: string | null;
  next_review_due: string | null;
  freshness: string;
  freshness_label: string;
  is_time_sensitive: boolean;
  published_at: string | null;
};

type Gap = { question: string; asked_at: string; locale: string };

const TONE: Record<string, string> = {
  stale: "text-status-suspended",
  due_soon: "text-status-limited",
  current: "text-tone-muted",
};

export default async function GuidesPage() {
  const guides = (await adminGet<Guide[]>("/admin/guides")) ?? [];
  // Real questions the assistant had nothing to answer from. Doc 07 wants a content
  // plan driven by conversations rather than a keyword tool, and this is that list
  // written by travellers.
  const gaps = (await adminGet<Gap[]>("/admin/assist/gaps")) ?? [];

  return (
    <>
      <h1 className="text-2xl font-medium">Guides</h1>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-tone-body">
        Sorted by what needs a person, not alphabetically. Every guide carries a
        promise to re-check it; the ones at the top are the ones where that promise
        has run out.
      </p>

      {gaps.length > 0 && (
        <section className="mt-8 rounded-lg bg-white/[0.04] px-5 py-5 ring-1 ring-tone-line">
          <h2 className="text-sm text-tone-muted">
            Asked, and we had nothing published
          </h2>
          <ul className="mt-3 space-y-1.5">
            {gaps.slice(0, 8).map((g, i) => (
              <li key={i} className="text-[15px] leading-relaxed text-tone-body">
                {g.question}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-tone-muted">
            Real questions from the assistant, not a keyword tool. Each one is a guide
            somebody already wanted.
          </p>
        </section>
      )}

      {guides.length === 0 ? (
        <p className="mt-8 text-[15px] text-tone-muted">No guides yet.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {guides.map((g) => (
            <li
              key={g.slug}
              className="rounded-lg bg-white/[0.04] px-5 py-4 ring-1 ring-tone-line"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-[15px]">
                  {g.title}
                  {g.is_pillar && (
                    <span className="ml-2 text-xs text-tone-muted">pillar</span>
                  )}
                </p>
                <p
                  className={`flex items-center gap-1.5 text-sm ${TONE[g.freshness] ?? ""}`}
                >
                  {g.is_time_sensitive && g.freshness !== "current" && (
                    <Caution className="size-4 shrink-0" />
                  )}
                  {g.freshness_label}
                </p>
              </div>
              <p className="mt-1.5 max-w-[74ch] text-sm leading-relaxed text-tone-body">
                {g.answer}
              </p>
              <p className="mt-2 text-xs text-tone-muted">
                {g.cluster.replaceAll("_", " ")} · {g.slug}
                {g.reviewed_by
                  ? ` · reviewed by ${g.reviewed_by}`
                  : " · never reviewed"}
                {!g.published_at && " · draft"}
                {g.is_time_sensitive && " · time-sensitive"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
