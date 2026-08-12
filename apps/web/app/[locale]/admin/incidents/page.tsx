import { revalidatePath } from "next/cache";

import { Caution, Verified } from "@/components/icons";
import { redirect } from "@/i18n/navigation";
import { adminGet, adminPatch, adminPost, currentStaff } from "@/lib/admin-api";

/**
 * The incident record.
 *
 * Doc 09's Phase 3 exit condition asks operations to "preserve a record of what
 * customers were told". An incident is where that matters most, because it is the one
 * somebody will ask about afterwards, sometimes formally.
 *
 * Two things shape this page.
 *
 * **The field is called "What was observed", never "condition".** One of the standing
 * constraints is "no medical clearance, diagnosis or fitness certification, by human
 * or AI". The label is the last place to get that right, because it is what a
 * coordinator reads at 3,500 metres before typing, and "had AMS" is the sentence a
 * lawyer would read back.
 *
 * **Reporting is open to everyone operational.** Least privilege governs reading
 * sensitive data; a coordinator who cannot file an incident because of a permission
 * is a coordinator who tells nobody.
 */

export const dynamic = "force-dynamic";

const FIELD =
  "w-full rounded-md bg-white/[0.06] px-2.5 py-1.5 text-sm text-ink-inverse ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-gold";
const LABEL = "text-xs text-ink-inverse/50";
const BUTTON =
  "rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight transition-transform active:scale-[0.98]";

type Incident = {
  id: number;
  severity: string;
  category: string;
  occurred_at: string;
  observed: string;
  immediate_action: string | null;
  outcome: string | null;
  reported_by: string;
  resolved_at: string | null;
  resolved_by: string | null;
  travellers_informed: boolean;
  departure_id: number | null;
  created_at: string;
  is_open: boolean;
  is_overdue: boolean;
  needs_founder: boolean;
  obligations: string[];
};

const SEVERITIES = [
  ["near_miss", "Near miss"],
  ["minor", "Minor"],
  ["significant", "Significant"],
  ["serious", "Serious"],
  ["critical", "Critical"],
] as const;

const CATEGORIES = [
  ["health_altitude", "Health or altitude"],
  ["road_vehicle", "Road or vehicle"],
  ["weather_route", "Weather or route"],
  ["accommodation", "Accommodation"],
  ["permit_checkpost", "Permit or checkpost"],
  ["conduct", "Conduct"],
  ["supplier_failure", "Supplier failure"],
  ["other", "Other"],
] as const;

const SEVERITY_TONE: Record<string, string> = {
  near_miss: "text-ink-inverse/60 ring-white/15",
  minor: "text-ink-inverse/70 ring-white/20",
  significant: "text-status-limited ring-status-limited/30",
  serious: "text-status-suspended ring-status-suspended/30",
  critical: "text-status-suspended ring-status-suspended/50",
};

function label(list: readonly (readonly [string, string])[], value: string) {
  return list.find(([v]) => v === value)?.[1] ?? value;
}

function when(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

async function reportIncident(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const locale = String(formData.get("locale") ?? "en");
  const occurred = String(formData.get("occurred_at") ?? "").trim();

  const result = await adminPost("/admin/incidents", {
    severity: formData.get("severity"),
    category: formData.get("category"),
    occurred_at: occurred ? new Date(occurred).toISOString() : new Date().toISOString(),
    observed: String(formData.get("observed") ?? "").trim(),
    immediate_action: String(formData.get("immediate_action") ?? "").trim(),
    departure_id: formData.get("departure_id")
      ? Number(formData.get("departure_id"))
      : null,
  });
  revalidatePath("/[locale]/admin/incidents", "page");
  if (!result.ok) {
    redirect({
      href: `/admin/incidents?error=${encodeURIComponent(result.error)}`,
      locale,
    });
  }
}

async function updateIncident(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const locale = String(formData.get("locale") ?? "en");

  const result = await adminPatch(`/admin/incidents/${formData.get("incident_id")}`, {
    outcome: String(formData.get("outcome") ?? "").trim(),
    travellers_informed: formData.get("travellers_informed") === "on",
    resolve: formData.get("resolve") === "on",
  });
  revalidatePath("/[locale]/admin/incidents", "page");
  if (!result.ok) {
    redirect({
      href: `/admin/incidents?error=${encodeURIComponent(result.error)}`,
      locale,
    });
  }
}

export default async function IncidentsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/incidents">) {
  const { locale } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const openOnly = sp.filter === "open";

  const incidents =
    (await adminGet<Incident[]>(
      `/admin/incidents${openOnly ? "?open_only=true" : ""}`,
    )) ?? [];

  const hidden = <input type="hidden" name="locale" value={locale} />;

  return (
    <>
      <h1 className="text-2xl font-medium">Incidents</h1>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-ink-inverse/65">
        Anything that went wrong, what was done, and how it ended. Open and overdue
        first. A near miss is worth recording: it is the one that tells you where the
        next real one will happen.
      </p>
      <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-inverse/45">
        Record what was seen, never what it was. We are not qualified to diagnose
        anybody, and a clinical judgement here is the sentence that gets read back.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg bg-status-suspended/12 px-5 py-4 text-[15px] leading-relaxed text-status-suspended ring-1 ring-status-suspended/25"
        >
          <Caution className="mt-0.5 size-5 shrink-0" />
          <span>
            {error} <span className="text-ink-inverse/55">Nothing was saved.</span>
          </span>
        </p>
      )}

      <nav className="mt-6 flex gap-2" aria-label="Filter incidents">
        {[
          { key: undefined, label: "Everything" },
          { key: "open", label: "Open" },
        ].map((f) => {
          const active = openOnly === (f.key === "open");
          return (
            <a
              key={f.label}
              href={f.key ? `?filter=${f.key}` : "?"}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-gold text-midnight"
                  : "text-ink-inverse/70 ring-1 ring-white/15 hover:text-ink-inverse"
              }`}
            >
              {f.label}
            </a>
          );
        })}
      </nav>

      {incidents.length === 0 ? (
        <p className="mt-10 text-[15px] text-ink-inverse/60">
          Nothing recorded. That is either good news or a reporting problem, and the
          second is more common than the first.
        </p>
      ) : (
        <div className="mt-8">
          {incidents.map((i) => (
            <article
              key={i.id}
              className={`border-t border-white/12 py-6 ${
                i.is_overdue ? "border-l-2 border-l-status-suspended pl-4" : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ${SEVERITY_TONE[i.severity]}`}
                >
                  {label(SEVERITIES, i.severity)}
                </span>
                <span className="text-sm text-ink-inverse/60">
                  {label(CATEGORIES, i.category)}
                </span>
                {i.needs_founder && i.is_open && (
                  <span className="text-sm text-status-suspended">
                    A founder must review this
                  </span>
                )}
                {i.is_overdue && (
                  <span className="flex items-center gap-1.5 text-sm text-status-suspended">
                    <Caution className="size-3.5" />
                    No update within the review window
                  </span>
                )}
                {!i.is_open && (
                  <span className="flex items-center gap-1.5 text-sm text-status-open">
                    <Verified className="size-3.5" />
                    Closed
                  </span>
                )}
                <span className="ml-auto text-sm text-ink-inverse/45">
                  {when(i.occurred_at)} · reported by {i.reported_by}
                </span>
              </div>

              <p className="mt-3 max-w-[72ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-inverse/85">
                {i.observed}
              </p>
              {i.immediate_action && (
                <p className="mt-2 max-w-[72ch] text-[15px] leading-relaxed text-ink-inverse/65">
                  <span className="text-ink-inverse/45">What was done. </span>
                  {i.immediate_action}
                </p>
              )}
              {i.outcome && (
                <p className="mt-2 max-w-[72ch] text-[15px] leading-relaxed text-ink-inverse/65">
                  <span className="text-ink-inverse/45">How it ended. </span>
                  {i.outcome}
                </p>
              )}

              {i.obligations.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {i.obligations.map((o) => (
                    <li key={o} className="text-sm text-saffron/90">
                      {o}
                    </li>
                  ))}
                </ul>
              )}

              {i.is_open && (
                <form action={updateIncident} className="mt-4 flex flex-wrap items-end gap-3">
                  {hidden}
                  <input type="hidden" name="incident_id" value={i.id} />
                  <label className="min-w-64 flex-1">
                    <span className={LABEL}>How it ended</span>
                    <input
                      name="outcome"
                      defaultValue={i.outcome ?? ""}
                      className={`mt-1 ${FIELD}`}
                    />
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm text-ink-inverse/70">
                    <input
                      type="checkbox"
                      name="travellers_informed"
                      defaultChecked={i.travellers_informed}
                      className="size-4 accent-gold"
                    />
                    Travellers told
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm text-ink-inverse/70">
                    <input type="checkbox" name="resolve" className="size-4 accent-gold" />
                    Close it
                  </label>
                  <button type="submit" className={BUTTON}>
                    Save
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}

      <section className="mt-12 border-t border-white/12 pt-8">
        <h2 className="font-serif text-xl">Report something</h2>
        <form action={reportIncident} className="mt-4 space-y-3">
          {hidden}
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-36">
              <span className={LABEL}>Severity</span>
              <select name="severity" defaultValue="minor" className={`mt-1 ${FIELD}`}>
                {SEVERITIES.map(([v, l]) => (
                  <option key={v} value={v} className="bg-midnight">
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-44">
              <span className={LABEL}>Category</span>
              <select name="category" defaultValue="other" className={`mt-1 ${FIELD}`}>
                {CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v} className="bg-midnight">
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-52">
              <span className={LABEL}>When it happened</span>
              <input
                type="datetime-local"
                name="occurred_at"
                className={`mt-1 ${FIELD}`}
              />
            </label>
            <label className="min-w-28">
              <span className={LABEL}>Departure</span>
              <input
                name="departure_id"
                type="number"
                placeholder="id"
                className={`mt-1 ${FIELD}`}
              />
            </label>
          </div>
          <label className="block">
            {/*
              "What was observed", never "condition". The standing constraint is no
              diagnosis by human or AI, and the label is the last place to get that
              right, because it is what somebody reads before typing.
            */}
            <span className={LABEL}>
              What was observed. What you saw, not what you think it was.
            </span>
            <textarea
              name="observed"
              required
              rows={3}
              placeholder="Complained of headache and nausea at Gunji, unsteady walking to the vehicle."
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="block">
            <span className={LABEL}>What was done at the time</span>
            <textarea name="immediate_action" rows={2} className={`mt-1 ${FIELD}`} />
          </label>
          <button type="submit" className={BUTTON}>
            Record it
          </button>
        </form>
      </section>
    </>
  );
}
