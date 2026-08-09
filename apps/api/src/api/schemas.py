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
