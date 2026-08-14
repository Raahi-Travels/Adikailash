"""Departures, route segments and verified status.

These tables carry the guarantees the domain modules enforce in Python. Where a rule
can also be expressed as a constraint it is, because doc 09 treats false availability
and unverified "live" status as release-blocking defects — and application code is a
weaker guarantee than the database when two services share one Postgres.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, LocalizedText, TimestampMixin, pg_enum, requires_english
from api.domain.departures import DepartureState
from api.domain.status import (
    Access,
    Freshness,
    PublicationStage,
    SourceType,
    derive_freshness,
    label_for,
    suppresses_sale,
)


class OperatingPartner(Base, TimestampMixin):
    """The registered entity legally operating a departure.

    Doc 06: "The public website and customer documents must not imply that a
    partner's registration belongs to the brand owner." Until decision O2 lands,
    every departure that opens for booking must point at one of these.
    """

    __tablename__ = "operating_partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    legal_name: Mapped[str] = mapped_column(String(200), nullable=False)
    public_name: Mapped[str | None] = mapped_column(String(200))
    registration_number: Mapped[str | None] = mapped_column(String(120))
    registration_valid_until: Mapped[date | None] = mapped_column(Date)
    #: Who the customer contracts with and who issues the invoice.
    is_contracting_entity: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    support_contact: Mapped[str | None] = mapped_column(String(200))


class RouteSegment(Base, TimestampMixin):
    """An operational leg with its own access and permit dependency."""

    __tablename__ = "route_segments"

    __table_args__ = (requires_english("name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    origin_destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    arrival_destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    requires_permit: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    seasonal_note: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())

    status_updates: Mapped[list[StatusUpdate]] = relationship(back_populates="segment")


class StatusUpdate(Base, TimestampMixin):
    """A time-bound statement about a route segment.

    Freshness is deliberately NOT stored — see ``api.domain.status``. Only
    ``next_verification_due`` is persisted, and staleness is derived at read time so
    a failed cron cannot leave a cold status looking current.
    """

    __tablename__ = "status_updates"
    __table_args__ = (
        CheckConstraint(
            "next_verification_due > verified_at",
            name="verification_window_is_forward",
        ),
        # Doc 08: "A verified status requires source type, author and timestamp."
        # The summary check reads through the English key: a status published with an
        # empty English summary would render as a blank trust badge.
        CheckConstraint(
            "stage <> 'published' or (verified_by is not null "
            "and summary is not null and length(trim(summary ->> 'en')) > 0)",
            name="published_status_needs_verifier_and_summary",
        ),
        Index("ix_status_updates_segment_verified", "route_segment_id", "verified_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    route_segment_id: Mapped[int] = mapped_column(
        ForeignKey("route_segments.id", ondelete="CASCADE"), nullable=False
    )
    access: Mapped[Access] = mapped_column(
        pg_enum(Access, "route_access"),
        nullable=False,
    )
    stage: Mapped[PublicationStage] = mapped_column(
        pg_enum(PublicationStage, "status_publication_stage"),
        nullable=False,
    )
    source: Mapped[SourceType] = mapped_column(
        pg_enum(SourceType, "status_source_type"),
        nullable=False,
    )
    verified_by: Mapped[str | None] = mapped_column(String(120))
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    next_verification_due: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    summary: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())

    segment: Mapped[RouteSegment] = relationship(back_populates="status_updates")

    # Delegates to the domain module so the persisted row and the pure dataclass in
    # api.domain.status answer these questions identically. Reimplementing the rules
    # here is how a stale status quietly starts rendering as current.
    def freshness(self, *, now: datetime | None = None) -> Freshness:
        return derive_freshness(self.next_verification_due, now=now)

    def public_label(self, *, now: datetime | None = None) -> str:
        return label_for(self.access, self.stage, self.freshness(now=now))

    def blocks_sale(self, *, now: datetime | None = None) -> bool:
        return suppresses_sale(self.access, self.stage, self.freshness(now=now))


class Departure(Base, TimestampMixin):
    """A dated operational instance of a journey."""

    __tablename__ = "departures"
    __table_args__ = (
        UniqueConstraint("journey_id", "service_tier_id", "start_date"),
        CheckConstraint("end_date >= start_date", name="dates_ordered"),
        CheckConstraint("capacity >= 0", name="capacity_non_negative"),
        CheckConstraint("reserved_count >= 0", name="reserved_non_negative"),
        CheckConstraint("reserved_count <= capacity", name="reserved_within_capacity"),
        # Doc 06: a departure must not be sellable without a disclosed operator.
        CheckConstraint(
            "state not in ('open_for_booking','minimum_group_pending','confirmed',"
            "'preparation','ready_to_depart','in_progress') "
            "or operating_partner_id is not null",
            name="sellable_departure_needs_operator",
        ),
        Index("ix_departures_state_start", "state", "start_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journey_id: Mapped[int] = mapped_column(
        ForeignKey("journeys.id", ondelete="RESTRICT"), nullable=False
    )
    service_tier_id: Mapped[int] = mapped_column(
        ForeignKey("service_tiers.id", ondelete="RESTRICT"), nullable=False
    )
    #: Doc 08: "A departure belongs to one journey, one tier and one itinerary version."
    itinerary_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("itinerary_versions.id", ondelete="RESTRICT")
    )
    operating_partner_id: Mapped[int | None] = mapped_column(
        ForeignKey("operating_partners.id", ondelete="RESTRICT")
    )

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    gateway: Mapped[str | None] = mapped_column(String(120))

    state: Mapped[DepartureState] = mapped_column(
        pg_enum(DepartureState, "departure_state"),
        nullable=False,
        default=DepartureState.DRAFT,
        server_default=text("'draft'"),
    )
    capacity: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )
    reserved_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    state_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    state_changed_by: Mapped[str | None] = mapped_column(String(120))
    state_change_reason: Mapped[str | None] = mapped_column(Text)


class DepartureStateChange(Base, TimestampMixin):
    """Append-only audit of every lifecycle transition.

    Doc 09: "High-stakes state changes and waivers are attributable." Actor and
    reason are NOT NULL by design — the Python ``transition()`` refuses to build a
    change without them, and this table refuses to store one.
    """

    __tablename__ = "departure_state_changes"
    __table_args__ = (
        CheckConstraint("length(trim(actor)) > 0", name="actor_present"),
        CheckConstraint("length(trim(reason)) > 0", name="reason_present"),
        Index("ix_departure_state_changes_departure", "departure_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    departure_id: Mapped[int] = mapped_column(
        ForeignKey("departures.id", ondelete="CASCADE"), nullable=False
    )
    previous_state: Mapped[DepartureState] = mapped_column(
        pg_enum(DepartureState, "departure_state"),
        nullable=False,
    )
    new_state: Mapped[DepartureState] = mapped_column(
        pg_enum(DepartureState, "departure_state"),
        nullable=False,
    )
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)


class DepartureCheckIn(Base, TimestampMixin):
    """A coordinator saying where the group is and that everyone is well.

    Doc 05 asks for a "daily movement or check-in summary" on the family share, and
    lists a "daily check-in or traveller pulse" under the during-trip companion. Both
    read this one table rather than each growing their own, because two sources for
    "where is the group" is how a family gets told two different things.

    **Posted by a person, never inferred.** There is no derivation from GPS, from a
    schedule, or from the itinerary saying they *should* be in Gunji by now. A
    check-in means somebody with the group typed it, and the family view says who and
    when — an automatic one would be a claim we cannot stand behind at exactly the
    moment it matters most.

    Append-only. A correction is a new check-in, so the family sees that a correction
    happened rather than history quietly changing under them.
    """

    __tablename__ = "departure_check_ins"
    __table_args__ = (
        CheckConstraint("length(trim(note)) > 0", name="check_in_note_present"),
        CheckConstraint("length(trim(posted_by)) > 0", name="check_in_author_present"),
        Index("ix_departure_check_ins_departure", "departure_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    departure_id: Mapped[int] = mapped_column(
        ForeignKey("departures.id", ondelete="CASCADE"), nullable=False
    )

    #: Where the group actually is, at settlement granularity. Not an address.
    location: Mapped[str | None] = mapped_column(String(160))
    #: Plain sentences a worried relative can read: "Reached Gunji at 4pm, everyone
    #: well, resting tomorrow for altitude."
    note: Mapped[str] = mapped_column(Text, nullable=False)
    posted_by: Mapped[str] = mapped_column(String(120), nullable=False)

    #: When the thing happened, which is not when it was typed — a coordinator may
    #: only get signal hours later, and the family should see the earlier time.
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    #: False keeps it internal: an operational note that is true but not something to
    #: put in front of a family without context.
    is_shareable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )


class PartnerAccessToken(Base, TimestampMixin):
    """A read-only key scoped to exactly one operating partner (doc 09, Phase 5).

    **The scope is the whole feature.** A partner sees their own departures and the
    public route status, and there is no path from this token to another partner's
    anything. Every query is filtered by `partner_id` taken from the token rather
    than from the URL, which is what makes changing an id in the address bar useless
    — the same shape as the traveller tokens, for the same reason.

    Read-only by construction. A partner cannot publish a status, change a departure
    or see a traveller: doc 06 keeps departure lifecycle and status publishing behind
    named staff roles, and doc 08 restricts access to traveller data. What they get is
    the operational picture for the groups they are legally responsible for.

    Hashed, unlike the traveller and family tokens. Those are capability URLs a
    customer keeps; this is closer to an API credential — it goes to another company,
    lives in their systems, and may outlive whoever pasted it there.
    """

    __tablename__ = "partner_access_tokens"
    __table_args__ = (
        CheckConstraint("length(trim(label)) > 0", name="partner_token_label_present"),
        CheckConstraint(
            "revoked_at is null or revoked_reason is not null",
            name="partner_revocation_needs_a_reason",
        ),
        Index("ix_partner_tokens_partner", "operating_partner_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    operating_partner_id: Mapped[int] = mapped_column(
        ForeignKey("operating_partners.id", ondelete="CASCADE"), nullable=False
    )

    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    #: Who at the partner this was issued to, so revoking the right one is possible.
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    issued_by: Mapped[str | None] = mapped_column(String(120))

    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    use_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    def is_valid(self, *, now: datetime) -> bool:
        if self.revoked_at is not None:
            return False
        return self.expires_at is None or self.expires_at > now
