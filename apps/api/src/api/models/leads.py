"""Leads, attribution and consent.

Doc 04 is strict about two things this schema has to encode rather than merely
document: consent is recorded with its source and timestamp, and promotional consent
is separate from essential trip communication. "Do not add a person to a broadcast
list merely because they asked one question."
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, TimestampMixin, pg_enum


class LeadStage(enum.StrEnum):
    """Doc 04's lifecycle.

    Note the absence of a "hot" stage — the doc explicitly rejects it: "Avoid a stage
    called simply 'Hot' without a defined customer state. Sales priority can be a
    separate score or flag." Hence ``priority`` as its own column.
    """

    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    CONSULTATION_SCHEDULED = "consultation_scheduled"
    PROPOSAL_SHARED = "proposal_shared"
    RESERVATION_INVITED = "reservation_invited"
    RESERVED = "reserved"
    CONFIRMED = "confirmed"
    NURTURE = "nurture"
    LOST = "lost"


class ConsentPurpose(enum.StrEnum):
    """Essential trip communication is not the same permission as marketing."""

    ESSENTIAL_TRIP = "essential_trip"
    ROUTE_STATUS_ALERTS = "route_status_alerts"
    PROMOTIONAL = "promotional"


class ConsentChannel(enum.StrEnum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    SMS = "sms"
    PHONE = "phone"


class Lead(Base, TimestampMixin):
    """Someone who has expressed interest but has not reserved."""

    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint(
            "phone is not null or email is not null",
            name="lead_needs_a_contact_method",
        ),
        CheckConstraint(
            "stage <> 'lost' or loss_reason is not null",
            name="lost_lead_needs_a_reason",
        ),
        Index("ix_leads_stage_owner", "stage", "owner"),
        Index("ix_leads_next_action_due", "next_action_due_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(320))
    preferred_language: Mapped[str] = mapped_column(
        String(8), default="en", server_default=text("'en'"), nullable=False
    )
    country: Mapped[str | None] = mapped_column(String(80))
    origin_city: Mapped[str | None] = mapped_column(String(120))

    #: Link to the Raahi passenger account when the same person already exists there.
    #: Nullable and SET NULL on delete so an account-deletion request in the cab app
    #: does not orphan or block anything here. This is the only cross-schema
    #: reference we hold, and it is the seam the mobile app will read through.
    raahi_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("public.users.id", ondelete="SET NULL"), index=True
    )

    # --- Intent (doc 04's qualification fields) ---
    journey_id: Mapped[int | None] = mapped_column(
        ForeignKey("journeys.id", ondelete="SET NULL")
    )
    departure_id: Mapped[int | None] = mapped_column(
        ForeignKey("departures.id", ondelete="SET NULL")
    )
    preferred_date_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    preferred_date_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    group_size: Mapped[int | None] = mapped_column(Integer)
    is_senior_inclusive: Mapped[bool | None] = mapped_column(Boolean)
    tier_preference: Mapped[str | None] = mapped_column(String(60))
    #: Free text: altitude, parents, dates, rooms, permits. Drives the human call.
    primary_concern: Mapped[str | None] = mapped_column(Text)

    # --- Attribution (doc 07 requires lead -> campaign traceability) ---
    first_touch_source: Mapped[str | None] = mapped_column(String(120))
    latest_touch_source: Mapped[str | None] = mapped_column(String(120))
    campaign: Mapped[str | None] = mapped_column(String(160))
    landing_page: Mapped[str | None] = mapped_column(Text)
    referrer: Mapped[str | None] = mapped_column(Text)

    # --- Sales management ---
    stage: Mapped[LeadStage] = mapped_column(
        pg_enum(LeadStage, "lead_stage"),
        default=LeadStage.NEW,
        server_default=text("'new'"),
        nullable=False,
    )
    #: Separate from stage, per doc 04. 0 = unset.
    priority: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )
    owner: Mapped[str | None] = mapped_column(String(120))
    next_action: Mapped[str | None] = mapped_column(Text)
    next_action_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    loss_reason: Mapped[str | None] = mapped_column(String(120))
    nurture_topic: Mapped[str | None] = mapped_column(String(120))

    consents: Mapped[list[LeadConsent]] = relationship(
        back_populates="lead", cascade="all, delete-orphan"
    )


class LeadConsent(Base, TimestampMixin):
    """One permission, for one purpose, on one channel, with its evidence.

    Kept as rows rather than boolean columns so that withdrawing promotional consent
    provably does not touch essential trip communication, and so each grant carries
    the source and timestamp doc 04 requires.
    """

    __tablename__ = "lead_consents"
    __table_args__ = (
        CheckConstraint(
            "withdrawn_at is null or withdrawn_at >= granted_at",
            name="withdrawal_follows_grant",
        ),
        Index("ix_lead_consents_lead_purpose", "lead_id", "purpose"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False
    )
    purpose: Mapped[ConsentPurpose] = mapped_column(
        pg_enum(ConsentPurpose, "consent_purpose"),
        nullable=False,
    )
    channel: Mapped[ConsentChannel] = mapped_column(
        pg_enum(ConsentChannel, "consent_channel"),
        nullable=False,
    )
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: Where the permission came from — the form, page or message that captured it.
    evidence: Mapped[str | None] = mapped_column(Text)

    lead: Mapped[Lead] = relationship(back_populates="consents")

    @property
    def is_active(self) -> bool:
        return self.withdrawn_at is None
