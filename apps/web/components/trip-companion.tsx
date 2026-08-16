"use client";

import { useEffect, useState } from "react";

/**
 * The during-trip companion (doc 05).
 *
 * Client-rendered on purpose, which is the opposite of the rest of this site. The
 * reason is the reason for the whole feature: this is read where there is no network.
 * A server-rendered page needs a round trip every time it is opened; a client one
 * with a cached payload opens from the traveller's own phone.
 *
 * Three rules the design follows, all from doc 05's closing line — "The trip
 * companion should not encourage phone use at moments where attention, safety or
 * reverence matter":
 *
 *   1. Today and the next movement come first. Everything else is below the fold.
 *      Somebody standing in a courtyard at 5am should find what they need without
 *      scrolling or thinking.
 *   2. Cached data says it is cached, with its age. "Saved 9 hours ago" is honest;
 *      showing an old itinerary as though it were live is how somebody misses a
 *      changed pickup time.
 *   3. No refresh prompts, no badges, nothing that asks to be looked at again.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
const STORE_KEY = "trip-companion-payload";

type Day = {
  day: number;
  on_date: string | null;
  title: string;
  travel_note: string | null;
  altitude_note: string | null;
  staying_at: string | null;
  stay_note: string | null;
  is_route_dependent: boolean;
  is_today: boolean;
};

type Companion = {
  reference: string;
  journey_name: string;
  starts_on: string | null;
  ends_on: string | null;
  state: string;
  days: Day[];
  today: Day | null;
  next_movement: Day | null;
  contacts: { label: string; phone: string; note: string | null }[];
  route_notices: string[];
  latest_check_in: { at: string; note: string; posted_by: string } | null;
  generated_at: string;
};

function age(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function DayCard({ day, heading }: { day: Day; heading: string }) {
  return (
    <section className="rounded-lg bg-white/[0.05] px-5 py-5 ring-1 ring-tone-line">
      <h2 className="text-sm text-tone-muted">{heading}</h2>
      <p className="mt-2 font-serif text-2xl leading-snug">{day.title}</p>

      {day.travel_note && (
        <p className="mt-3 text-[15px] leading-relaxed text-tone-body">
          {day.travel_note}
        </p>
      )}
      {day.altitude_note && (
        <p className="mt-3 rounded-md bg-status-limited/10 px-3 py-2.5 text-[15px] leading-relaxed text-tone-body ring-1 ring-status-limited/25">
          {day.altitude_note}
        </p>
      )}
      {day.staying_at && (
        <p className="mt-3 text-[15px] text-tone-body">
          Tonight: {day.staying_at}
          {day.stay_note && (
            <span className="mt-1 block text-sm text-tone-muted">{day.stay_note}</span>
          )}
        </p>
      )}
      {day.is_route_dependent && (
        <p className="mt-3 text-sm leading-relaxed text-tone-muted">
          This day depends on the route being open. Your coordinator will tell you on
          the morning, not before.
        </p>
      )}
    </section>
  );
}

export function TripCompanion({ token }: { token: string }) {
  const [data, setData] = useState<Companion | null>(null);
  const [fromCache, setFromCache] = useState(false);
  // Distinct from `fromCache`. A cached render while the request is still in flight
  // is not evidence of anything; only a failed request is. Saying "no signal" during
  // the half-second before the network answers would be a small lie on a page whose
  // entire value is being straight about how old its information is.
  const [unreachable, setUnreachable] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    // Register the worker so the *document* survives losing signal. Without it the
    // page cannot load at all above Dharchula, and a cached payload nobody can reach
    // is no better than none.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/trip-sw.js").catch(() => {
        // A refused registration (private mode, unsupported browser) degrades to an
        // online-only page. Worth nothing at altitude, but not worth an error.
      });
    }

    const controller = new AbortController();

    // Cached copy first, then the network replaces it. The traveller sees something
    // immediately rather than a spinner that, with no signal, never resolves.
    //
    // The cache read happens here rather than as lazy initial state because
    // `localStorage` does not exist during server rendering — seeding state from it
    // would either throw on the server or hydrate to different markup than the
    // server sent.
    void (async () => {
      try {
        const stored = localStorage.getItem(STORE_KEY);
        if (stored && !controller.signal.aborted) {
          setData(JSON.parse(stored));
          setFromCache(true);
          setState("ready");
        }
      } catch {
        // Storage disabled or the stored JSON is corrupt. Fall through to the
        // network; a broken cache must not be worse than no cache.
      }

      try {
        const response = await fetch(
          `${BASE}/traveller/companion?token=${encodeURIComponent(token)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(String(response.status));
        const fresh: Companion = await response.json();
        if (controller.signal.aborted) return;

        setData(fresh);
        setFromCache(false);
        setUnreachable(false);
        setState("ready");
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
        } catch {
          // Over quota or blocked. The page works right now; it just will not work
          // later without signal.
        }
      } catch {
        // Offline with nothing stored is the only real failure. Offline *with*
        // something stored is the case this whole component exists for, so the
        // cached render is left standing.
        if (!controller.signal.aborted) {
          setUnreachable(true);
          setState((current) => (current === "ready" ? current : "error"));
        }
      }
    })();

    return () => controller.abort();
  }, [token]);

  if (state === "loading") {
    return <p className="text-[15px] text-tone-muted">Loading your journey…</p>;
  }

  if (state === "error" || !data) {
    return (
      <div className="rounded-lg bg-white/[0.04] px-5 py-5 ring-1 ring-tone-line">
        <p className="max-w-[52ch] text-[15px] leading-relaxed text-tone-body">
          We could not load your journey, and there is no saved copy on this phone.
          Open this page once while you still have signal. After that it works
          without a network.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl leading-tight">{data.journey_name}</h1>
        <p className="mt-1.5 text-sm text-tone-muted">
          {data.reference}
          {" · "}
          {/*
            The honesty that makes an offline page trustworthy. A traveller who knows
            this is nine hours old will ask somebody about the pickup time. One who
            thinks it is live will not. "Could not reach us" is only claimed once the
            request has actually failed.
          */}
          {fromCache ? (
            <span className="text-status-limited">
              Saved {age(data.generated_at)}
              {unreachable && " · no connection"}
            </span>
          ) : (
            <>Updated {age(data.generated_at)}</>
          )}
        </p>
      </header>

      {data.today ? (
        <DayCard day={data.today} heading="Today" />
      ) : (
        data.next_movement && <DayCard day={data.next_movement} heading="First day" />
      )}

      {data.today && data.next_movement && (
        <DayCard day={data.next_movement} heading="Tomorrow" />
      )}

      {data.contacts.length > 0 && (
        <section className="rounded-lg bg-white/[0.05] px-5 py-5 ring-1 ring-tone-line">
          <h2 className="text-sm text-tone-muted">If something goes wrong</h2>
          <ul className="mt-3 space-y-4">
            {data.contacts.map((c, i) => (
              <li key={i}>
                <p className="text-[15px]">{c.label}</p>
                {c.phone && (
                  <a
                    href={`tel:${c.phone.replace(/\s/g, "")}`}
                    className="text-xl text-gold underline underline-offset-4"
                  >
                    {c.phone}
                  </a>
                )}
                {c.note && <p className="mt-1 text-sm text-tone-muted">{c.note}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-tone-muted">
            Your coordinator is with the group. If you cannot find them and it is
            urgent, call the number above. Somebody answers it.
          </p>
        </section>
      )}

      {data.latest_check_in && (
        <section>
          <h2 className="text-sm text-tone-muted">Last check-in</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-tone-body">
            {data.latest_check_in.note}
          </p>
          <p className="mt-1 text-sm text-tone-muted">
            {age(data.latest_check_in.at)}, {data.latest_check_in.posted_by}
          </p>
        </section>
      )}

      {data.route_notices.length > 0 && (
        <section className="rounded-lg bg-status-limited/10 px-5 py-5 ring-1 ring-status-limited/25">
          <h2 className="text-sm text-tone-body">Route notices</h2>
          <ul className="mt-3 space-y-2">
            {data.route_notices.map((n, i) => (
              <li key={i} className="text-[15px] leading-relaxed text-tone-body">
                {n}
              </li>
            ))}
          </ul>
          {fromCache && unreachable && (
            <p className="mt-3 text-xs leading-relaxed text-tone-muted">
              These were current when this copy was saved. Ask your coordinator before
              relying on them.
            </p>
          )}
        </section>
      )}

      <details className="rounded-lg bg-white/[0.03] px-5 py-4 ring-1 ring-tone-line">
        <summary className="cursor-pointer text-sm text-tone-body">
          The whole journey, day by day
        </summary>
        <ol className="mt-4 space-y-4">
          {data.days.map((d) => (
            <li key={d.day} className={d.is_today ? "text-tone-strong" : "text-tone-body"}>
              <p className="text-[15px]">
                <span className="text-tone-muted">Day {d.day}</span> · {d.title}
              </p>
              {d.staying_at && (
                <p className="text-sm text-tone-muted">{d.staying_at}</p>
              )}
            </li>
          ))}
        </ol>
      </details>

      <p className="border-t border-tone-line pt-5 text-xs leading-relaxed text-tone-muted">
        This page works without a network once you have opened it. Nothing on it
        updates by itself. When you have signal again, open it and it will refresh.
      </p>
    </div>
  );
}
