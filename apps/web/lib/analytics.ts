/**
 * Funnel events.
 *
 * Doc 07 draws one line that this module exists to enforce: "Use server-confirmed
 * business events for reservation and payment rather than treating button clicks as
 * sales." So events are split into two kinds and the types make them un-mixable.
 *
 *   - `behavioural` — the visitor did something in a browser. Cheap, plentiful, and
 *     never evidence that anything happened commercially.
 *   - `business`   — the server confirmed a state change. Emitted from server code
 *     only, after the write succeeded.
 *
 * Doc 07 also warns against "reporting conditional deposits as completed revenue".
 * A click on "Send enquiry" is not a lead; the 201 from the API is.
 *
 * No analytics vendor is wired yet (that is still an open decision). Until one is,
 * events go to the console in development and are dropped in production rather than
 * silently queued somewhere nobody reads.
 */

export type BehaviouralEvent =
  | "journey_viewed"
  | "departure_viewed"
  | "live_status_viewed"
  | "permit_checklist_viewed"
  | "tier_comparison_opened"
  | "whatsapp_cta_clicked"
  | "enquiry_form_started"
  | "policy_viewed"
  | "cancellation_policy_viewed_before_enquiry";

export type BusinessEvent =
  | "lead_created"
  | "consent_granted"
  | "document_uploaded"
  | "document_accepted"
  | "status_published"
  | "departure_state_changed";

type Props = Record<string, string | number | boolean | null | undefined>;

function emit(kind: "behavioural" | "business", name: string, props?: Props) {
  const payload = { kind, name, ...props, at: new Date().toISOString() };

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", payload);
    return;
  }
  // Deliberately a no-op until a provider is chosen. Doc 08 wants integrations
  // bounded behind an adapter; this is that boundary, not a missing feature.
}

/**
 * Something a visitor did. Never treat one of these as a conversion.
 *
 * Carries journey/departure context because doc 07 requires every funnel event to
 * be sliceable by journey, tier and campaign.
 */
export function trackBehaviour(event: BehaviouralEvent, props?: Props) {
  emit("behavioural", event, props);
}

/**
 * Something the server confirmed. Call only after the write succeeded.
 */
export function trackBusiness(event: BusinessEvent, props?: Props) {
  emit("business", event, props);
}

/**
 * Attribution captured from the current page, for attaching to a lead.
 *
 * Doc 07 requires first-touch and campaign to survive into the CRM. Reading it here
 * keeps the enquiry form from having to know about UTM conventions.
 */
export function captureAttribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    first_touch_source:
      params.get("utm_source") ?? (document.referrer ? "referral" : "direct"),
    campaign: params.get("utm_campaign") ?? undefined,
    landing_page: window.location.pathname,
    referrer: document.referrer || undefined,
  };
}
