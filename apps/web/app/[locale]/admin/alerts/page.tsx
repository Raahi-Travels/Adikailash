import { adminGet } from "@/lib/admin-api";

/**
 * The route-alert queue.
 *
 * Nothing sends: decision O9 has not settled a provider. This page exists so that
 * fact is visible rather than assumed — a subscription form that quietly discards is
 * the failure mode, and a growing backlog with a banner saying why is the honest
 * state.
 *
 * It is also the cheapest way to check the materiality rules against a real season
 * before a single message reaches anybody. If a month of re-verifications produces
 * forty queued rows, the rules are wrong, and a table is a far better place to learn
 * that than a run of unsubscribes.
 */

export const dynamic = "force-dynamic";

type Message = {
  id: number;
  channel: string;
  destination: string;
  subject: string;
  body: string;
  urgency: string;
  state: string;
  send_after: string;
  suppressed_reason: string | null;
  template_name: string | null;
  template_parameters: string[] | null;
  created_at: string;
};

type Queue = {
  messages: Message[];
  queued: number;
  suppressed: number;
  sent: number;
  active_subscribers: number;
  sending_enabled: boolean;
};

export default async function AlertsPage() {
  const queue = await adminGet<Queue>("/admin/alert-queue");
  if (!queue) {
    return (
      <>
        <h1 className="text-2xl font-medium">Route alerts</h1>
        <p className="mt-4 text-[15px] text-ink-inverse/60">Could not load the queue.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-medium">Route alerts</h1>

      {!queue.sending_enabled && (
        <p className="mt-4 max-w-[72ch] rounded-md bg-status-limited/10 px-4 py-3 text-[15px] leading-relaxed ring-1 ring-status-limited/25">
          Nothing is being sent. Decision O9 has not settled a messaging provider, so
          these rows are what a subscriber <em>would</em> have received. That is
          deliberate. It is the only way to check the rules against a real season
          before a message reaches anybody.
        </p>
      )}

      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
        {[
          ["Queued", queue.queued],
          ["Suppressed", queue.suppressed],
          ["Sent", queue.sent],
          ["Active subscribers", queue.active_subscribers],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-ink-inverse/45">{label}</dt>
            <dd className="mt-0.5 text-lg tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {queue.messages.length === 0 ? (
        <p className="mt-8 text-[15px] text-ink-inverse/55">
          Nothing queued. A route that has not changed produces no messages, which is
          the intended behaviour rather than a fault.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {queue.messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg bg-white/[0.04] px-5 py-4 ring-1 ring-white/10"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-[15px]">{m.subject}</p>
                <p className="text-xs text-ink-inverse/45">
                  {m.channel} · {m.urgency} · {m.state}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-inverse/70">
                {m.body}
              </p>
              {m.template_name && (
                <p className="mt-2 text-xs text-ink-inverse/40">
                  template {m.template_name} · {m.template_parameters?.length ?? 0}{" "}
                  variable(s). Needs Meta approval before this channel can send
                </p>
              )}
              {m.suppressed_reason && (
                <p className="mt-2 text-xs leading-relaxed text-status-limited">
                  Not sent: {m.suppressed_reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
