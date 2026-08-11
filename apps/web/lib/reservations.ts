/**
 * Shared reservation types and labels.
 *
 * The labels live here rather than in a page because the same state has to read the
 * same way in the queue, the detail view and the traveller's own portal. A state
 * called "Confirmed" on one screen and "Booked" on another is how a family ends up
 * booking flights against a hold.
 *
 * Mirrors `api.domain.reservations`. The API is the authority; this is presentation.
 */

export type ReservationListItem = {
  id: number;
  reference: string;
  state: string;
  departure_id: number;
  journey_name: string | null;
  start_date: string | null;
  party_size: number;
  travellers_named: number;
  coordinator: string | null;
  group_lead_name: string | null;
  agreed_amount: string;
  amount_received: string;
  balance_outstanding: string;
  next_action: string | null;
  next_action_due_at: string | null;
  is_overdue: boolean;
  hold_expires_at: string | null;
  hold_expired: boolean;
  created_at: string;
};

export type Readiness = {
  documents_outstanding: number;
  travellers_named: number;
  travellers_expected: number;
  policy_accepted: boolean;
  coordinator: string | null;
  amount_due: string;
  amount_received: string;
  balance_outstanding: string;
  party_complete: boolean;
  is_ready: boolean;
  outstanding: string[];
};

export type ReservationDetail = ReservationListItem & {
  currency: string;
  internal_note: string | null;
  cancellation_reason: string | null;
  travellers: {
    id: number;
    full_name: string;
    role: string;
    date_of_birth: string | null;
    relationship_to_lead: string | null;
    phone: string | null;
    email: string | null;
    is_senior: boolean;
    has_disclosed_health_information: boolean;
    dietary_note: string | null;
  }[];
  payments: {
    id: number;
    direction: string;
    amount: string;
    currency: string;
    method: string;
    reference: string | null;
    received_at: string;
    recorded_by: string;
    note: string | null;
  }[];
  acceptances: {
    id: number;
    policy: string;
    version: string;
    accepted_by: string;
    accepted_at: string | null;
    channel: string | null;
    recorded_by: string | null;
  }[];
  readiness: Readiness;
  confirmation_blockers: string[];
  allowed_transitions: string[];
};

export type ReservationQueue = {
  reservations: ReservationListItem[];
  total: number;
  unassigned_count: number;
  overdue_count: number;
  expired_hold_count: number;
};

const STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  proposed: "Proposal sent",
  // Never shortened to "Held" alone anywhere a customer might see it.
  held: "Held, not confirmed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  travelled: "Travelled",
  cancelled_by_traveller: "Cancelled by traveller",
  cancelled_by_us: "Cancelled by us",
  lapsed: "Hold lapsed",
};

export function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}

/**
 * Colour is never the only signal: every badge using these also carries its label.
 * Doc 03 requires that status is not communicated by colour alone.
 */
export const STATE_TONE: Record<string, string> = {
  draft: "text-ink-inverse/60 ring-white/15",
  proposed: "text-ink-inverse/75 ring-white/20",
  held: "text-status-limited ring-status-limited/30",
  confirmed: "text-status-open ring-status-open/40",
  preparing: "text-status-open ring-status-open/30",
  ready: "text-status-open ring-status-open/50",
  travelled: "text-status-done ring-status-done/40",
  cancelled_by_traveller: "text-status-suspended ring-status-suspended/30",
  cancelled_by_us: "text-status-suspended ring-status-suspended/30",
  lapsed: "text-status-unverified ring-status-unverified/30",
};

export const PAYMENT_METHODS = [
  ["bank_transfer", "Bank transfer"],
  ["upi", "UPI"],
  ["cash", "Cash"],
  ["cheque", "Cheque"],
] as const;

/** The four policies on the website. Terms and cancellation gate confirmation. */
export const POLICIES = [
  ["terms", "Terms of service"],
  ["cancellation", "Cancellation and refunds"],
  ["privacy", "Privacy"],
  ["consent", "Consent"],
] as const;
