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


class JourneyDetailOut(JourneySummaryOut):
    tiers: list[ServiceTierOut] = Field(default_factory=list)
    stages: list[ItineraryStageOut] = Field(default_factory=list)
    last_reviewed_at: str | None = None
    #: True when this locale has real translations rather than English fallback.
    is_fully_translated: bool = True


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
