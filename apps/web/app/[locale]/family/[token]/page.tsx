import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { brand, buildMetadata, display } from "@/lib/brand";
import type { Locale } from "@/lib/api";

/**
 * What a family member at home sees (doc 05, P1).
 *
 * The whole point of this page is reassurance for somebody who is not travelling and
 * is worried. So it is written for a reader who is anxious, possibly elderly, and
 * quite likely reading it on a phone that was handed to them:
 *
 *   - The check-in comes first, because it is the thing they opened this to see.
 *   - Silence is stated as silence. "No check-in since yesterday evening" is far
 *     kinder than an empty space, which a worried person fills in themselves.
 *   - Nothing here updates live, so nothing pretends to. Every timestamp is shown.
 *
 * The API returns only what this page may show — see `api.domain.sharing`, where the
 * projection is constructed rather than filtered. There is no client-side redaction
 * here, and there must never be: a page that receives sensitive data and hides it has
 * already sent it.
 *
 * `noindex` because the URL is a capability token.
 */

export const metadata = {
  ...buildMetadata({
    title: "Following the journey",
    description: "Where the group is, and who to call.",
    path: "/family",
  }),
  robots: { index: false, follow: false },
};

type FamilyView = {
  journey_name: string;
  starts_on: string | null;
  ends_on: string | null;
  traveller_first_names: string[];
  days: { day: number; on_date: string | null; title: string; staying_at: string | null }[];
  contacts: { label: string; phone: string; note: string | null }[];
  latest_check_in: { at: string; note: string; posted_by: string } | null;
  route_notices: string[];
  shared_by: string | null;
  shared_with_label: string | null;
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Day and month only — the year is already in the header above the list. */
function formatDayAndMonth(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function sinceText(at: string) {
  const hours = Math.floor((Date.now() - new Date(at).getTime()) / 3_600_000);
  if (hours < 1) return "in the last hour";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ locale: Locale; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  // No cache. A relative refreshing this page wants the latest check-in, and a
  // stale one is the specific thing that makes this page worse than a phone call.
  const res = await fetch(`${BASE}/family/${encodeURIComponent(token)}`, {
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) notFound();
  const view: FamilyView = await res.json();

  const today = new Date().toISOString().slice(0, 10);
  const currentDay = view.days.find((d) => d.on_date === today);

  return (
    <main id="main" data-quiet-page className="flex-1 register-dark px-4 py-14 text-tone-strong sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        {/*
          Named, deliberately. This page is opened from a forwarded link and asks a
          worried person to trust a phone number on it — an unbranded page doing that
          is indistinguishable from a scam.
        */}
        <p className="font-serif text-base tracking-wide text-tone-body">
          {display(brand.identity.name)}
        </p>

        {/* Built as one string: JSX would insert whitespace before the comma. */}
        <p className="mt-6 text-sm text-tone-muted">
          {`${view.shared_by ? `${view.shared_by} shared this with you` : "Shared with you"}${
            view.shared_with_label ? `, ${view.shared_with_label}` : ""
          }.`}
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
          {view.journey_name}
        </h1>
        <p className="mt-2 text-[15px] text-tone-body">
          {formatDate(view.starts_on)} to {formatDate(view.ends_on)}
          {view.traveller_first_names.length > 0 && (
            <> · {view.traveller_first_names.join(", ")}</>
          )}
        </p>

        {/*
          First on the page. This is what somebody opened the link to find, and
          burying it under an itinerary would be a failure of judgement about who is
          reading.
        */}
        <section className="mt-10 rounded-lg bg-white/[0.05] px-5 py-5 ring-1 ring-tone-line">
          <h2 className="text-sm text-tone-muted">Latest word from the group</h2>
          {view.latest_check_in ? (
            <>
              <p className="mt-3 text-lg leading-relaxed">{view.latest_check_in.note}</p>
              <p className="mt-3 text-sm text-tone-muted">
                {sinceText(view.latest_check_in.at)}, from {view.latest_check_in.posted_by}.
              </p>
            </>
          ) : (
            /*
              Say the silence out loud. An empty box is filled in by a worried
              person with something worse than the truth, and on this route there
              are two-day stretches with no signal at all.
            */
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-tone-body">
              No check-in yet. There is no mobile network for long stretches above
              Dharchula, so a gap of a day or two is normal and is not a sign that
              anything is wrong. The coordinator posts one whenever they get signal.
            </p>
          )}
        </section>

        {currentDay && (
          <section className="mt-8">
            <h2 className="text-sm text-tone-muted">Today</h2>
            <p className="mt-2 text-lg">{currentDay.title}</p>
            {currentDay.staying_at && (
              <p className="mt-1 text-[15px] text-tone-body">
                Staying at {currentDay.staying_at} tonight.
              </p>
            )}
          </section>
        )}

        {view.route_notices.length > 0 && (
          <section className="mt-8 rounded-lg bg-status-limited/10 px-5 py-5 ring-1 ring-status-limited/25">
            <h2 className="text-sm text-tone-body">On the road right now</h2>
            <ul className="mt-3 space-y-2">
              {view.route_notices.map((notice, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-tone-body">
                  {notice}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-tone-muted">
              This is the same public route information anyone can read on our status
              page. It is not specific to this group.
            </p>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-sm text-tone-muted">The plan, broadly</h2>
          <ol className="mt-4 space-y-3">
            {view.days.map((day) => (
              <li
                key={day.day}
                className={`flex gap-4 rounded-md px-3 py-2.5 ${
                  day.on_date === today ? "bg-white/[0.06] ring-1 ring-gold/30" : ""
                }`}
              >
                <span className="w-14 shrink-0 pt-0.5 text-xs text-tone-muted">
                  {formatDayAndMonth(day.on_date) ?? `Day ${day.day}`}
                </span>
                <span className="text-[15px] leading-relaxed">
                  {day.title}
                  {day.staying_at && (
                    <span className="block text-sm text-tone-muted">
                      Staying at {day.staying_at}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-tone-muted">
            Days change. The road decides, and the coordinator will move things around
            for weather or altitude without asking anybody first. That is the right
            call to make on the ground.
          </p>
        </section>

        {view.contacts.length > 0 && (
          <section className="mt-10 border-t border-tone-line pt-8">
            <h2 className="text-sm text-tone-muted">If you need to reach somebody</h2>
            <ul className="mt-4 space-y-4">
              {view.contacts.map((contact, i) => (
                <li key={i}>
                  <p className="text-[15px]">{contact.label}</p>
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone.replace(/\s/g, "")}`}
                      className="text-lg text-gold underline underline-offset-4"
                    >
                      {contact.phone}
                    </a>
                  )}
                  {contact.note && (
                    <p className="mt-1 text-sm text-tone-muted">{contact.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 border-t border-tone-line pt-6 text-xs leading-relaxed text-tone-muted">
          This page deliberately does not show documents, payments or anything
          personal about the travellers. The person who shared it with you can turn
          this link off at any time.
        </p>
      </div>
    </main>
  );
}
