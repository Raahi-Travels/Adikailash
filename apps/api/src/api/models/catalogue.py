"""Journey catalogue: what is sold, where it goes, and where people sleep.

Doc 03 requires the itinerary to be "structured content rather than a single image
or PDF", and doc 08 requires a departure to reference a specific *itinerary version*
so a booking keeps the plan the customer actually accepted.

Translatable text uses :func:`LocalizedText` (decision D9) — ``{"en": ..., "hi": ...}``
with English required. Doc 02: Devanagari is a first-class layout, not a smaller
translation beneath English, so nothing here treats Hindi as an optional annotation.
"""

from __future__ import annotations

import enum
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, LocalizedText, TimestampMixin, pg_enum, requires_english


class StayKind(enum.StrEnum):
    """Decision D5 makes the homestay a hero product, not a disclosure.

    A homestay therefore carries narrative fields a hotel row has no use for
    (the host, the household, what a night there is actually like), which is why
    this is a discriminator rather than a star rating.
    """

    HOMESTAY = "homestay"
    GUESTHOUSE = "guesthouse"
    HOTEL = "hotel"
    LODGE = "lodge"
    CAMP = "camp"
    ASHRAM_OR_DHARAMSHALA = "ashram_or_dharamshala"


class JourneyFamily(enum.StrEnum):
    """Doc 01's journey families. D10 launches the first three."""

    SACRED_FLAGSHIP = "sacred_flagship"
    KUMAON_CIRCUIT = "kumaon_circuit"
    HOMESTAY_IMMERSION = "homestay_immersion"
    PATHS_OF_MAHADEV = "paths_of_mahadev"
    PRIVATE_SACRED = "private_sacred"
    CULTURAL_EXPERIENCE = "cultural_experience"
    GROUND_SERVICES = "ground_services"


class MediaProvenance(enum.StrEnum):
    """Doc 02's image provenance rule, enforced in the database.

    "Only original or verified supplier imagery may represent actual stays, vehicles
    or route conditions." Without this column that rule is an honour system.
    """

    ORIGINAL = "original"
    SUPPLIER_PROVIDED = "supplier_provided"
    LICENSED_EDITORIAL = "licensed_editorial"
    ILLUSTRATIVE = "illustrative"
    AI_GENERATED = "ai_generated"


class Destination(Base, TimestampMixin):
    """A sacred place or gateway town — Adi Kailash, Om Parvat, Jageshwar, Dharchula."""

    __tablename__ = "destinations"
    __table_args__ = (requires_english("name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    summary: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())
    #: Approved factual value. Doc 03 lists altitude under "at-a-glance"; it must be
    #: a reviewed number, not scraped trivia. Null until operations approves it.
    altitude_m: Mapped[int | None] = mapped_column(Integer)
    #: Where the figure came from. Required alongside the number, because in two
    #: years nobody will remember where 4,150m for Nabhidhang came from, and a
    #: number with no provenance is one nobody can correct with confidence. This one
    #: gets used by somebody deciding whether they can physically do this.
    altitude_source: Mapped[str | None] = mapped_column(String(300))
    altitude_recorded_by: Mapped[str | None] = mapped_column(String(120))
    #: False until a person has checked the figure against the source they named.
    #: **The public altitude profile plots verified points only**, so a seeded or
    #: half-remembered number never reaches a page where somebody is judging whether
    #: they can physically do this. Same shape as `Stay.last_verified_by` and the
    #: route-status provenance: recorded is not the same as verified.
    altitude_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    #: WGS84 decimal degrees. Needed to ask a weather model about this place and to
    #: test whether a disaster alert's polygon contains it.
    #:
    #: Six decimal places is far more precision than the source of these has, and
    #: that is deliberate: the column stores what was given without rounding away
    #: somebody else's significant figures, and `coordinate_source` carries how good
    #: it actually is. On this route a kilometre of horizontal error matters much
    #: less than it looks, because the elevation passed alongside is what drives the
    #: temperature correction, but it matters a great deal for landing in the right
    #: valley at all: the Kuti and Lipulekh arms are 8 km apart and 300 m different.
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    coordinate_source: Mapped[str | None] = mapped_column(String(300))

    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )


class Journey(Base, TimestampMixin):
    """A sellable experience concept — the master product, not a dated instance."""

    __tablename__ = "journeys"
    __table_args__ = (
        requires_english("name"),
        # Doc 09: nothing publishes without approved facts behind it.
        CheckConstraint(
            "not is_published or (essence is not null and duration_nights is not null)",
            name="published_journey_needs_facts",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    essence: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())
    family: Mapped[JourneyFamily] = mapped_column(
        pg_enum(JourneyFamily, "journey_family"), nullable=False
    )
    gateway: Mapped[str | None] = mapped_column(String(120))
    duration_nights: Mapped[int | None] = mapped_column(Integer)
    highest_altitude_m: Mapped[int | None] = mapped_column(Integer)
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    #: Doc 03: journey pages carry a "last content review date".
    last_reviewed_at: Mapped[str | None] = mapped_column(String(32))
    last_reviewed_by: Mapped[str | None] = mapped_column(String(120))

    tiers: Mapped[list[ServiceTier]] = relationship(back_populates="journey")
    itinerary_versions: Mapped[list[ItineraryVersion]] = relationship(
        back_populates="journey"
    )


class ServiceTier(Base, TimestampMixin):
    """Standard / Comfort / Private / Ground-only, per journey.

    Doc 01: "The system must allow a tier to differ in group size, itinerary,
    inclusions, room policy, transport, coordinator level, pickup scope and
    cancellation terms. It should not reduce all tiers to a single hotel-star field."
    """

    __tablename__ = "service_tiers"
    __table_args__ = (
        UniqueConstraint("journey_id", "slug"),
        CheckConstraint("max_group_size >= 1", name="group_size_positive"),
        requires_english("name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journey_id: Mapped[int] = mapped_column(
        ForeignKey("journeys.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    #: Concrete differences, not adjectives. Doc 01 principle 6.
    differentiators: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())
    max_group_size: Mapped[int | None] = mapped_column(Integer)
    typical_group_size: Mapped[int | None] = mapped_column(Integer)
    is_private: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    #: Indicative only. The price a customer is held to lives on the proposal.
    indicative_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    journey: Mapped[Journey] = relationship(back_populates="tiers")


class ItineraryVersion(Base, TimestampMixin):
    """An immutable-once-published plan.

    Doc 05: "The traveller should see the exact itinerary version attached to the
    booking, not merely the latest marketing page."
    """

    __tablename__ = "itinerary_versions"
    __table_args__ = (UniqueConstraint("journey_id", "version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journey_id: Mapped[int] = mapped_column(
        ForeignKey("journeys.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )

    journey: Mapped[Journey] = relationship(back_populates="itinerary_versions")
    stages: Mapped[list[ItineraryStage]] = relationship(back_populates="version_ref")


class ItineraryStage(Base, TimestampMixin):
    """One day or movement within an itinerary version."""

    __tablename__ = "itinerary_stages"
    __table_args__ = (
        UniqueConstraint("itinerary_version_id", "day_number"),
        requires_english("title"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    itinerary_version_id: Mapped[int] = mapped_column(
        ForeignKey("itinerary_versions.id", ondelete="CASCADE"), nullable=False
    )
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    origin_destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    arrival_destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    stay_id: Mapped[int | None] = mapped_column(ForeignKey("stays.id", ondelete="SET NULL"))
    travel_note: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())
    altitude_note: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())
    #: Doc 03: route-dependent days need an explicit caveat, not silent optimism.
    is_route_dependent: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )

    version_ref: Mapped[ItineraryVersion] = relationship(back_populates="stages")


class Stay(Base, TimestampMixin):
    """Where travellers sleep.

    The homestay fields exist because of decision D5. For a hotel they stay null; for
    a homestay they are the product copy. Doc 02 forbids representing a real stay with
    illustrative imagery, which is why media provenance is tracked per asset.
    """

    __tablename__ = "stays"
    __table_args__ = (requires_english("name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    kind: Mapped[StayKind] = mapped_column(pg_enum(StayKind, "stay_kind"), nullable=False)
    destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )

    # --- Homestay narrative (D5). Null for commercial properties. ---
    host_name: Mapped[str | None] = mapped_column(String(200))
    household_story: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())
    village: Mapped[str | None] = mapped_column(String(160))
    shares_family_meals: Mapped[bool | None] = mapped_column(Boolean)

    # --- Honest comfort expectations (doc 03, "Accommodation reality"). ---
    rooms_available: Mapped[int | None] = mapped_column(Integer)
    typical_occupancy: Mapped[int | None] = mapped_column(Integer)
    has_running_hot_water: Mapped[bool | None] = mapped_column(Boolean)
    has_heating: Mapped[bool | None] = mapped_column(Boolean)
    has_mobile_network: Mapped[bool | None] = mapped_column(Boolean)
    is_shared_bathroom: Mapped[bool | None] = mapped_column(Boolean)
    limitations_note: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())

    #: Whoever last physically saw the place. Doc 06 wants an inspection date on
    #: vendor records; an unvisited stay should not carry verified imagery.
    last_verified_by: Mapped[str | None] = mapped_column(String(120))


class MediaAsset(Base, TimestampMixin):
    """An image or video with recorded provenance.

    Doc 02: "Every operational image should be labelled internally as original,
    supplier-provided, licensed editorial, illustrative or AI-generated."
    """

    __tablename__ = "media_assets"
    __table_args__ = (
        CheckConstraint(
            "not (represents_actual_conditions and provenance in "
            "('illustrative', 'ai_generated'))",
            name="illustrative_media_cannot_claim_reality",
        ),
        requires_english("alt_text"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    alt_text: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    provenance: Mapped[MediaProvenance] = mapped_column(
        pg_enum(MediaProvenance, "media_provenance"), nullable=False
    )
    #: True only when this depicts the real stay/vehicle/route it is attached to.
    #: The check constraint above makes the doc-02 rule structurally unbreakable.
    represents_actual_conditions: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    credit: Mapped[str | None] = mapped_column(String(200))
    captured_on: Mapped[str | None] = mapped_column(String(32))
    stay_id: Mapped[int | None] = mapped_column(ForeignKey("stays.id", ondelete="CASCADE"))
    destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE")
    )
    journey_id: Mapped[int | None] = mapped_column(
        ForeignKey("journeys.id", ondelete="CASCADE")
    )
