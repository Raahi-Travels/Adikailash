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

export type AltitudeProfileData = {
  points: {
    day: number;
    place: string;
    altitude_m: number;
    x: number;
    y: number;
    is_rest_day: boolean;
  }[];
  highest_sleeping_altitude_m: number | null;
  total_gain_above_threshold_m: number;
  rest_nights_above_threshold: number;
  guidance_notes: string[];
  guidance_source: string;
  unknown_places: string[];
  is_complete: boolean;
};

export type JourneyDetail = JourneySummary & {
  tiers: ServiceTier[];
  stages: ItineraryStage[];
  last_reviewed_at: string | null;
  is_fully_translated: boolean;
  /** Null when fewer than two nights have a published altitude. */
  altitude: AltitudeProfileData | null;
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


/**
 * What outside sources last told us. Deliberately separate from `LiveStatus`, which
 * is what our own coordinators verified: merging them would put a scraped government
 * table and a person who drove the road behind the same words.
 */
export type LiveSource = {
  source: string;
  /** Shape varies by source. Each consumer knows which one it asked for. */
  payload: Record<string, unknown>;
  fetched_at: string;
  /** Derived server-side at read time from `fetched_at`. */
  is_stale: boolean;
  /** Set when the last fetch failed. The payload is then the previous answer. */
  last_error: string | null;
  source_url: string | null;
};

export type LiveSources = {
  permit_portal: LiveSource | null;
  road_register: LiveSource | null;
  hazard_alerts: LiveSource | null;
  bed_availability: LiveSource | null;
  /** Travels with the data so a page cannot render readings without the caveat. */
  coverage_note: string;
};

export const api = {
  journeys: (locale: Locale) => get<JourneySummary[]>("/journeys", locale, 60),
  journey: (slug: string, locale: Locale) =>
    get<JourneyDetail>(`/journeys/${slug}`, locale, 60),
  /** Never cached. See module docstring. */
  status: (locale: Locale) => get<LiveStatus>("/status", locale),
  /**
   * Cached for five minutes. These are refreshed by a scheduled job rather than by
   * traffic, so a shorter window would just add requests without adding freshness,
   * and a longer one would delay a permit suspension reaching the page.
   */
  live: (locale: Locale) => get<LiveSources>("/live", locale, 300),
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

// --- Traveller document upload -------------------------------------------------

export type TravellerDocument = {
  id: number;
  requirement_code: string;
  requirement_label: string;
  requirement_description: string | null;
  /** Whose document this is. Null on older lead-level checklists. */
  for_traveller: string | null;
  is_mandatory: boolean;
  state: string;
  is_uploaded: boolean;
  is_accepted: boolean;
  awaiting_you: boolean;
  original_filename: string | null;
  uploaded_at: string | null;
  correction_reason: string | null;
  valid_until: string | null;
};

export type TravellerChecklist = {
  traveller_name: string | null;
  documents: TravellerDocument[];
  outstanding_count: number;
  max_bytes: number;
  accepted_content_types: string[];
  disclaimer_code: string;
};

export async function fetchChecklist(
  token: string,
  locale: Locale,
): Promise<TravellerChecklist> {
  const res = await fetch(
    `${BASE}/traveller/documents?token=${encodeURIComponent(token)}&locale=${locale}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? "We could not open this link.");
  }
  return res.json();
}

/**
 * Upload in three steps: get a presigned URL, PUT the file straight to storage,
 * then tell the API it landed.
 *
 * The file never passes through our API. That keeps a 10MB passport scan off the
 * request path entirely, and means the API never holds the bytes.
 */
export async function uploadDocument(
  token: string,
  submissionId: number,
  file: File,
): Promise<void> {
  const ticketRes = await fetch(
    `${BASE}/traveller/documents/${submissionId}/upload-ticket?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: file.type,
        original_filename: file.name,
      }),
    },
  );
  if (!ticketRes.ok) {
    const body = await ticketRes.json().catch(() => ({}));
    throw new Error(body.detail ?? "We could not start the upload.");
  }
  const ticket = await ticketRes.json();

  const put = await fetch(ticket.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) {
    throw new Error("The file could not be uploaded. Please try again.");
  }

  const confirm = await fetch(
    `${BASE}/traveller/documents/${submissionId}/uploaded?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
  if (!confirm.ok) {
    throw new Error(
      "The file uploaded but we could not record it. Please tell the team.",
    );
  }
}


// --- Content hub (Phase 4) -----------------------------------------------------

export type ArticleFaq = { question: string; answer: string };

export type ArticleSummary = {
  slug: string;
  cluster: string;
  title: string;
  /** The standalone answer. Shown in listings so a reader can stop here. */
  answer: string;
  is_pillar: boolean;
  author: string | null;
  reviewed_by: string | null;
  last_reviewed_at: string | null;
  next_review_due: string | null;
  freshness: "current" | "due_soon" | "stale";
  freshness_label: string;
  /** True where a stale page is actively misleading rather than merely old. */
  is_time_sensitive: boolean;
  published_at: string | null;
};

export type ArticleDetail = ArticleSummary & {
  body: string | null;
  journey_slug: string | null;
  faqs: ArticleFaq[];
  related: ArticleSummary[];
};

export const guides = {
  /**
   * Cached briefly rather than never. A guide is not live data, but its freshness
   * label is derived at read time, so a long cache would let a page keep claiming
   * "reviewed" after it had lapsed.
   */
  list: (locale: Locale, cluster?: string) =>
    get<ArticleSummary[]>(
      `/guides${cluster ? `?cluster=${cluster}` : ""}`,
      locale,
      300,
    ),
  detail: (slug: string, locale: Locale) =>
    get<ArticleDetail>(`/guides/${slug}`, locale, 300),
};
