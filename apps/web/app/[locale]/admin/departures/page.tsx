import { revalidatePath } from "next/cache";

import { api, type Departure, type Locale } from "@/lib/api";
import { adminGet, adminPost, currentStaff } from "@/lib/admin-api";

/**
 * Departure lifecycle.
 *
 * Every transition needs a reason, and the reason field is required in the markup as
 * well as the API and the database. Doc 09 makes state changes attributable; the
 * actor comes from the session, so this form never asks who is doing it.
 *
 * Only legal next states are offered. The domain state machine decides which those
 * are, so the UI cannot present a move the server will reject.
 */

async function transition(formData: FormData) {
  "use server";

  const staff = await currentStaff();
  if (!staff) return;

  const id = formData.get("departure_id");
  await adminPost(`/admin/departures/${id}/transition`, {
    target_state: formData.get("target_state"),
    reason: String(formData.get("reason") ?? "").trim(),
  });

  revalidatePath("/[locale]/admin/departures", "page");
  revalidatePath("/[locale]/departures", "page");
}

type Transitions = { current: string; allowed: string[] };

export default async function AdminDeparturesPage({
  params,
}: PageProps<"/[locale]/admin/departures">) {
  const { locale } = await params;
  const departures: Departure[] = (await api.departures(locale as Locale)) ?? [];

  const withMoves = await Promise.all(
    departures.map(async (d) => ({
      departure: d,
      moves: await adminGet<Transitions>(`/admin/departures/${d.id}/transitions`),
    })),
  );

  return (
    <>
      <h1 className="text-2xl font-medium">Departures</h1>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/65">
        Changing a state is recorded against your name with the reason you give. The
        record cannot be edited afterwards.
      </p>

      {withMoves.length === 0 && (
        <p className="mt-8 text-[15px] text-ink-inverse/60">
          No departures exist yet.
        </p>
      )}

      <div className="mt-8 space-y-5">
        {withMoves.map(({ departure, moves }) => (
          <article
            key={departure.id}
            className="border-t border-white/12 pt-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-[15px]">
                  {departure.journey_name}
                  <span className="ml-2 text-ink-inverse/55">{departure.tier_name}</span>
                </h2>
                <p className="mt-1 text-sm text-ink-inverse/55">
                  {departure.start_date} to {departure.end_date} · {departure.gateway}
                </p>
              </div>
              <div className="text-right text-sm">
                <p>{departure.state_label}</p>
                <p className="mt-0.5 text-ink-inverse/50">
                  {departure.reserved_count} of {departure.capacity} held ·{" "}
                  {departure.payment_action === "none"
                    ? "no payment"
                    : departure.payment_action}
                </p>
              </div>
            </div>

            {!departure.operator_disclosed && (
              <p className="mt-3 text-sm text-status-limited">
                No operating partner assigned. This departure cannot be opened for
                booking until one is.
              </p>
            )}

            {moves && moves.allowed.length > 0 ? (
              <form action={transition} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="departure_id" value={departure.id} />
                <div>
                  <label
                    className="block text-sm text-ink-inverse/70"
                    htmlFor={`target-${departure.id}`}
                  >
                    Move to
                  </label>
                  <select
                    id={`target-${departure.id}`}
                    name="target_state"
                    className="mt-1.5 rounded-md bg-white/[0.06] px-3 py-2 text-sm ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-gold"
                  >
                    {moves.allowed.map((state) => (
                      <option key={state} value={state}>
                        {state.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[18rem] flex-1">
                  <label
                    className="block text-sm text-ink-inverse/70"
                    htmlFor={`reason-${departure.id}`}
                  >
                    Reason (recorded permanently)
                  </label>
                  <input
                    id={`reason-${departure.id}`}
                    name="reason"
                    required
                    minLength={3}
                    className="mt-1.5 w-full rounded-md bg-white/[0.06] px-3 py-2 text-sm ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-gold"
                    placeholder="Permit issuance paused pending district notice"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight active:scale-[0.98]"
                >
                  Apply
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-ink-inverse/50">
                {moves === null
                  ? "Your roles do not permit changing departure state."
                  : "This departure is in a terminal state."}
              </p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
