import { getTranslations } from "next-intl/server";

import { api, type Locale } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";

/**
 * The live status bar.
 *
 * This is the signature trust device: docs 03 and 07 both single it out as the thing
 * that earns citations and repeat visits. Four things a traveller actually asks
 * before booking: is the road open, are permits moving, what is the weather, and
 * when did you last actually check.
 *
 * Three failure modes are rendered honestly rather than hidden:
 *   - API unreachable  -> "cannot confirm", never "open"
 *   - nothing published -> an empty state that admits it
 *   - anything stale    -> a visible warning, and the timestamp reports the OLDEST
 *                          verification in the set, not the newest
 */

function formatVerified(iso: string, locale: Locale) {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  const time = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(then);

  // Intl rather than a hand-rolled string, so "4 days ago" reads as "4 दिन पहले"
  // instead of leaving English inside an otherwise Devanagari panel.
  const rtf = new Intl.RelativeTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    numeric: "auto",
  });
  const relative =
    mins < 60
      ? rtf.format(-Math.max(mins, 1), "minute")
      : mins < 60 * 24
        ? rtf.format(-Math.round(mins / 60), "hour")
        : rtf.format(-Math.round(mins / 1440), "day");

  return { time, relative };
}

const CONDITION_LABEL: Record<string, string> = {
  clear: "Clear",
  partly_cloudy: "Partly cloudy",
  overcast: "Overcast",
  rain: "Rain",
  heavy_rain: "Heavy rain",
  snow: "Snow",
  heavy_snow: "Heavy snow",
  fog: "Fog",
  storm: "Storm",
  unknown: "Unknown",
};

function Panel({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-0 px-5 py-4 sm:px-6">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-inverse/55">
        {heading}
      </h3>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export async function LiveStatusBar({ locale }: { locale: Locale }) {
  const t = await getTranslations("status");
  const data = await api.status(locale);

  // Unreachable API. Doc 08: "No false 'open' status on stale data."
  if (data === null) {
    return (
      <section
        aria-label="Route status"
        className="mx-auto max-w-6xl rounded-lg bg-himalayan px-6 py-5 text-ink-inverse ring-1 ring-white/10"
      >
        <p className="text-sm">
          <span className="font-medium">Route status is unavailable right now.</span>{" "}
          <span className="text-ink-inverse/70">
            We cannot confirm current conditions from here. Please speak to the team
            before making travel plans.
          </span>
        </p>
      </section>
    );
  }

  // Nothing published yet. An honest empty state beats an invented "All clear".
  if (!data.has_data) {
    return (
      <section
        aria-label="Route status"
        className="mx-auto max-w-6xl rounded-lg bg-himalayan px-6 py-5 text-ink-inverse ring-1 ring-white/10"
      >
        <p className="text-sm">
          <span className="font-medium">No verified route status yet.</span>{" "}
          <span className="text-ink-inverse/70">
            Our coordinators publish conditions once the season opens and checks begin.
          </span>
        </p>
      </section>
    );
  }

  const permitRoutes = data.routes.filter((r) => r.requires_permit);
  const worstPermit =
    permitRoutes.find((r) => r.access === "permit_pending") ??
    permitRoutes.find((r) => r.blocks_sale) ??
    permitRoutes[0];
  const headline =
    data.routes.find((r) => r.blocks_sale) ??
    data.routes.find((r) => r.access !== "open") ??
    data.routes[0];
  const weather = data.weather[0];
  const verified = data.as_of ? formatVerified(data.as_of, locale) : null;

  return (
    <section
      aria-label="Route status"
      className="mx-auto max-w-6xl overflow-hidden rounded-lg bg-himalayan text-ink-inverse ring-1 ring-white/10"
    >
      <div className="flex flex-col divide-y divide-white/10 sm:flex-row sm:divide-x sm:divide-y-0">
        <Panel heading={t("routeHeading")}>
          {headline ? (
            <>
              <StatusBadge status={headline} />
              <p className="mt-2 truncate text-sm text-ink-inverse/70">
                {headline.segment_name}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-inverse/70">Not yet checked</p>
          )}
        </Panel>

        <Panel heading={t("permitsHeading")}>
          {worstPermit ? (
            <>
              <StatusBadge status={worstPermit} />
              <p className="mt-2 text-sm text-ink-inverse/70">
                Inner-line permit required on this route.
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-inverse/70">
              No permit-bearing segment published yet.
            </p>
          )}
        </Panel>

        <Panel heading={t("weatherHeading")}>
          {weather ? (
            <>
              <p className="text-base font-medium">
                {weather.temp_min_c !== null && weather.temp_max_c !== null
                  ? `${weather.temp_min_c}° to ${weather.temp_max_c}°C`
                  : (CONDITION_LABEL[weather.condition] ?? weather.condition)}
              </p>
              <p className="mt-1 text-sm text-ink-inverse/70">
                {weather.place}
                {weather.is_stale ? " · not recently checked" : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-inverse/70">No reading published yet.</p>
          )}
        </Panel>

        <Panel heading={t("lastVerifiedHeading")}>
          {verified ? (
            <>
              <p className="text-base font-medium">{verified.relative}</p>
              <time
                dateTime={data.as_of ?? undefined}
                className="mt-1 block text-sm text-ink-inverse/70"
              >
                {verified.time} IST
              </time>
            </>
          ) : (
            <p className="text-sm text-ink-inverse/70">Never</p>
          )}
        </Panel>
      </div>

      {data.any_stale && (
        <p className="border-t border-white/10 bg-saffron/15 px-5 py-3 text-sm text-ink-inverse sm:px-6">
          <span className="font-medium">Some readings are out of date.</span>{" "}
          Treat anything marked &ldquo;not recently verified&rdquo; as unknown, not as
          open.{" "}
          <Link
            href="/status"
            className="underline decoration-gold/60 underline-offset-4 hover:decoration-gold"
          >
            See every segment
          </Link>
        </p>
      )}

      {!data.any_stale && (
        <p className="border-t border-white/10 px-5 py-3 text-sm text-ink-inverse/60 sm:px-6">
          Conditions in the high Himalaya change quickly. This page reports what our
          coordinators last confirmed, not a forecast.{" "}
          <Link
            href="/status"
            className="text-ink-inverse/80 underline decoration-gold/50 underline-offset-4 hover:decoration-gold"
          >
            See every segment
          </Link>
        </p>
      )}
    </section>
  );
}
