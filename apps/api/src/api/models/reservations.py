"""Reservations, the party, policy acceptance and the money ledger.

Phase 2 of doc 09, minus the payment gateway. Decision O3 settled offline-only for
the first season, so `PaymentRecord` records what a coordinator saw arrive in a bank
account rather than what a gateway called back about. When a gateway does land, it
writes rows into the same ledger; nothing above it changes.

Four tables, each for a reason the pack states explicitly:

- `reservations` — doc 05 wants "every reserved group has a visible state, payment
  trail, accepted terms, preparation owner and next action". This row is that.
- `reservation_travellers` — permits are issued against names and dates of birth. A
  group size is not enough, and a mismatch stops the whole party at a checkpost.
- `policy_acceptances` — doc 09 requires policy *versioning*. Recording that someone
  accepted "the terms" is worthless a year later when the terms have changed; this
  records which text they saw.
- `payment_records` — an append-only ledger. Money is never a column on the
  reservation, because a mutable balance is a balance that can be quietly corrected.

The lifecycle rules live in `api.domain.reservations` and are enforced there.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal

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
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, TimestampMixin, pg_enum
from api.domain.reservations import ReservationState


class TravellerRole(enum.StrEnum):
    """Doc 05 distinguishes the person we talk to from the people who travel."""

    #: The person we deal with. Receives every message, accepts terms for the party.
    GROUP_LEAD = "group_lead"
    COMPANION = "companion"


class PaymentMethod(enum.StrEnum):
    """How money actually moved.

    ``GATEWAY`` exists but is unused: decision O8 has not been made, and no code path
    writes it. It is here so adding a provider later is a migration of behaviour
    rather than of schema.
    """

    BANK_TRANSFER = "bank_transfer"
    UPI = "upi"
    CASH = "cash"
    CHEQUE = "cheque"
    GATEWAY = "gateway"


class PaymentDirection(enum.StrEnum):
    RECEIVED = "received"
    REFUNDED = "refunded"


class Reservation(Base, TimestampMixin):
    """A party holding, or hoping to hold, places on one departure."""

    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint("party_size >= 1", name="party_size_at_least_one"),
        CheckConstraint("agreed_amount >= 0", name="agreed_amount_non_negative"),
        # A confirmed reservation must have a human owning it. Doc 05 wants a named
        # coordinator; this stops one being confirmed into nobody's inbox.
        CheckConstraint(
            "state not in ('confirmed','preparing','ready','travelled') "
            "or coordinator_staff_id is not null",
            name="confirmed_reservation_needs_coordinator",
        ),
        # Cancellation carries a reason for the same purpose loss reasons serve on
        # leads: it is how the product learns why people leave.
        CheckConstraint(
            "state not in ('cancelled_by_traveller','cancelled_by_us') "
            "or length(trim(coalesce(cancellation_reason, ''))) > 0",
            name="cancellation_needs_reason",
        ),
        Index("ix_reservations_departure_state", "departure_id", "state"),
        Index("ix_reservations_coordinator", "coordinator_staff_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    #: Human-facing identifier, e.g. AK-2027-0042. Nobody reads an integer id aloud
    #: over a bad phone line from Dharchula.
    reference: Mapped[str] = mapped_column(String(24), nullable=False, unique=True)

    #: Where this came from. Nullable because a walk-in or a phone call is a real
    #: origin too, and forcing a synthetic lead would corrupt the funnel numbers.
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL")
    )
    departure_id: Mapped[int] = mapped_column(
        ForeignKey("departures.id", ondelete="RESTRICT"), nullable=False
    )

    state: Mapped[ReservationState] = mapped_column(
        pg_enum(ReservationState, "reservation_state"),
        nullable=False,
        default=ReservationState.DRAFT,
        server_default=text("'draft'"),
    )

    #: How many people this party intends to bring. Named travellers are counted
    #: against it, and the gap is what readiness reports.
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)

    #: What was agreed with this party, which is not necessarily the departure's
    #: list price: doc 01 expects family and multi-generation pricing to be discussed.
    agreed_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default=text("0")
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default=text("'INR'")
    )

    #: Doc 05: "Named coordinator." A person, not a shared inbox.
    coordinator_staff_id: Mapped[str | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )

    #: Doc 04's discipline, carried into Phase 2: every open record has a next action
    #: and a date, or it is quietly rotting.
    next_action: Mapped[str | None] = mapped_column(Text)
    next_action_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #: A refundable hold has to expire, or capacity is held hostage indefinitely.
    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    state_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    state_changed_by: Mapped[str | None] = mapped_column(String(120))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)

    internal_note: Mapped[str | None] = mapped_column(Text)

    travellers: Mapped[list[ReservationTraveller]] = relationship(
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="ReservationTraveller.id",
    )
    payments: Mapped[list[PaymentRecord]] = relationship(
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="PaymentRecord.received_at",
    )
    acceptances: Mapped[list[PolicyAcceptance]] = relationship(
        back_populates="reservation", cascade="all, delete-orphan"
    )
    updates: Mapped[list[ReservationUpdate]] = relationship(
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="ReservationUpdate.created_at.desc()",
    )


class ReservationTraveller(Base, TimestampMixin):
    """One named person on a reservation.

    Identity document *numbers* are deliberately absent. Doc 08 classifies them as
    Sensitive and the pack requires them to live behind the document-submission path
    with its access log, not as a plain column a broad admin query could return. What
    is here is what a permit form needs to be filled in and what a coordinator needs
    to plan safely.
    """

    __tablename__ = "reservation_travellers"
    __table_args__ = (
        CheckConstraint("length(trim(full_name)) > 0", name="traveller_name_present"),
        # Exactly one group lead per reservation, enforced by the database rather
        # than by remembering to check.
        Index(
            "uq_reservation_one_group_lead",
            "reservation_id",
            unique=True,
            postgresql_where=text("role = 'group_lead'"),
        ),
        Index("ix_reservation_travellers_reservation", "reservation_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False
    )

    #: As it appears on the identity document. A permit is refused over a middle name.
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[TravellerRole] = mapped_column(
        pg_enum(TravellerRole, "traveller_role"),
        nullable=False,
        default=TravellerRole.COMPANION,
        server_default=text("'companion'"),
    )

    date_of_birth: Mapped[date | None] = mapped_column(Date)
    #: Free text rather than an enum. Doc 02 warns against forcing Indian families
    #: into a Western relationship taxonomy; "mother-in-law" is a real answer.
    relationship_to_lead: Mapped[str | None] = mapped_column(String(80))

    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(320))

    #: Doc 01 puts families travelling with elders at the centre of this business, and
    #: altitude planning changes when someone is 71.
    is_senior: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    #: A flag, never the condition itself. Health information is Sensitive under doc
    #: 08 and consented separately; this only tells a coordinator to go and read it
    #: in the place where access is logged.
    has_disclosed_health_information: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    dietary_note: Mapped[str | None] = mapped_column(Text)

    reservation: Mapped[Reservation] = relationship(back_populates="travellers")


class PolicyAcceptance(Base, TimestampMixin):
    """Which version of which policy this party accepted, and when.

    Doc 09 requires versioned acceptance. "They agreed to the terms" is not a defence
    once the terms have been edited; "they accepted cancellation policy v3 on 12
    September 2026 at 14:22 IST" is. The version string is whatever identifies the
    text they actually saw, so it must change whenever the text does.
    """

    __tablename__ = "policy_acceptances"
    __table_args__ = (
        UniqueConstraint(
            "reservation_id", "policy", "version", name="one_acceptance_per_version"
        ),
        CheckConstraint("length(trim(accepted_by)) > 0", name="acceptor_present"),
        Index("ix_policy_acceptances_reservation", "reservation_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False
    )

    #: Matches the policy slugs on the website: terms, cancellation, privacy, consent.
    policy: Mapped[str] = mapped_column(String(40), nullable=False)
    version: Mapped[str] = mapped_column(String(40), nullable=False)

    #: The person who accepted, by name. Usually the group lead.
    accepted_by: Mapped[str] = mapped_column(String(200), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #: How the acceptance was obtained. Over the phone is legitimate and common here,
    #: and recording that honestly is better than implying a click that never happened.
    channel: Mapped[str | None] = mapped_column(String(40))
    #: Only meaningful for a web acceptance; null for one taken on a call.
    ip_address: Mapped[str | None] = mapped_column(String(64))

    #: Who on our side recorded it, when it was not a self-service click.
    recorded_by: Mapped[str | None] = mapped_column(String(120))

    reservation: Mapped[Reservation] = relationship(back_populates="acceptances")


class PaymentRecord(Base, TimestampMixin):
    """One movement of money, in or out. Append-only.

    There is no balance column anywhere. The balance is the sum of this table, so it
    cannot drift from the evidence and cannot be quietly corrected. A mistake is
    fixed by recording a refund, which is also what actually happened.

    Under decision O3 every row here is entered by a coordinator who saw the money
    arrive. `reference` is the bank or UPI reference so finance can reconcile it
    against a statement.
    """

    __tablename__ = "payment_records"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint("length(trim(recorded_by)) > 0", name="recorder_present"),
        Index("ix_payment_records_reservation", "reservation_id", "received_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False
    )

    direction: Mapped[PaymentDirection] = mapped_column(
        pg_enum(PaymentDirection, "payment_direction"),
        nullable=False,
        default=PaymentDirection.RECEIVED,
        server_default=text("'received'"),
    )
    #: Always positive. Direction carries the sign, so a negative amount is a bug
    #: rather than a refund.
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default=text("'INR'")
    )

    method: Mapped[PaymentMethod] = mapped_column(
        pg_enum(PaymentMethod, "payment_method"), nullable=False
    )
    #: Bank UTR, UPI reference, cheque number. What finance reconciles against.
    reference: Mapped[str | None] = mapped_column(String(120))

    #: When the money actually moved, not when someone got round to typing it in.
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    #: Who typed it in. Doc 09: high-stakes records are attributable.
    recorded_by: Mapped[str] = mapped_column(String(120), nullable=False)

    note: Mapped[str | None] = mapped_column(Text)

    reservation: Mapped[Reservation] = relationship(back_populates="payments")


class UpdateCategory(enum.StrEnum):
    """Why we are writing. Category decides tone and urgency, not access."""

    ROUTE_CHANGE = "route_change"
    PREPARATION = "preparation"
    PAYMENT = "payment"
    DEPARTURE_LOGISTICS = "departure_logistics"
    INCIDENT = "incident"
    GENERAL = "general"


class ReservationUpdate(Base, TimestampMixin):
    """Something we told this party, kept as a record.

    Doc 09's Phase 3 exit condition is that operations "preserve a record of what
    customers were told". That is the whole purpose of this table, and it shapes two
    decisions.

    **It is append-only in practice.** There is no edit endpoint. A message that was
    sent cannot be quietly reworded afterwards, because the value of the record is
    that it says what the customer actually saw. A correction is a new update.

    **Author and time are required.** When a route closes and a family asks what they
    were told and when, the answer has to be a row, not a memory of a phone call.

    Sending is out of scope here: decision O9 has not settled a WhatsApp provider, so
    this records and displays. When a provider exists it reads this table rather than
    replacing it.
    """

    __tablename__ = "reservation_updates"
    __table_args__ = (
        CheckConstraint("length(trim(title)) > 0", name="update_title_present"),
        CheckConstraint("length(trim(body)) > 0", name="update_body_present"),
        CheckConstraint("length(trim(published_by)) > 0", name="update_author_present"),
        Index("ix_reservation_updates_reservation", "reservation_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False
    )

    category: Mapped[UpdateCategory] = mapped_column(
        pg_enum(UpdateCategory, "update_category"),
        nullable=False,
        default=UpdateCategory.GENERAL,
        server_default=text("'general'"),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    #: Doc 09 wants attribution on anything a customer relies on.
    published_by: Mapped[str] = mapped_column(String(120), nullable=False)

    #: Set when the traveller opened the page carrying this update. Evidence that it
    #: was seen, not merely sent, which is the question that matters after a dispute.
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    reservation: Mapped[Reservation] = relationship(back_populates="updates")
