"""Response and request contracts.

Doc 08: "Contracts should use neutral business terms rather than provider-specific
labels." Nothing here names a payment provider, a WhatsApp vendor or the working
brand.

The recurring shape is a value paired with its provenance — a status carries who
verified it and when, a media asset carries how it was produced, a departure carries
whether it may take money. Stripping those pairs out to "simplify" the API would
strip out exactly what makes the product trustworthy.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from api.localization import SUPPORTED_LOCALES


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- catalogue


class DestinationOut(ORMModel):
    id: int
    slug: str
    name: str
    summary: str | None = None
    altitude_m: int | None = None


class ServiceTierOut(ORMModel):
    id: int
    slug: str
    name: str
    differentiators: str | None = None
    max_group_size: int | None = None
    typical_group_size: int | None = None
    is_private: bool
    #: Indicative only. The binding figure lives on a proposal (doc 04).
    indicative_price: Decimal | None = None


class StayOut(ORMModel):
    id: int
    slug: str
    name: str
    kind: str
    host_name: str | None = None
    household_story: str | None = None
    village: str | None = None
    shares_family_meals: bool | None = None
    typical_occupancy: int | None = None
    has_running_hot_water: bool | None = None
    has_heating: bool | None = None
    has_mobile_network: bool | None = None
    is_shared_bathroom: bool | None = None
    limitations_note: str | None = None
    last_verified_by: str | None = None


class ItineraryStageOut(ORMModel):
    id: int
    day_number: int
    title: str
    travel_note: str | None = None
    altitude_note: str | None = None
    is_route_dependent: bool
    stay: StayOut | None = None


class JourneySummaryOut(ORMModel):
    id: int
    slug: str
    name: str
    essence: str | None = None
    family: str
    gateway: str | None = None
    duration_nights: int | None = None
    highest_altitude_m: int | None = None
    is_published: bool


class DestinationAltitudeIn(BaseModel):
    #: Metres. Bounded generously but not absurdly: the highest point on earth is
    #: 8,849m, and a typo of 41500 for 4150 would otherwise redraw the whole profile
    #: and make every other night look like sea level.
    altitude_m: int = Field(ge=0, le=9000)
    #: Required. See `Destination.altitude_source`.
    source: str = Field(min_length=3, max_length=300)
    #: Defaults to false, which is the safe direction. Only a person who has checked
    #: the figure against the source they named should pass true — until then the
    #: number is stored but never plotted publicly.
    verified: bool = False


class AltitudePointOut(BaseModel):
    day: int
    place: str
    altitude_m: int
    #: Pre-computed SVG coordinates. Server-side so the chart is in the HTML: it
    #: renders with no JavaScript on a mid-range Android on mobile data, and an
    #: answer engine can read it. A canvas chart is invisible to both.
    x: float
    y: float
    is_rest_day: bool = False


class AltitudeProfileOut(BaseModel):
    """Sleeping altitude across the itinerary.

    Note the absence of any score, rating or verdict. One of the standing constraints
    is "no medical clearance, diagnosis or fitness certification, by human or AI", so
    every field here describes the *itinerary*. Nothing describes the reader, and a
    green tick on a page like this is the thing that talks somebody out of seeing a
    doctor.
    """

    points: list[AltitudePointOut] = Field(default_factory=list)
    highest_sleeping_altitude_m: int | None = None
    total_gain_above_threshold_m: int = 0
    rest_nights_above_threshold: int = 0
    #: Sentences about the schedule, measured against published general guidance.
    guidance_notes: list[str] = Field(default_factory=list)
    #: Attribution. The guidance is general mountaineering advice, not our medical
    #: opinion, and the page has to say so.
    guidance_source: str = ""
    #: Named rather than hidden. A chart with three of nine points plotted reads as
    #: the whole journey, and the missing ones are the high ones people care about.
    unknown_places: list[str] = Field(default_factory=list)
    is_complete: bool = False


class JourneyDetailOut(JourneySummaryOut):
    tiers: list[ServiceTierOut] = Field(default_factory=list)
    stages: list[ItineraryStageOut] = Field(default_factory=list)
    last_reviewed_at: str | None = None
    #: True when this locale has real translations rather than English fallback.
    is_fully_translated: bool = True
    #: None when the itinerary has fewer than two nights with a published altitude —
    #: there is no profile to draw, and an empty chart is worse than none.
    altitude: AltitudeProfileOut | None = None


# ----------------------------------------------------------------------------- status


class StatusOut(ORMModel):
    """A route status with the provenance that makes it worth believing."""

    id: int
    segment_slug: str
    segment_name: str
    access: str
    #: Human-readable, never colour-only (doc 02).
    label: str
    freshness: Literal["verified", "due_for_check", "stale"]
    source: str
    verified_by: str | None = None
    verified_at: datetime
    next_verification_due: datetime
    summary: str | None = None
    requires_permit: bool
    #: Whether this status should suppress payment on affected departures.
    blocks_sale: bool


class WeatherOut(ORMModel):
    id: int
    place: str
    condition: str
    temp_min_c: float | None = None
    temp_max_c: float | None = None
    wind_kph: float | None = None
    snow_depth_cm: int | None = None
    advisory: str | None = None
    source: str
    is_field_verified: bool
    observed_by: str | None = None
    observed_at: datetime
    next_update_due: datetime
    is_stale: bool
    is_severe: bool


class LiveStatusOut(BaseModel):
    """The composite payload behind the live-status bar and page.

    ``as_of`` is the oldest verification in the set, not the newest. A bar showing
    "updated 10 minutes ago" because one of four readings is fresh, while the road
    condition is three days old, is precisely the false-confidence doc 08 forbids.
    """

    routes: list[StatusOut] = Field(default_factory=list)
    weather: list[WeatherOut] = Field(default_factory=list)
    as_of: datetime | None = None
    any_stale: bool = False
    any_blocking: bool = False
    #: Set when nothing has ever been published — the honest empty state.
    has_data: bool = True


# ------------------------------------------------------------------------- departures


class DepartureOut(ORMModel):
    id: int
    journey_slug: str
    journey_name: str
    tier_name: str
    start_date: date
    end_date: date
    gateway: str | None = None
    state: str
    state_label: str
    capacity: int
    reserved_count: int
    #: Approved availability language, not a raw seat count (doc 03).
    availability_label: str
    price: Decimal | None = None
    payment_action: str
    operator_disclosed: bool
    operator_name: str | None = None


# --------------------------------------------------------------------- permit / docs


class DocumentRequirementOut(ORMModel):
    id: int
    code: str
    label: str
    description: str | None = None
    applies_to: str
    is_mandatory: bool
    is_permit_bearing: bool
    requires_file: bool
    sort_order: int


class PermitChecklistOut(BaseModel):
    journey_slug: str | None = None
    requirements: list[DocumentRequirementOut] = Field(default_factory=list)
    #: Doc 03: completing the checklist never guarantees a permit. Sent with the
    #: payload so no client can render the list without the caveat.
    disclaimer_code: str = "checklist_does_not_guarantee_permit"


class DocumentSubmissionOut(ORMModel):
    id: int
    requirement_code: str
    requirement_label: str
    state: str
    original_filename: str | None = None
    uploaded_at: datetime | None = None
    reviewed_at: datetime | None = None
    correction_reason: str | None = None
    valid_until: date | None = None
    #: Upload is not approval (doc 05). Kept explicit so no UI can conflate them.
    is_accepted: bool


class TravellerDocumentOut(BaseModel):
    """One checklist item as the traveller sees it.

    `is_uploaded` and `is_accepted` are separate fields on purpose. Doc 05 forbids
    labelling a document approved merely because it was uploaded, and a single
    combined status is exactly how that mistake gets made in the UI.
    """

    id: int
    requirement_code: str
    requirement_label: str
    requirement_description: str | None = None
    #: Whose document this is. A party of four produces four identical-looking
    #: "Government photo ID" rows, and without a name the list is unusable.
    for_traveller: str | None = None
    is_mandatory: bool
    state: str
    is_uploaded: bool
    is_accepted: bool
    awaiting_you: bool
    original_filename: str | None = None
    uploaded_at: datetime | None = None
    #: Customer-facing only. Internal review notes are never sent here.
    correction_reason: str | None = None
    valid_until: date | None = None


class TravellerChecklistOut(BaseModel):
    traveller_name: str | None = None
    documents: list[TravellerDocumentOut] = Field(default_factory=list)
    outstanding_count: int = 0
    max_bytes: int
    accepted_content_types: list[str] = Field(default_factory=list)
    #: Submission is never approval, and approval is never a permit guarantee.
    disclaimer_code: str = "checklist_does_not_guarantee_permit"


class UploadTicketIn(BaseModel):
    """Content type is required so it can be signed into the presigned URL.

    Without it the ticket could be reused to upload a different kind of file than
    the one that passed validation.
    """

    content_type: Literal[
        "image/jpeg", "image/png", "image/heic", "application/pdf"
    ]
    original_filename: str | None = Field(default=None, max_length=255)


class UploadTicketOut(BaseModel):
    """A short-lived, single-purpose upload grant.

    The client never receives a bucket path it can reuse. Doc 08: "Do not expose raw
    document locations directly to public clients."
    """

    submission_id: int
    upload_url: str
    expires_at: datetime
    max_bytes: int
    accepted_content_types: list[str]


# ----------------------------------------------------------------------------- leads


class ConsentIn(BaseModel):
    purpose: Literal["essential_trip", "route_status_alerts", "promotional"]
    channel: Literal["whatsapp", "email", "sms", "phone"]
    granted: bool


class LeadIn(BaseModel):
    """Doc 03: "Ask only what is necessary for the current stage."

    No document fields, no medical history — doc 04 forbids collecting either in a
    public enquiry form.
    """

    name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=320)
    preferred_language: str = "en"
    country: str | None = Field(default=None, max_length=80)
    origin_city: str | None = Field(default=None, max_length=120)

    journey_slug: str | None = None
    departure_id: int | None = None
    group_size: int | None = Field(default=None, ge=1, le=100)
    is_senior_inclusive: bool | None = None
    tier_preference: str | None = Field(default=None, max_length=60)
    primary_concern: str | None = Field(default=None, max_length=2000)

    # Attribution — doc 07 requires lead-to-campaign traceability.
    first_touch_source: str | None = Field(default=None, max_length=120)
    campaign: str | None = Field(default=None, max_length=160)
    landing_page: str | None = None
    referrer: str | None = None

    consents: list[ConsentIn] = Field(default_factory=list)

    #: Which form this came through. The specialised pages post the same endpoint —
    #: doc 04 wants one pipeline, not three inboxes for a three-person team.
    enquiry_kind: Literal[
        "standard", "private_or_international", "b2b_ground_handling"
    ] = "standard"
    #: Present only for the specialised forms.
    detail: EnquiryDetailIn | None = None
    #: Typed by the enquirer, exactly as they read it off a message. Normalised and
    #: matched server-side; an unrecognised code is still recorded.
    referral_code: str | None = Field(default=None, max_length=40)

    @field_validator("preferred_language")
    @classmethod
    def _known_locale(cls, v: str) -> str:
        return v if v in SUPPORTED_LOCALES else "en"

    def has_contact(self) -> bool:
        return bool((self.phone or "").strip() or (self.email or "").strip())


class LeadOut(BaseModel):
    id: int
    stage: str
    #: What the traveller should expect next, so no one is left guessing (doc 01).
    next_step_code: str = "human_will_make_contact"


# ------------------------------------------------------------------------ admin write


class LocalizedIn(BaseModel):
    """Localized text on the way in. English is mandatory — mirrors the DB CHECK."""

    en: str = Field(min_length=1)
    hi: str | None = None

    def to_jsonb(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"en": self.en.strip()}
        if self.hi and self.hi.strip():
            payload["hi"] = self.hi.strip()
        return payload


class JourneyIn(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9-]+$", max_length=120)
    name: LocalizedIn
    essence: LocalizedIn | None = None
    family: str
    gateway: str | None = None
    duration_nights: int | None = Field(default=None, ge=1, le=60)
    highest_altitude_m: int | None = Field(default=None, ge=0, le=9000)
    is_published: bool = False


class DepartureTransitionIn(BaseModel):
    """Doc 09: every state change is attributable. Both fields are required."""

    target_state: str
    reason: str = Field(min_length=3, max_length=1000)


class StatusPublishIn(BaseModel):
    route_segment_slug: str
    access: str
    source: str
    summary: LocalizedIn
    #: Hours until this reading must be re-checked. Forces an explicit commitment
    #: rather than letting a status sit as "current" indefinitely.
    valid_for_hours: int = Field(default=12, ge=1, le=168)


class WeatherPublishIn(BaseModel):
    destination_slug: str | None = None
    route_segment_slug: str | None = None
    condition: str
    temp_min_c: float | None = None
    temp_max_c: float | None = None
    wind_kph: float | None = None
    snow_depth_cm: int | None = None
    advisory: LocalizedIn | None = None
    source: str
    is_field_verified: bool = False
    valid_for_hours: int = Field(default=6, ge=1, le=72)


class DocumentReviewIn(BaseModel):
    decision: Literal["accept", "request_correction", "waive"]
    correction_reason: LocalizedIn | None = None
    waiver_reason: str | None = None
    valid_until: date | None = None


# ------------------------------------------------------------------- sales workspace


class LeadListItemOut(BaseModel):
    """One row in the sales queue.

    Doc 04's manager view is built around exceptions, so the row carries what makes a
    lead *actionable* — owner, next action, whether it is overdue — rather than a
    generic contact dump.
    """

    id: int
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    origin_city: str | None = None
    journey_name: str | None = None
    group_size: int | None = None
    is_senior_inclusive: bool | None = None
    primary_concern: str | None = None
    stage: str
    priority: int
    owner: str | None = None
    next_action: str | None = None
    next_action_due_at: datetime | None = None
    #: Derived, not stored: a due date in the past.
    is_overdue: bool = False
    #: Doc 04: "Leads without owner" is a first-class management view.
    is_unassigned: bool = False
    first_touch_source: str | None = None
    campaign: str | None = None
    created_at: datetime
    consents: list[str] = Field(default_factory=list)


class LeadQueueOut(BaseModel):
    leads: list[LeadListItemOut] = Field(default_factory=list)
    unassigned_count: int = 0
    overdue_count: int = 0
    total: int = 0


class LeadUpdateIn(BaseModel):
    """Sales edits. Stage changes that close a lead must carry a reason."""

    stage: str | None = None
    owner: str | None = Field(default=None, max_length=120)
    next_action: str | None = Field(default=None, max_length=1000)
    next_action_due_at: datetime | None = None
    priority: int | None = Field(default=None, ge=0, le=3)
    loss_reason: str | None = Field(default=None, max_length=120)
    nurture_topic: str | None = Field(default=None, max_length=120)


# --- Reservations (Phase 2, decision O3: offline payments only) -----------------


class ReservationCreateIn(BaseModel):
    """Open a reservation. Starts in draft; nothing is held until it is moved."""

    departure_id: int
    party_size: int = Field(ge=1, le=40)
    #: Optional: a walk-in or a phone call is a legitimate origin with no lead row.
    lead_id: int | None = None
    agreed_amount: Decimal = Field(default=Decimal("0"), ge=0)
    coordinator_staff_id: str | None = Field(default=None, max_length=64)
    internal_note: str | None = None


class ReservationUpdateIn(BaseModel):
    party_size: int | None = Field(default=None, ge=1, le=40)
    agreed_amount: Decimal | None = Field(default=None, ge=0)
    coordinator_staff_id: str | None = Field(default=None, max_length=64)
    next_action: str | None = Field(default=None, max_length=1000)
    next_action_due_at: datetime | None = None
    hold_expires_at: datetime | None = None
    internal_note: str | None = None


class TravellerIn(BaseModel):
    """One named person. Identity numbers are not accepted here by design.

    Doc 08 classifies document numbers as Sensitive; they belong in the document
    submission path, which logs every access. Accepting one on this endpoint would
    put a passport number in a table any reservation query could return.
    """

    full_name: str = Field(min_length=1, max_length=200)
    role: str = "companion"
    date_of_birth: date | None = None
    relationship_to_lead: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=320)
    is_senior: bool = False
    has_disclosed_health_information: bool = False
    dietary_note: str | None = None


class TravellerOut(ORMModel):
    id: int
    full_name: str
    role: str
    date_of_birth: date | None = None
    relationship_to_lead: str | None = None
    phone: str | None = None
    email: str | None = None
    is_senior: bool = False
    has_disclosed_health_information: bool = False
    dietary_note: str | None = None


class PaymentIn(BaseModel):
    """Record money that actually moved. Amount is always positive."""

    amount: Decimal = Field(gt=0)
    method: str
    direction: str = "received"
    reference: str | None = Field(default=None, max_length=120)
    received_at: datetime
    note: str | None = None


class PaymentOut(ORMModel):
    id: int
    direction: str
    amount: Decimal
    currency: str
    method: str
    reference: str | None = None
    received_at: datetime
    recorded_by: str
    note: str | None = None


class PolicyAcceptanceIn(BaseModel):
    """Which version of which policy, accepted by whom.

    `version` is required and unbounded by design: it must identify the exact text
    the person saw, so a date or a content hash both work, but "latest" does not.
    """

    policy: str = Field(max_length=40)
    version: str = Field(min_length=1, max_length=40)
    accepted_by: str = Field(min_length=1, max_length=200)
    accepted_at: datetime | None = None
    channel: str | None = Field(default=None, max_length=40)


class PolicyAcceptanceOut(ORMModel):
    id: int
    policy: str
    version: str
    accepted_by: str
    accepted_at: datetime | None = None
    channel: str | None = None
    recorded_by: str | None = None


class ReadinessOut(BaseModel):
    """What is still missing before this group can travel."""

    documents_outstanding: int = 0
    travellers_named: int = 0
    travellers_expected: int = 0
    policy_accepted: bool = False
    coordinator: str | None = None
    amount_due: Decimal = Decimal("0")
    amount_received: Decimal = Decimal("0")
    balance_outstanding: Decimal = Decimal("0")
    party_complete: bool = False
    is_ready: bool = False
    #: Plain-language, in the order a coordinator should chase it.
    outstanding: list[str] = Field(default_factory=list)


class ReservationListItemOut(BaseModel):
    id: int
    reference: str
    state: str
    departure_id: int
    journey_name: str | None = None
    start_date: date | None = None
    party_size: int
    travellers_named: int = 0
    coordinator: str | None = None
    group_lead_name: str | None = None
    agreed_amount: Decimal = Decimal("0")
    amount_received: Decimal = Decimal("0")
    balance_outstanding: Decimal = Decimal("0")
    next_action: str | None = None
    next_action_due_at: datetime | None = None
    is_overdue: bool = False
    hold_expires_at: datetime | None = None
    #: A hold past its expiry is holding capacity nobody has claimed.
    hold_expired: bool = False
    created_at: datetime


class ReservationDetailOut(ReservationListItemOut):
    currency: str = "INR"
    internal_note: str | None = None
    cancellation_reason: str | None = None
    travellers: list[TravellerOut] = Field(default_factory=list)
    payments: list[PaymentOut] = Field(default_factory=list)
    acceptances: list[PolicyAcceptanceOut] = Field(default_factory=list)
    readiness: ReadinessOut
    #: Empty means this reservation can be confirmed right now.
    confirmation_blockers: list[str] = Field(default_factory=list)
    allowed_transitions: list[str] = Field(default_factory=list)


class ReservationQueueOut(BaseModel):
    reservations: list[ReservationListItemOut] = Field(default_factory=list)
    total: int = 0
    unassigned_count: int = 0
    overdue_count: int = 0
    expired_hold_count: int = 0


class ReservationTransitionIn(BaseModel):
    """Actor comes from the session, never from the body."""

    target_state: str
    reason: str = Field(min_length=1)


class BookingTravellerOut(BaseModel):
    """A party member as the group lead sees them.

    Names and whether altitude planning treats them as an elder. No contact details
    for other adults, no health flag, no date of birth: doc 05 says the portal shows
    the traveller their own record, and one person's medication is not another
    person's business even inside a family.
    """

    full_name: str
    role: str
    is_senior: bool = False


class BookingPaymentOut(BaseModel):
    """The payment trail, as evidence rather than as a balance."""

    direction: str
    amount: Decimal
    method: str
    reference: str | None = None
    received_at: datetime


class BookingAcceptanceOut(BaseModel):
    policy: str
    version: str
    accepted_by: str
    accepted_at: datetime | None = None


class TravellerBookingOut(BaseModel):
    """What a traveller sees at their own link.

    Doc 09's Phase 2 exit condition is that every reserved group has a visible state,
    payment trail, accepted terms, preparation owner and next action. This is the
    customer half of "visible". `state_label` and `state_meaning` exist because
    "held" is the word that would mislead someone into cancelling other plans.
    """

    reference: str
    state: str
    #: Short, plain, and never more confident than the state.
    state_label: str
    #: One sentence saying what it actually means for them.
    state_meaning: str
    journey_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    gateway: str | None = None

    party_size: int
    travellers: list[BookingTravellerOut] = Field(default_factory=list)

    #: Doc 05: "Named coordinator." Null renders as an honest gap, not a fake name.
    coordinator: str | None = None

    amount_due: Decimal = Decimal("0")
    amount_received: Decimal = Decimal("0")
    balance_outstanding: Decimal = Decimal("0")
    currency: str = "INR"
    payments: list[BookingPaymentOut] = Field(default_factory=list)
    #: True while decision O8 is open. The portal must not show a pay button.
    online_payment_available: bool = False

    accepted_policies: list[BookingAcceptanceOut] = Field(default_factory=list)

    documents_outstanding: int = 0
    #: Plain language, the same list the coordinator sees, minus anything internal.
    outstanding: list[str] = Field(default_factory=list)
    is_ready: bool = False
    #: What we have told this party, newest first. Doc 09: preserve a record of what
    #: customers were told.
    updates: list[UpdateOut] = Field(default_factory=list)


# --- Departure manifest and booking updates (Phase 3) ---------------------------


class ManifestTravellerOut(BaseModel):
    """One person on the manifest.

    This is the list a coordinator reads out at a checkpost, so it carries what
    matters there and nothing else. No contact details for companions, no health
    detail: only the flag saying somebody should go and read it where access is
    logged.
    """

    full_name: str
    role: str
    date_of_birth: date | None = None
    is_senior: bool = False
    has_disclosed_health_information: bool = False
    documents_outstanding: int = 0
    permit_documents_outstanding: int = 0


class ManifestPartyOut(BaseModel):
    reservation_id: int
    reference: str
    state: str
    group_lead: str | None = None
    coordinator: str | None = None
    party_size: int
    travellers: list[ManifestTravellerOut] = Field(default_factory=list)
    documents_outstanding: int = 0
    permit_documents_outstanding: int = 0
    policy_accepted: bool = False
    balance_outstanding: Decimal = Decimal("0")


class ManifestOut(BaseModel):
    """Everything needed to decide whether a departure can leave.

    `blockers` and `warnings` are separate because conflating them makes the screen
    noise. A blocker stops the departure; a warning is worth chasing and is never a
    reason to hold a convoy at Dharchula.
    """

    departure_id: int
    journey_name: str | None = None
    tier_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    gateway: str | None = None
    state: str
    operator_name: str | None = None
    capacity: int = 0

    parties: list[ManifestPartyOut] = Field(default_factory=list)
    confirmed_parties: int = 0
    confirmed_travellers: int = 0
    unresolved_holds: int = 0

    can_depart: bool = False
    blockers: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class UpdateIn(BaseModel):
    """Something to tell a party. There is no edit endpoint by design."""

    category: str = "general"
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)


class UpdateOut(ORMModel):
    id: int
    category: str
    title: str
    body: str
    published_by: str
    acknowledged_at: datetime | None = None
    created_at: datetime


# `TravellerBookingOut` references `UpdateOut`, which is declared later in this
# module for grouping reasons. Resolve it explicitly rather than reordering.
TravellerBookingOut.model_rebuild()


# --- Suppliers, payables, rooming and incidents (Phase 3) ----------------------


class SupplierIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    kind: str
    contact_name: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    village: str | None = Field(default=None, max_length=160)
    stay_id: int | None = None
    reliability_note: str | None = None


class SupplierOut(ORMModel):
    id: int
    name: str
    kind: str
    contact_name: str | None = None
    phone: str | None = None
    village: str | None = None
    stay_id: int | None = None
    reliability_note: str | None = None
    is_active: bool = True


class SupplierBookingIn(BaseModel):
    supplier_id: int
    service: str = Field(min_length=1)
    starts_on: date | None = None
    ends_on: date | None = None
    agreed_cost: Decimal = Field(default=Decimal("0"), ge=0)
    note: str | None = None


class SupplierBookingUpdateIn(BaseModel):
    state: str | None = None
    service: str | None = None
    agreed_cost: Decimal | None = Field(default=None, ge=0)
    cancellation_reason: str | None = None
    note: str | None = None


class SupplierPaymentIn(BaseModel):
    """Money paid to a supplier. Same shape as the customer ledger, other direction."""

    amount: Decimal = Field(gt=0)
    method: str
    direction: str = "received"
    reference: str | None = Field(default=None, max_length=120)
    paid_at: datetime
    note: str | None = None


class SupplierPaymentOut(ORMModel):
    id: int
    direction: str
    amount: Decimal
    currency: str
    method: str
    reference: str | None = None
    paid_at: datetime
    recorded_by: str
    note: str | None = None


class SupplierBookingOut(BaseModel):
    id: int
    supplier_id: int
    supplier_name: str
    kind: str
    service: str
    state: str
    starts_on: date | None = None
    ends_on: date | None = None
    agreed_cost: Decimal = Decimal("0")
    paid: Decimal = Decimal("0")
    outstanding: Decimal = Decimal("0")
    #: Paying more than agreed is a variation nobody recorded, or a mistake. Both
    #: need a human, so it is surfaced rather than clamped.
    is_overpaid: bool = False
    currency: str = "INR"
    confirmed_by: str | None = None
    cancellation_reason: str | None = None
    note: str | None = None
    payments: list[SupplierPaymentOut] = Field(default_factory=list)


class EconomicsOut(BaseModel):
    """Per-departure unit economics, from committed cost and agreed revenue."""

    customer_revenue_agreed: Decimal = Decimal("0")
    customer_revenue_received: Decimal = Decimal("0")
    committed_cost: Decimal = Decimal("0")
    paid_to_suppliers: Decimal = Decimal("0")
    owed_to_suppliers: Decimal = Decimal("0")
    margin: Decimal = Decimal("0")
    margin_percent: Decimal | None = None
    is_loss_making: bool = False


class RoomingAssignmentIn(BaseModel):
    reservation_traveller_id: int
    stay_id: int
    night: date
    note: str | None = None


class RoomingBedOut(BaseModel):
    id: int
    reservation_traveller_id: int
    traveller_name: str
    stay_id: int
    stay_name: str
    night: date
    note: str | None = None


class RoomingOut(BaseModel):
    beds: list[RoomingBedOut] = Field(default_factory=list)
    nights: list[date] = Field(default_factory=list)
    #: Over-capacity strands a family at altitude at night, so it is a blocker.
    over_capacity: list[str] = Field(default_factory=list)
    #: Somebody has to ask the household before the vehicles leave.
    unknown_capacity: list[str] = Field(default_factory=list)
    unassigned: list[str] = Field(default_factory=list)
    is_complete: bool = False


class IncidentIn(BaseModel):
    """Report something that went wrong.

    `observed` is what was seen. It is never a diagnosis: the standing constraint is
    "no medical clearance, diagnosis or fitness certification, by human or AI".
    """

    severity: str
    category: str
    occurred_at: datetime
    observed: str = Field(min_length=1)
    immediate_action: str | None = None
    departure_id: int | None = None
    reservation_id: int | None = None
    reservation_traveller_id: int | None = None
    supplier_id: int | None = None


class IncidentUpdateIn(BaseModel):
    immediate_action: str | None = None
    outcome: str | None = None
    travellers_informed: bool | None = None
    #: Setting this closes the incident. The API refuses without an outcome.
    resolve: bool = False


class IncidentOut(ORMModel):
    id: int
    severity: str
    category: str
    occurred_at: datetime
    observed: str
    immediate_action: str | None = None
    outcome: str | None = None
    reported_by: str
    resolved_at: datetime | None = None
    resolved_by: str | None = None
    travellers_informed: bool = False
    departure_id: int | None = None
    reservation_id: int | None = None
    created_at: datetime
    #: Derived from severity and how long it has been open.
    is_open: bool = True
    is_overdue: bool = False
    needs_founder: bool = False
    obligations: list[str] = Field(default_factory=list)


# --- Content hub (Phase 4, doc 07) ---------------------------------------------


class ArticleFaqOut(BaseModel):
    question: str
    answer: str


class ArticleSummaryOut(BaseModel):
    slug: str
    cluster: str
    title: str
    #: The standalone answer. Rendered at the top of the page and in listings, because
    #: a listing that shows only a title makes the reader click to find out whether
    #: the page is even about their question.
    answer: str
    is_pillar: bool = False
    author: str | None = None
    reviewed_by: str | None = None
    last_reviewed_at: datetime | None = None
    next_review_due: datetime | None = None
    #: current | due_soon | stale. Derived, never stored.
    freshness: str = "stale"
    freshness_label: str = "Not recently reviewed"
    #: True where a stale page is actively misleading rather than merely old.
    is_time_sensitive: bool = False
    published_at: datetime | None = None


class ArticleDetailOut(ArticleSummaryOut):
    body: str | None = None
    journey_slug: str | None = None
    faqs: list[ArticleFaqOut] = Field(default_factory=list)
    #: Supporting pieces under a pillar, so the cluster is navigable.
    related: list[ArticleSummaryOut] = Field(default_factory=list)


class ArticleIn(BaseModel):
    slug: str = Field(min_length=1, max_length=160)
    cluster: str
    title: LocalizedIn
    answer: LocalizedIn
    body: LocalizedIn | None = None
    journey_slug: str | None = None
    is_pillar: bool = False
    parent_slug: str | None = None
    review_interval_days: int = Field(default=180, ge=1, le=1095)
    internal_note: str | None = None


class ArticleReviewIn(BaseModel):
    """Record a review. `reviewed_by` comes from the session, never the body."""

    author: str | None = Field(default=None, max_length=120)
    state: str | None = None


# --- Route-status subscriptions (Phase 4) --------------------------------------


class SubscribeIn(BaseModel):
    """Ask for route alerts.

    `channel` and `destination` rather than a typed phone/email pair, because the
    same record has to serve WhatsApp, SMS and email and decision O9 has not chosen.
    """

    channel: str = "email"
    destination: str = Field(min_length=3, max_length=320)
    name: str | None = Field(default=None, max_length=200)
    #: Null subscribes to every segment, which is what most people want.
    route_segment_slug: str | None = None
    source_page: str | None = Field(default=None, max_length=200)
    #: Must be true. Present so the request carries an explicit act of consent rather
    #: than consent being implied by the endpoint being called.
    consent: bool = False


class SubscriptionOut(BaseModel):
    state: str
    channel: str
    #: Partially masked. A confirmation screen should not print somebody's full
    #: number back at them on a page that might be shoulder-read.
    destination_hint: str
    segment_name: str | None = None
    message: str


class OutboundMessageOut(ORMModel):
    id: int
    channel: str
    destination: str
    subject: str
    body: str
    urgency: str
    state: str
    send_after: datetime
    sent_at: datetime | None = None
    suppressed_reason: str | None = None
    #: Set for WhatsApp and SMS, which can only carry pre-approved wording. Null for
    #: email. Shown in the admin so it is obvious at a glance which messages depend
    #: on a template being approved before they can go anywhere.
    template_name: str | None = None
    template_parameters: list[str] | None = None
    created_at: datetime


class OutboundQueueOut(BaseModel):
    messages: list[OutboundMessageOut] = Field(default_factory=list)
    queued: int = 0
    suppressed: int = 0
    sent: int = 0
    active_subscribers: int = 0
    #: False until decision O9 settles a provider. The admin says so rather than
    #: letting a growing backlog look like a bug.
    sending_enabled: bool = False


# --------------------------------------------------------------- specialised enquiries


class EnquiryDetailIn(BaseModel):
    """The extra answers doc 03 asks for on the private/international form, plus the
    B2B ground-handling fields.

    Every field is optional. Doc 03 says "Ask only what is necessary for the current
    stage", and the current stage is *getting somebody to write to us at all*. A
    fourteen-field required form on a first contact from Ohio is how you convert a
    curious traveller into a bounce.
    """

    # Private / international
    date_flexibility: str | None = Field(default=None, max_length=2000)
    group_size_min: int | None = Field(default=None, ge=1, le=200)
    group_size_max: int | None = Field(default=None, ge=1, le=200)
    age_range: str | None = Field(default=None, max_length=120)
    experience_preference: str | None = Field(default=None, max_length=2000)
    gateway_needs: str | None = Field(default=None, max_length=2000)
    interests: str | None = Field(default=None, max_length=2000)
    time_zone: str | None = Field(default=None, max_length=64)
    consultation_window: str | None = Field(default=None, max_length=160)
    consultation_channel: str | None = Field(default=None, max_length=40)
    #: Doc 03: what the traveller *chooses* to disclose. Never required, never shown
    #: in a list view, never exported to a partner.
    accessibility_needs: str | None = Field(default=None, max_length=2000)

    # B2B ground handling
    company_name: str | None = Field(default=None, max_length=200)
    company_role: str | None = Field(default=None, max_length=120)
    company_website: str | None = Field(default=None, max_length=300)
    company_registration: str | None = Field(default=None, max_length=80)
    services_needed: str | None = Field(default=None, max_length=1000)
    volume_estimate: str | None = Field(default=None, max_length=200)
    season_of_interest: str | None = Field(default=None, max_length=120)


# ----------------------------------------------------------------- advocacy


class FeedbackIn(BaseModel):
    """The private post-trip form.

    Ratings are 1-5 and `None` means unanswered — which is emphatically not a 1. A
    form posting 0 for an untouched control would otherwise record every skipped
    question as the worst possible score and open a complaint that nobody made.
    """

    submitted_by: str | None = Field(default=None, max_length=200)

    sales_promise_accuracy: int | None = Field(default=None, ge=1, le=5)
    preparation: int | None = Field(default=None, ge=1, le=5)
    pickup_and_transport: int | None = Field(default=None, ge=1, le=5)
    accommodation: int | None = Field(default=None, ge=1, le=5)
    coordinator_support: int | None = Field(default=None, ge=1, le=5)
    route_communication: int | None = Field(default=None, ge=1, le=5)
    spiritual_and_cultural: int | None = Field(default=None, ge=1, le=5)

    recommend_score: int | None = Field(default=None, ge=0, le=10)
    what_went_well: str | None = Field(default=None, max_length=4000)
    what_went_wrong: str | None = Field(default=None, max_length=4000)


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    submitted_at: datetime | None = None
    #: What we will do next, in words, so submitting does not feel like a void.
    message: str = ""
    #: True when the answers opened at least one complaint. The traveller is told
    #: plainly that somebody will call, rather than being thanked and forgotten.
    will_follow_up: bool = False


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dimension: str
    rating: int | None = None
    detail: str | None = None
    resolution_state: str
    resolution_note: str | None = None
    resolved_by: str | None = None
    resolved_at: datetime | None = None


class ComplaintResolutionIn(BaseModel):
    """Resolving a complaint requires saying what was done.

    `resolution_note` is required and non-empty at the schema, the domain and the
    database. Three layers for one rule because "resolved" with no note is a
    coordinator clearing a screen, and the whole review gate depends on this
    meaning something.
    """

    state: Literal["resolved", "acknowledged"]
    resolution_note: str = Field(min_length=10, max_length=4000)


class FeedbackReviewOut(BaseModel):
    """A staff view of one feedback record and whether we may ask for a review."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    reservation_id: int
    reservation_reference: str | None = None
    submitted_at: datetime | None = None
    submitted_by: str | None = None
    recommend_score: int | None = None
    what_went_well: str | None = None
    what_went_wrong: str | None = None
    ratings: dict[str, int] = Field(default_factory=dict)
    complaints: list[ComplaintOut] = Field(default_factory=list)
    open_complaint_count: int = 0
    #: Empty means we may ask. Non-empty is the list of things to do first.
    review_request_blockers: list[str] = Field(default_factory=list)
    already_asked: bool = False


class ReviewRequestIn(BaseModel):
    platform: Literal["google", "tripadvisor", "own_site"]
    #: Asked separately, per doc 07 step 5. Bundling these is how a family's
    #: photograph ends up on a landing page after they agreed to write a sentence.
    may_publish_written_review: bool = False
    may_publish_images: bool = False
    may_publish_story: bool = False
    permission_note: str | None = Field(default=None, max_length=2000)


class ReviewRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    platform: str
    asked_at: datetime | None = None
    asked_by: str | None = None
    may_publish_written_review: bool = False
    may_publish_images: bool = False
    may_publish_story: bool = False


class ReferralOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    referrer_name: str | None = None
    terms_version: str
    benefit: str | None = None
    is_active: bool = True
    #: How many people arrived with it. Attribution is the point (doc 07).
    times_used: int = 0
    #: Ready to paste into a message, with no superlatives put in their mouth.
    share_text: str = ""
    terms: list[str] = Field(default_factory=list)


# ------------------------------------------------------------- family sharing


class FamilyShareIn(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    #: A group lead who does not want daily movement shared can say so here without
    #: giving up the link entirely.
    shows_check_ins: bool = True


class FamilyShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    #: The full URL to send. Returned once at creation and on the manage list —
    #: the group lead needs to be able to re-send it.
    url: str = ""
    expires_at: datetime
    revoked_at: datetime | None = None
    shows_check_ins: bool = True
    view_count: int = 0
    last_viewed_at: datetime | None = None


class SharedContactOut(BaseModel):
    label: str
    phone: str
    note: str | None = None


class SharedDayOut(BaseModel):
    #: Named `on_date` rather than `date`: a field called `date` shadows the
    #: imported `date` type inside the class body, and every later annotation in the
    #: model fails to resolve. Pydantic reports it as an unevaluatable annotation
    #: several classes further down, which is a long way from the cause.
    day: int
    on_date: date | None = None
    title: str
    staying_at: str | None = None


class SharedCheckInOut(BaseModel):
    at: datetime
    note: str
    posted_by: str


class FamilyViewOut(BaseModel):
    """The reassurance view. Mirrors `api.domain.sharing.FamilyView` exactly.

    Kept as its own model rather than serialising an ORM object, for the same reason
    the domain type exists: nothing sensitive can reach it without somebody adding a
    field here on purpose.
    """

    journey_name: str
    starts_on: date | None = None
    ends_on: date | None = None
    traveller_first_names: list[str] = Field(default_factory=list)
    days: list[SharedDayOut] = Field(default_factory=list)
    contacts: list[SharedContactOut] = Field(default_factory=list)
    latest_check_in: SharedCheckInOut | None = None
    route_notices: list[str] = Field(default_factory=list)
    shared_by: str | None = None
    shared_with_label: str | None = None


# ------------------------------------------------------------- trip companion


class CheckInIn(BaseModel):
    note: str = Field(min_length=1, max_length=2000)
    location: str | None = Field(default=None, max_length=160)
    occurred_at: datetime | None = None
    is_shareable: bool = True


class CompanionDayOut(BaseModel):
    day: int
    on_date: date | None = None
    title: str
    travel_note: str | None = None
    altitude_note: str | None = None
    staying_at: str | None = None
    stay_note: str | None = None
    is_route_dependent: bool = False
    #: Today, per the departure's dates. Drives what the page opens on.
    is_today: bool = False


class CompanionOut(BaseModel):
    """Everything the during-trip page needs, in one payload.

    One request rather than several on purpose: this is cached and read at 4,000m
    with no signal, and a page assembled from five endpoints is a page that renders
    four-fifths of itself in the one place it has to work.
    """

    reference: str
    journey_name: str
    starts_on: date | None = None
    ends_on: date | None = None
    state: str

    days: list[CompanionDayOut] = Field(default_factory=list)
    today: CompanionDayOut | None = None
    next_movement: CompanionDayOut | None = None

    contacts: list[SharedContactOut] = Field(default_factory=list)
    route_notices: list[str] = Field(default_factory=list)
    latest_check_in: SharedCheckInOut | None = None

    #: When the server built this. The page shows it when serving from cache, so
    #: "last saved 9 hours ago" is visible rather than implied to be live.
    generated_at: datetime


# ------------------------------------------------------- contribution by source


class SpendIn(BaseModel):
    channel: str = Field(min_length=1, max_length=120)
    campaign: str | None = Field(default=None, max_length=160)
    period_start: date
    period_end: date
    amount: Decimal = Field(ge=0)
    note: str | None = Field(default=None, max_length=2000)


class SpendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    channel: str
    campaign: str
    period_start: date
    period_end: date
    amount: Decimal
    currency: str
    note: str | None = None
    recorded_by: str | None = None


class SourcePerformanceOut(BaseModel):
    """One acquisition source, reduced to what it actually contributed.

    Note what is *not* here: no "revenue" field. Doc 07 forbids reporting on gross
    booking value where supplier costs and refunds matter, and the surest way to stop
    somebody quoting gross is not to return it under a name that invites it.
    `gross_agreed` is present and named so that it cannot be mistaken for the answer.
    """

    source: str
    leads: int = 0
    reservations: int = 0
    earning_reservations: int = 0
    conditional_reservations: int = 0
    travellers: int = 0

    gross_agreed: Decimal = Decimal("0")
    supplier_cost: Decimal = Decimal("0")
    refunded: Decimal = Decimal("0")
    received: Decimal = Decimal("0")
    contribution: Decimal = Decimal("0")
    #: Indian lakh grouping. Two screens showing 1,50,000 and 150,000 for the same
    #: figure is a small thing that costs real trust in a finance number.
    contribution_display: str = ""
    contribution_margin_percent: Decimal | None = None
    #: Proposed and held reservations. Reported beside contribution, never inside it.
    conditional_value: Decimal = Decimal("0")

    lead_to_reservation_percent: Decimal | None = None
    contribution_per_lead: Decimal | None = None

    #: None means no spend was recorded, which is not the same as zero.
    spend: Decimal | None = None
    cost_per_qualified_lead: Decimal | None = None
    acquisition_share_of_contribution: Decimal | None = None

    is_low_confidence: bool = False
    #: Text, so the warning survives being copied out of this screen into a message.
    caveats: list[str] = Field(default_factory=list)


class ContributionReportOut(BaseModel):
    #: Named in the payload so nobody reads these as settled truth. First-touch
    #: flatters whatever people find first and undercredits what convinced them.
    attribution_model: str = "first-touch"
    sources: list[SourcePerformanceOut] = Field(default_factory=list)
    total_contribution: Decimal = Decimal("0")
    total_contribution_display: str = ""
    total_conditional_value: Decimal = Decimal("0")
    #: Two shares, because they diverge and the divergence is the signal. A walk-in
    #: booked over the phone has no lead row, so it can be a large slice of
    #: contribution while the lead-based figure reports zero — which is exactly what
    #: the first real run of this report did.
    unattributed_lead_share_percent: Decimal | None = None
    unattributed_contribution_share_percent: Decimal | None = None
    #: Spend recorded against a channel no lead ever came from — almost always a typo
    #: in the channel name, and silently ignoring it flatters every other channel.
    unmatched_spend_channels: list[str] = Field(default_factory=list)


# ------------------------------------------------------------ vendor performance


class SupplierReviewIn(BaseModel):
    """Doc 06's post-departure vendor assessment.

    Every rating is optional and `None` means unanswered. A coordinator who did not
    see the rooms should not be made to guess, and a forced guess is worse data than
    a gap.
    """

    departure_id: int

    confirmation_reliability: int | None = Field(default=None, ge=1, le=5)
    punctuality: int | None = Field(default=None, ge=1, le=5)
    accuracy_against_promise: int | None = Field(default=None, ge=1, le=5)
    cleanliness_and_condition: int | None = Field(default=None, ge=1, le=5)
    staff_behaviour: int | None = Field(default=None, ge=1, le=5)
    communication: int | None = Field(default=None, ge=1, le=5)
    issue_resolution: int | None = Field(default=None, ge=1, le=5)

    #: None means undecided, which is deliberately not the same as False. Collapsing
    #: the two turns "I am not sure" into "no".
    would_use_again: bool | None = None
    note: str | None = Field(default=None, max_length=4000)


class SupplierReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supplier_id: int
    departure_id: int
    would_use_again: bool | None = None
    note: str | None = None
    reviewed_by: str | None = None


class VendorHoldIn(BaseModel):
    #: Null lifts the hold. A non-empty string sets it, and the string is the point.
    reason: str | None = Field(default=None, max_length=2000)


class VendorAssessmentOut(BaseModel):
    """What is known about a vendor, and what to do about it.

    Note the absence of an overall score. Doc 06: "A future vendor score may assist
    planning, but serious incidents and manual judgement must remain visible rather
    than hidden in an average." The reliable way to honour that is not to emit a
    single number that could carry the whole answer on a screen.
    """

    supplier_id: int
    name: str
    #: use_again | too_early_to_say | review_before_rebooking | do_not_use
    recommendation: str
    #: A sentence, meant to be read rather than sorted on.
    headline: str
    #: Must be read before rebooking. Never empty for the two negative outcomes.
    blocking_concerns: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    #: Per dimension, and `None` where too few departures have been reviewed to say
    #: anything — withheld rather than shown with a caveat, because a number on a
    #: screen is remembered and the caveat beside it is not.
    ratings: dict[str, Decimal | None] = Field(default_factory=dict)
    #: From the private traveller form, kept separate from the coordinator's ratings
    #: above. The travellers have no stake in the booking decision.
    traveller_average: Decimal | None = None
    traveller_count: int = 0
    review_count: int = 0
    incident_count: int = 0
    #: Zero until the booking is settled. An unpaid supplier is not a saving, and a
    #: negative variance on a screen reads exactly like one.
    cost_variance: Decimal = Decimal("0")
    cost_outstanding: Decimal = Decimal("0")
    cost_settled: bool = False
    is_rateable: bool = False


# ------------------------------------------------------------------- assistant


class AssistIn(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    locale: str = "en"


class AssistUsedIn(BaseModel):
    was_used: bool


class AssistPassageOut(BaseModel):
    """One approved passage the answer was allowed to draw on.

    Returned even when a draft was generated, so a reviewer can check the answer
    against its evidence without leaving the screen. Doc 08: "source or record
    reference for operational answers."
    """

    kind: str
    title: str
    text: str
    source_ref: str
    url_path: str | None = None
    score: float = 0.0


class AssistOut(BaseModel):
    #: Empty when refused, or when no model is configured. The passages below are
    #: still returned and are the useful half.
    answer: str = ""
    citations: list[str] = Field(default_factory=list)
    #: medical | commercial | promise | complaint | status_stale | no_grounding
    refusal: str | None = None
    #: What the coordinator should do instead. Never shown to a traveller as-is.
    staff_guidance: str | None = None
    needs_human: bool = False
    model: str | None = None
    contract_version: str | None = None
    #: The verified status sentence, with its timestamp and verifier already welded
    #: on so neither can be dropped in the interest of a smoother reply.
    quoted_status: str | None = None
    passages: list[AssistPassageOut] = Field(default_factory=list)


# ------------------------------------------------------------- route history


class RouteWeekOut(BaseModel):
    """One week of the year, as recorded rather than as predicted."""

    iso_week: int
    #: The Monday, so a week number can be shown as dates. "Week 21" means nothing to
    #: somebody choosing when to travel; "19–25 May" does.
    starts_on: date | None = None
    observations: int = 0
    open_share: float | None = None
    blocked_share: float | None = None
    #: None when there are too few observations to say anything. Deliberately null
    #: rather than the string "unknown", so a caller that forgets it renders an empty
    #: cell instead of a confident-looking word.
    verdict: str | None = None
    description: str = ""


class RoutePatternOut(BaseModel):
    segment_slug: str
    segment_name: str
    total_observations: int = 0
    seasons_observed: int = 0
    first_observed: date | None = None
    last_observed: date | None = None
    #: False when the segment has not been watched long enough to summarise. The
    #: response is still returned — "we will not draw a pattern from this yet" is
    #: itself informative and honest about a gap that closes on its own.
    is_reportable: bool = False
    #: Text, so the warning survives a screenshot.
    caveats: list[str] = Field(default_factory=list)
    weeks: list[RouteWeekOut] = Field(default_factory=list)
