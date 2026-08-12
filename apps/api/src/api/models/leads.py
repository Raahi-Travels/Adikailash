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
    UniqueConstraint,
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


class EnquiryKind(enum.StrEnum):
    """Which door somebody came through.

    A discriminator on `Lead` rather than three separate tables, because doc 04 wants
    *one* pipeline with one set of stages, owners and next actions. Splitting B2B and
    private enquiries into their own tables would give a three-person team three
    inboxes and guarantee that the quietest one goes unread for a week.

    The kind-specific answers live in `EnquiryDetail`, a side table created only for
    the specialised forms, so the common WhatsApp enquiry does not carry fifteen
    null columns it will never use.
    """

    #: The default: a journey page, a departure, a WhatsApp message.
    STANDARD = "standard"
    #: Doc 03: international and complex private groups "should not be forced through
    #: a standard package checkout".
    PRIVATE_OR_INTERNATIONAL = "private_or_international"
    #: Doc 01 lists ground handling for external agencies as a P1 revenue line.
    B2B_GROUND_HANDLING = "b2b_ground_handling"


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

    #: Which form this arrived through. Drives the work queue and nothing else —
    #: stage, owner and priority stay identical across kinds so nobody has to learn
    #: three pipelines.
    enquiry_kind: Mapped[EnquiryKind] = mapped_column(
        pg_enum(EnquiryKind, "enquiry_kind"),
        nullable=False,
        default=EnquiryKind.STANDARD,
        server_default=text("'standard'"),
    )

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


class EnquiryDetail(Base, TimestampMixin):
    """The extra answers a specialised enquiry form collects.

    One optional row per lead, created only for `private_or_international` and
    `b2b_ground_handling`. Real typed columns rather than a JSONB blob: a coordinator
    filters on time zone to schedule calls that do not land at 3am for the traveller,
    and sorts B2B enquiries by season. Answers you query belong in columns.

    Doc 03 lists the private/international fields explicitly, and the shape here
    follows that list rather than improving on it — the list came from what the
    founders actually need to know before a consultation call.
    """

    __tablename__ = "enquiry_details"
    __table_args__ = (
        UniqueConstraint("lead_id", name="one_detail_per_lead"),
        CheckConstraint(
            "group_size_max is null or group_size_min is null "
            "or group_size_max >= group_size_min",
            name="group_size_ordered",
        ),
        Index("ix_enquiry_details_timezone", "time_zone"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False
    )

    # --- Private and international (doc 03) ---
    #
    # `Lead` already carries country, preferred dates, group size and language, so
    # they are not repeated here. These are the ones it does not.

    #: "Preferred date range and flexibility" — the flexibility half. Free text
    #: because "the week after Diwali, or next year if the passes are bad" is a real
    #: answer and a date picker cannot hold it.
    date_flexibility: Mapped[str | None] = mapped_column(Text)
    group_size_min: Mapped[int | None] = mapped_column(Integer)
    group_size_max: Mapped[int | None] = mapped_column(Integer)
    #: "Group size and age range." Free text: "62 to 74, one of them post-surgery"
    #: tells a coordinator far more than two integers.
    age_range: Mapped[str | None] = mapped_column(String(120))
    #: Trekking experience and comfort expectation, in their words.
    experience_preference: Mapped[str | None] = mapped_column(Text)
    #: "Gateway and airport needs" — Delhi pickup, Kathgodam, a domestic connection.
    gateway_needs: Mapped[str | None] = mapped_column(Text)
    #: "Spiritual, cultural or trekking interests."
    interests: Mapped[str | None] = mapped_column(Text)

    #: IANA name, e.g. "America/Los_Angeles". Indexed because scheduling calls
    #: across time zones is the actual daily task this table serves.
    time_zone: Mapped[str | None] = mapped_column(String(64))
    #: When they can talk, in their own local terms: "weekday evenings after 7".
    consultation_window: Mapped[str | None] = mapped_column(String(160))
    consultation_channel: Mapped[str | None] = mapped_column(String(40))

    #: Doc 03: "Any accessibility or support needs the traveller **chooses** to
    #: disclose." Optional by design and never required to submit the form. Doc 08
    #: treats this as sensitive: it must not appear in list views, exports or
    #: anything a partner can see.
    accessibility_needs: Mapped[str | None] = mapped_column(Text)

    # --- B2B ground handling (doc 01's P1 revenue line) ---
    company_name: Mapped[str | None] = mapped_column(String(200))
    company_role: Mapped[str | None] = mapped_column(String(120))
    company_website: Mapped[str | None] = mapped_column(String(300))
    #: GST or tour-operator registration. Not verified at submission — it is a
    #: starting point for a conversation, and demanding papers on a contact form
    #: loses the enquiry.
    company_registration: Mapped[str | None] = mapped_column(String(80))
    #: Transfers, permits, accommodation, full ground handling — comma separated
    #: from a checkbox group.
    services_needed: Mapped[str | None] = mapped_column(Text)
    #: "About 120 pax across May and June" — an estimate, and treated as one.
    volume_estimate: Mapped[str | None] = mapped_column(String(200))
    season_of_interest: Mapped[str | None] = mapped_column(String(120))

    lead: Mapped[Lead] = relationship()
