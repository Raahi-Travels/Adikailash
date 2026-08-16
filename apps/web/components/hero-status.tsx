import { Link } from "@/i18n/navigation";
import { api, type Locale, type LiveSources } from "@/lib/api";
import { whatsappLink } from "@/lib/brand";
import {
  legLabel,
  legStatus,
  STATE_COLOUR,
  STATIONS,
  type LegState,
} from "@/lib/route-profile";

/**
 * Live route status, in the hero.
 *
 * The old page put this below the fold as a four-cell bordered grid summarising the
 * single worst segment. Both choices were wrong. Doc 07 calls this the device that
 * earns citations and repeat visits, which means it belongs where a visitor lands,
 * and summarising six legs into one badge throws away the only detail that helps:
 * *which* leg. "Is the road open" has six different answers on this route and a
 * traveller flying into Kathgodam next week needs the one about their leg.
 *
 * It is one of only two floating panels on the site. Everything else separates with
 * hairlines and space; this earns a surface because it is an instrument reading
 * rather than page content, and the boundary is the point.
 */

function age(iso: string, locale: Locale) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    numeric: "auto",
  });
  if (mins < 60) return rtf.format(-Math.max(mins, 1), "minute");
  if (mins < 1440) return rtf.format(-Math.round(mins / 60), "hour");
  return rtf.format(-Math.round(mins / 1440), "day");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Live route status"
      className="rounded-2xl bg-himalayan/85 p-5 ring-1 ring-white/10 backdrop-blur-md sm:p-6"
    >
      {children}
    </section>
  );
}

export function HeroStatus({
  data,
  live,
  locale,
}: {
  // Passed in rather than fetched here: the hinge band below the hero reports on the
  // same readings, and two components independently calling the status endpoint can
  // disagree by a verification if one lands either side of a coordinator's update.
  data: Awaited<ReturnType<typeof api.status>>;
  live: LiveSources | null;
  locale: Locale;
}) {
  const wa = whatsappLink({ intent: "status" });

  // Doc 08: "No false 'open' status on stale data." An unreachable API is not a
  // reason to show yesterday's answer, so it says nothing rather than something.
  if (data === null || !data.has_data) {
    return (
      <Shell>
        <h2 className="text-[15px] font-medium text-ink-inverse">
          Live route status
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-inverse/65">
          {data === null
            ? "We cannot reach our status service from here, so we are not going to guess. Please speak to the team before making travel plans."
            : "Our coordinators publish conditions once the season opens and checks begin. Nothing is posted yet."}
        </p>
      </Shell>
    );
  }

  const legs = STATIONS.filter((s) => s.from).map((station) => {
    const status = legStatus(data.routes, station);
    return {
      station,
      status,
      state: (status?.state ?? "unknown") as LegState,
    };
  });

  const confirmed = legs.filter((l) => l.state !== "unknown").length;

  // Only when the portal actually said so. `null` means the two signals disagreed
  // or the site was unreachable, and inventing a suspension is as bad as missing
  // one: it would stop enquiries on a route that is open.
  const notIssuing =
    (live?.permit_portal?.payload as { is_issuing?: boolean | null } | undefined)
      ?.is_issuing === false;

  return (
    <Shell>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-medium text-ink-inverse">
          Live route status
        </h2>
        <Link
          href="/status"
          className="text-sm text-gold underline-offset-4 hover:underline"
        >
          Every segment
        </Link>
      </div>

      {notIssuing && (
        <p className="mt-4 rounded-xl bg-status-suspended/15 px-3.5 py-3 text-sm leading-relaxed text-ink-inverse ring-1 ring-status-suspended/30">
          <span className="font-medium">Permits are not being issued.</span> The
          district portal has suspended Inner Line Permits, so nobody is travelling
          above Chiyalekh at the moment, us included.
        </p>
      )}

      <ul className="mt-4">
        {legs.map(({ station, status, state }) => (
          <li
            key={station.slug}
            className="flex items-center gap-3 border-t border-white/[0.07] py-2.5 first:border-t-0 first:pt-0"
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: STATE_COLOUR[state] }}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-inverse/90">
              {station.name}
            </span>
            <span className="shrink-0 text-sm" style={{ color: STATE_COLOUR[state] }}>
              {legLabel(status)}
            </span>
            <span className="type-reading w-20 shrink-0 text-right text-xs text-ink-inverse/40">
              {status ? age(status.verified_at, locale) : "never"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-white/[0.07] pt-4 text-xs leading-relaxed text-ink-inverse/50">
        {confirmed} of {legs.length} legs confirmed recently. Above Tawaghat no
        official source reports road status, so anything not confirmed is genuinely
        unknown to us.
      </p>

      {wa && (
        <a
          href={wa}
          className="mt-4 flex items-center justify-between gap-3 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm text-ink-inverse transition-colors hover:bg-white/[0.11]"
        >
          Ask about your dates on WhatsApp
          <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-gold" fill="none">
            <path
              d="M3 8h9m0 0-3.2-3.2M12 8l-3.2 3.2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}
    </Shell>
  );
}
