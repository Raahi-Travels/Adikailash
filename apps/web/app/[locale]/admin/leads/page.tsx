import { revalidatePath } from "next/cache";

import { Caution, Conversation, Group } from "@/components/icons";
import { redirect } from "@/i18n/navigation";
import { adminGet, adminPatch, currentStaff } from "@/lib/admin-api";

/**
 * The sales workspace.
 *
 * Doc 04 asks for "a practical workspace rather than a raw contact list", and names
 * the management views that matter: "Leads without owner", "Overdue next actions".
 * Both are counted at the top and filterable, because a lead nobody owns is the one
 * failure this page exists to prevent.
 *
 * Each row is editable in place. Every save sets an owner and a next action together,
 * so it is not possible to claim a lead and leave it without a next step. That
 * pairing is the whole point; splitting them into two forms would let the second one
 * be skipped.
 *
 * Contact details are visible here because a salesperson cannot work without them,
 * but this page is behind staff auth, is `noindex`, and the API restricts it to
 * SALES_ROLES. Read-only staff cannot open it at all.
 */

export const dynamic = "force-dynamic";

type Lead = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  origin_city: string | null;
  journey_name: string | null;
  group_size: number | null;
  is_senior_inclusive: boolean | null;
  primary_concern: string | null;
  stage: string;
  priority: number;
  owner: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  is_overdue: boolean;
  is_unassigned: boolean;
  first_touch_source: string | null;
  campaign: string | null;
  created_at: string;
  consents: string[];
};

type Queue = {
  leads: Lead[];
  unassigned_count: number;
  overdue_count: number;
  total: number;
};

const STAGES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["consultation_scheduled", "Consultation scheduled"],
  ["proposal_shared", "Proposal shared"],
  ["reservation_invited", "Reservation invited"],
  ["reserved", "Reserved"],
  ["confirmed", "Confirmed"],
  ["nurture", "Nurture"],
  ["lost", "Lost"],
] as const;

const STAGE_LABEL = Object.fromEntries(STAGES) as Record<string, string>;

/** Doc 04 rejects a stage called "Hot"; priority is its own axis, so label it plainly. */
const PRIORITY = ["Routine", "Worth a call", "Call today", "Call now"];

/**
 * Consents currently held, so nobody has to guess what they may send.
 *
 * `essential_trip` is granted by asking us a question. The other two are not, and the
 * distinction is the point: replying about this enquiry is always allowed, sending
 * anything else is only allowed if it appears here.
 */
const CONSENT_LABEL: Record<string, string> = {
  essential_trip: "May reply about this enquiry",
  route_status_alerts: "May send route alerts",
  promotional: "May send offers",
};

const FIELD =
  "w-full rounded-md bg-white/[0.06] px-2.5 py-1.5 text-sm text-ink-inverse ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-gold";

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function dueLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const date = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);
  if (days < 0) return `${date}, ${-days === 1 ? "1 day" : `${-days} days`} overdue`;
  if (days === 0) return `${date}, today`;
  return date;
}

async function updateLead(formData: FormData) {
  "use server";

  const staff = await currentStaff();
  if (!staff) return;

  const id = String(formData.get("lead_id"));
  const due = String(formData.get("next_action_due_at") ?? "").trim();
  const filter = String(formData.get("filter") ?? "");
  const locale = String(formData.get("locale") ?? "en");

  const result = await adminPatch(`/admin/leads/${id}`, {
    stage: formData.get("stage"),
    owner: String(formData.get("owner") ?? "").trim(),
    next_action: String(formData.get("next_action") ?? "").trim(),
    // "By when" means the end of that day in IST, which is 18:29:59.999Z on the same
    // UTC date. Sending the bare date would be midnight UTC, i.e. 05:30 IST, quietly
    // making every deadline half a day earlier than the person meant.
    next_action_due_at: due ? `${due}T18:29:59.999Z` : null,
    priority: Number(formData.get("priority") ?? 0),
    loss_reason: String(formData.get("loss_reason") ?? "").trim(),
  });

  revalidatePath("/[locale]/admin/leads", "page");

  // The API refuses some saves on purpose (a lost lead with no reason). Swallowing
  // that would look exactly like a successful save that did nothing.
  if (!result.ok) {
    const query = new URLSearchParams({ error: result.error, lead: id });
    if (filter) query.set("filter", filter);
    redirect({ href: `/admin/leads?${query}`, locale });
  }
}

function LeadRow({
  lead,
  locale,
  filter,
  error,
}: {
  lead: Lead;
  locale: string;
  filter?: string;
  /** Set only on the one row whose save the API refused. */
  error?: string;
}) {
  const wa = lead.phone
    ? `https://wa.me/${lead.phone.replace(/\D/g, "")}`
    : null;

  return (
    <article
      className={`border-t border-white/12 py-6 ${
        lead.is_unassigned ? "border-l-2 border-l-saffron/60 pl-4" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-lg">{lead.name ?? "No name given"}</h3>

        {lead.is_unassigned && (
          <span className="rounded-full bg-saffron/15 px-2.5 py-0.5 text-xs text-saffron ring-1 ring-saffron/30">
            Nobody owns this
          </span>
        )}
        {lead.is_overdue && (
          <span className="flex items-center gap-1.5 rounded-full bg-status-suspended/12 px-2.5 py-0.5 text-xs text-status-suspended ring-1 ring-status-suspended/25">
            <Caution className="size-3.5" />
            Overdue
          </span>
        )}

        <span className="ml-auto text-sm text-ink-inverse/45">
          Came in {ago(lead.created_at)}
          {lead.first_touch_source ? ` via ${lead.first_touch_source}` : ""}
          {lead.campaign ? ` (${lead.campaign})` : ""}
        </span>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink-inverse/65">
        {lead.phone && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Phone</dt>
            <dd>
              <a href={`tel:${lead.phone}`} className="hover:text-ink-inverse">
                {lead.phone}
              </a>
            </dd>
            {wa && (
              <a
                href={wa}
                className="text-ink-inverse/40 transition-colors hover:text-gold"
                aria-label={`Message ${lead.name ?? "this lead"} on WhatsApp`}
              >
                <Conversation className="size-4" />
              </a>
            )}
          </div>
        )}
        {lead.email && (
          <div>
            <dt className="sr-only">Email</dt>
            <dd>{lead.email}</dd>
          </div>
        )}
        {lead.origin_city && (
          <div>
            <dt className="sr-only">From</dt>
            <dd>From {lead.origin_city}</dd>
          </div>
        )}
        {lead.journey_name && (
          <div>
            <dt className="sr-only">Interested in</dt>
            <dd>{lead.journey_name}</dd>
          </div>
        )}
        {lead.group_size && (
          <div className="flex items-center gap-1.5">
            <Group className="size-4 text-ink-inverse/35" />
            <dt className="sr-only">Group</dt>
            <dd>
              {lead.group_size}
              {/*
                Doc 01 puts families travelling with elders at the centre of this
                business. If a lead includes one, the person calling should know
                before they pick up the phone, not halfway through.
              */}
              {lead.is_senior_inclusive ? ", travelling with elders" : ""}
            </dd>
          </div>
        )}
      </dl>

      {lead.primary_concern && (
        <p className="mt-3 max-w-[70ch] border-l-2 border-white/15 pl-4 text-[15px] leading-relaxed text-ink-inverse/75">
          {lead.primary_concern}
        </p>
      )}

      {lead.consents.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-2 text-xs text-ink-inverse/45">
          <span className="sr-only">Consents given</span>
          {lead.consents.map((c) => (
            <span key={c} className="rounded px-2 py-0.5 ring-1 ring-white/10">
              {CONSENT_LABEL[c] ?? c}
            </span>
          ))}
        </p>
      )}

      <form action={updateLead} className="mt-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="lead_id" value={lead.id} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="filter" value={filter ?? ""} />

        <label className="min-w-36 flex-1">
          <span className="text-xs text-ink-inverse/50">Owner</span>
          <input
            name="owner"
            defaultValue={lead.owner ?? ""}
            placeholder="Who is calling"
            className={`mt-1 ${FIELD}`}
          />
        </label>

        <label className="min-w-56 flex-[2]">
          <span className="text-xs text-ink-inverse/50">Next action</span>
          <input
            name="next_action"
            defaultValue={lead.next_action ?? ""}
            placeholder="Call about the May dates"
            className={`mt-1 ${FIELD}`}
          />
        </label>

        <label className="min-w-36">
          <span className="text-xs text-ink-inverse/50">By when</span>
          <input
            type="date"
            name="next_action_due_at"
            defaultValue={lead.next_action_due_at?.slice(0, 10) ?? ""}
            className={`mt-1 ${FIELD}`}
          />
        </label>

        <label className="min-w-44">
          <span className="text-xs text-ink-inverse/50">Stage</span>
          <select name="stage" defaultValue={lead.stage} className={`mt-1 ${FIELD}`}>
            {STAGES.map(([value, label]) => (
              <option key={value} value={value} className="bg-midnight">
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-36">
          <span className="text-xs text-ink-inverse/50">Priority</span>
          <select
            name="priority"
            defaultValue={String(lead.priority)}
            className={`mt-1 ${FIELD}`}
          >
            {PRIORITY.map((label, value) => (
              <option key={label} value={value} className="bg-midnight">
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-44 flex-1">
          <span className="text-xs text-ink-inverse/50">
            If lost, why
          </span>
          <input
            name="loss_reason"
            placeholder="Required to mark lost"
            className={`mt-1 ${FIELD}`}
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight transition-transform active:scale-[0.98]"
        >
          Save
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-md bg-status-suspended/12 px-4 py-3 text-sm leading-relaxed text-status-suspended ring-1 ring-status-suspended/25"
        >
          <Caution className="mt-0.5 size-4 shrink-0" />
          <span>
            {error} <span className="text-ink-inverse/55">Nothing was saved.</span>
          </span>
        </p>
      )}

      {lead.next_action && lead.next_action_due_at && (
        <p
          className={`mt-3 text-sm ${
            lead.is_overdue ? "text-status-suspended" : "text-ink-inverse/50"
          }`}
        >
          Currently: {lead.next_action}, due {dueLabel(lead.next_action_due_at)}
          {lead.owner ? `, with ${lead.owner}` : ""}
        </p>
      )}
    </article>
  );
}

export default async function LeadsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/leads">) {
  const { locale } = await params;
  const sp = await searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : undefined;
  const stage = typeof sp.stage === "string" ? sp.stage : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const errorLead = typeof sp.lead === "string" ? Number(sp.lead) : undefined;

  const query = new URLSearchParams();
  if (filter === "unassigned") query.set("unassigned", "true");
  if (filter === "overdue") query.set("overdue", "true");
  if (stage) query.set("stage", stage);

  const queue = await adminGet<Queue>(
    `/admin/leads${query.size ? `?${query}` : ""}`,
  );

  const filters = [
    { key: undefined, label: "Everything", count: queue?.total },
    { key: "unassigned", label: "Nobody owns", count: queue?.unassigned_count },
    { key: "overdue", label: "Overdue", count: queue?.overdue_count },
  ];

  return (
    <>
      <h1 className="text-2xl font-medium">Enquiries</h1>
      <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-inverse/65">
        Sorted by what needs a person first: leads nobody owns, then overdue ones, then
        by priority. Give every lead you touch an owner and a next action in the same
        save, so nothing sits here waiting for someone to notice it.
      </p>

      {queue === null && (
        <p className="mt-8 rounded-lg bg-himalayan px-5 py-4 text-[15px] ring-1 ring-white/10">
          Could not load the queue. Either the API is unreachable, or your account does
          not have a sales role.
        </p>
      )}

      {queue && (
        <>
          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filter leads">
            {filters.map((f) => {
              const active = filter === f.key;
              return (
                <a
                  key={f.label}
                  href={f.key ? `?filter=${f.key}` : "?"}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-gold text-midnight"
                      : "text-ink-inverse/70 ring-1 ring-white/15 hover:text-ink-inverse"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {f.label}
                  {typeof f.count === "number" && (
                    <span className={active ? "ml-2 opacity-70" : "ml-2 opacity-50"}>
                      {f.count}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          {queue.unassigned_count > 0 && filter !== "unassigned" && (
            <p className="mt-6 rounded-lg bg-saffron/12 px-5 py-3.5 text-[15px] ring-1 ring-saffron/25">
              {queue.unassigned_count === 1
                ? "One enquiry has no owner."
                : `${queue.unassigned_count} enquiries have no owner.`}{" "}
              Somebody asked us a question and nobody has picked it up.
            </p>
          )}

          {queue.leads.length === 0 ? (
            <p className="mt-10 text-[15px] text-ink-inverse/60">
              {filter || stage
                ? "Nothing matches that filter."
                : "No enquiries yet. They will appear here the moment someone sends one."}
            </p>
          ) : (
            <div className="mt-8">
              {queue.leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  locale={locale}
                  filter={filter}
                  error={lead.id === errorLead ? error : undefined}
                />
              ))}
            </div>
          )}

          {stage && (
            <p className="mt-6 text-sm text-ink-inverse/50">
              Filtered to {STAGE_LABEL[stage] ?? stage}.{" "}
              <a href="?" className="text-gold underline-offset-4 hover:underline">
                Clear
              </a>
            </p>
          )}
        </>
      )}
    </>
  );
}
