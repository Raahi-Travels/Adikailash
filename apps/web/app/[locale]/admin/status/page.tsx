import { revalidatePath } from "next/cache";

import { StatusBadge } from "@/components/status-badge";
import { api, type Locale } from "@/lib/api";
import { adminPost, currentStaff } from "@/lib/admin-api";

/**
 * Publish a verified route status.
 *
 * The form deliberately does not let the publisher choose who verified it. Doc 09
 * requires attribution, and the API takes the actor from the session, so nobody can
 * publish under another coordinator's name.
 *
 * `valid_for_hours` is a required commitment, not a default the publisher can ignore:
 * it is the promise to re-check that makes the staleness rendering meaningful.
 */

const ACCESS = [
  ["open", "Open"],
  ["limited", "Limited access"],
  ["permit_pending", "Permit pending"],
  ["suspended", "Suspended"],
  ["closed", "Closed"],
  ["not_in_season", "Not in season"],
] as const;

const SOURCES = [
  ["official_notice", "Official notice"],
  ["district_or_tourism", "District or tourism confirmation"],
  ["operating_partner", "Operating partner"],
  ["field_coordinator", "Our field coordinator"],
  ["supplier_observation", "Supplier observation"],
] as const;

const FIELD =
  "mt-1.5 w-full rounded-md bg-white/[0.06] px-3 py-2 text-[15px] text-ink-inverse ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-gold";
const LABEL = "block text-sm text-ink-inverse/85";

async function publish(formData: FormData) {
  "use server";

  const staff = await currentStaff();
  if (!staff) return;

  await adminPost("/admin/status", {
    route_segment_slug: formData.get("segment"),
    access: formData.get("access"),
    source: formData.get("source"),
    summary: {
      en: String(formData.get("summary_en") ?? "").trim(),
      hi: String(formData.get("summary_hi") ?? "").trim() || null,
    },
    valid_for_hours: Number(formData.get("valid_for_hours") ?? 12),
  });

  revalidatePath("/[locale]/admin/status", "page");
  revalidatePath("/[locale]/status", "page");
  revalidatePath("/[locale]", "page");
}

export default async function AdminStatusPage({
  params,
}: PageProps<"/[locale]/admin/status">) {
  const { locale } = await params;
  const status = await api.status(locale as Locale);
  const segments = status?.routes ?? [];

  return (
    <>
      <h1 className="text-2xl font-medium">Publish route status</h1>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/65">
        This publishes immediately to the public site under your name. State only what
        you have actually confirmed. If you are unsure, choose a shorter re-check
        window rather than a more confident status.
      </p>

      <form action={publish} className="mt-8 max-w-2xl space-y-5">
        <div>
          <label className={LABEL} htmlFor="segment">
            Route segment
          </label>
          <select id="segment" name="segment" required className={FIELD}>
            {segments.map((s) => (
              <option key={s.segment_slug} value={s.segment_slug}>
                {s.segment_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="access">
              Condition
            </label>
            <select id="access" name="access" required className={FIELD}>
              {ACCESS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="source">
              How do you know?
            </label>
            <select id="source" name="source" required className={FIELD}>
              {SOURCES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="summary_en">
            What travellers should know (English)
          </label>
          <textarea
            id="summary_en"
            name="summary_en"
            required
            rows={3}
            className={FIELD}
            placeholder="Road open to Gunji. Single-lane sections near Malpa."
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="summary_hi" lang="hi">
            यात्रियों के लिए जानकारी (हिन्दी)
          </label>
          <textarea id="summary_hi" name="summary_hi" rows={3} className={FIELD} lang="hi" />
          <p className="mt-1.5 text-sm text-ink-inverse/50">
            Optional. Without it, Hindi readers see the English text.
          </p>
        </div>

        <div>
          <label className={LABEL} htmlFor="valid_for_hours">
            Re-check within
          </label>
          <select
            id="valid_for_hours"
            name="valid_for_hours"
            defaultValue="12"
            className={FIELD}
          >
            <option value="4">4 hours</option>
            <option value="8">8 hours</option>
            <option value="12">12 hours</option>
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
          </select>
          <p className="mt-1.5 text-sm text-ink-inverse/50">
            After this the public site marks the reading as not recently verified, and
            it stops counting as open.
          </p>
        </div>

        <button
          type="submit"
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight active:scale-[0.98]"
        >
          Publish under my name
        </button>
      </form>

      <section className="mt-14">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-ink-inverse/55">
          Currently published
        </h2>
        <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {segments.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div>
                <p className="text-[15px]">{s.segment_name}</p>
                <p className="mt-0.5 text-sm text-ink-inverse/55">
                  {s.verified_by ?? "Unattributed"}
                </p>
              </div>
              <StatusBadge status={s} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
