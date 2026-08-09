/**
 * Typed client for the journeys API.
 *
 * Every fetch is `no-store` for status and departures: a cached "route open" banner
 * is the same lie as a stale one. Catalogue content is allowed to revalidate, since
 * a journey description going a minute out of date harms nobody.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

export type Locale = "en" | "hi";

export type JourneySummary = {
  id: number;
  slug: string;
  name: string;
  essence: string | null;
  family: string;
  gateway: string | null;
  duration_nights: number | null;
  highest_altitude_m: number | null;
  is_published: boolean;
};

export type ServiceTier = {
  id: number;
  slug: string;
  name: string;
  differentiators: string | null;
  max_group_size: number | null;
  typical_group_size: number | null;
  is_private: boolean;
  indicative_price: string | null;
};

export type Stay = {
  id: number;
  slug: string;
  name: string;
  kind: string;
  host_name: string | null;
  household_story: string | null;
  village: string | null;
  shares_family_meals: boolean | null;
  typical_occupancy: number | null;
  has_running_hot_water: boolean | null;
  has_heating: boolean | null;
  has_mobile_network: boolean | null;
  is_shared_bathroom: boolean | null;
  limitations_note: string | null;
  last_verified_by: string | null;
};

export type ItineraryStage = {
  id: number;
  day_number: number;
  title: string;
  travel_note: string | null;
  altitude_note: string | null;
  is_route_dependent: boolean;
  stay: Stay | null;
};

export type JourneyDetail = JourneySummary & {
  tiers: ServiceTier[];
  stages: ItineraryStage[];
  last_reviewed_at: string | null;
  is_fully_translated: boolean;
};

export type RouteStatus = {
  id: number;
  segment_slug: string;
  segment_name: string;
  access: string;
  label: string;
  freshness: "verified" | "due_for_check" | "stale";
  source: string;
  verified_by: string | null;
  verified_at: string;
  next_verification_due: string;
  summary: string | null;
  requires_permit: boolean;
  blocks_sale: boolean;
};

export type Weather = {
  id: number;
  place: string;
  condition: string;
  temp_min_c: number | null;
  temp_max_c: number | null;
  wind_kph: number | null;
  snow_depth_cm: number | null;
  advisory: string | null;
  source: string;
  is_field_verified: boolean;
  observed_by: string | null;
  observed_at: string;
  next_update_due: string;
  is_stale: boolean;
  is_severe: boolean;
};

export type LiveStatus = {
  routes: RouteStatus[];
  weather: Weather[];
  as_of: string | null;
  any_stale: boolean;
  any_blocking: boolean;
  has_data: boolean;
};

export type Departure = {
  id: number;
  journey_slug: string;
  journey_name: string;
  tier_name: string;
  start_date: string;
  end_date: string;
  gateway: string | null;
  state: string;
  state_label: string;
  capacity: number;
  reserved_count: number;
  availability_label: string;
  price: string | null;
  payment_action: string;
  operator_disclosed: boolean;
  operator_name: string | null;
};

export type DocumentRequirement = {
  id: number;
  code: string;
  label: string;
  description: string | null;
  applies_to: string;
  is_mandatory: boolean;
  is_permit_bearing: boolean;
  requires_file: boolean;
  sort_order: number;
};

export type PermitChecklist = {
  journey_slug: string | null;
  requirements: DocumentRequirement[];
  disclaimer_code: string;
};

/**
 * A failed fetch returns null rather than throwing.
 *
 * Doc 08's resilience rule: "Essential pages available even if CRM or messaging is
 * degraded" and "Clear fallback when live data cannot be fetched". A status widget
 * that cannot reach the API must render as unknown, never as open.
 */
async function get<T>(path: string, locale: Locale, revalidate?: number): Promise<T | null> {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}locale=${locale}`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": locale },
      ...(revalidate === undefined
        ? { cache: "no-store" as const }
        : { next: { revalidate } }),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  journeys: (locale: Locale) => get<JourneySummary[]>("/journeys", locale, 60),
  journey: (slug: string, locale: Locale) =>
    get<JourneyDetail>(`/journeys/${slug}`, locale, 60),
  /** Never cached. See module docstring. */
  status: (locale: Locale) => get<LiveStatus>("/status", locale),
  departures: (locale: Locale) => get<Departure[]>("/departures", locale),
  permitChecklist: (locale: Locale, journey?: string) =>
    get<PermitChecklist>(
      `/permit-checklist${journey ? `?journey=${journey}` : ""}`,
      locale,
      300,
    ),
};

export async function submitEnquiry(payload: Record<string, unknown>) {
  const res = await fetch(`${BASE}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? "We could not send that. Please try again.");
  }
  return res.json();
}
