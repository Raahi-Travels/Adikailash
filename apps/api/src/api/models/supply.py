"""Suppliers, payables, rooming and incidents (Phase 3).

Decision D14 settled hire-per-departure over a fleet, so the unit is a *booking of a
supplier for a departure*. Decision D15 settled a payables ledger mirroring the
customer one: append-only, no balance column on either side of the business, so
neither can drift from its evidence and per-departure margin is real rather than a
spreadsheet guess. Decision D16 settled rooming at traveller-per-night.

The rules live in `api.domain.supply` and `api.domain.incidents`.
"""

from __future__ import annotations

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
from api.domain.incidents import IncidentCategory, IncidentSeverity
from api.domain.supply import BookingState, SupplierKind
from api.models.reservations import PaymentDirection, PaymentMethod


class Supplier(Base, TimestampMixin):
    """Someone we pay to deliver part of a journey.

    Distinct from `Stay`, which is the *place* a traveller sleeps and is catalogue
    content shown to customers. The household that owns it is a supplier and is not
    public. Keeping them apart means a stay can change hands without rewriting the
    catalogue, and a supplier's bank details never sit on a table that feeds a
    public endpoint.
    """

    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="supplier_name_present"),
        Index("ix_suppliers_kind", "kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[SupplierKind] = mapped_column(
        pg_enum(SupplierKind, "supplier_kind"), nullable=False
    )

    contact_name: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(32))
    village: Mapped[str | None] = mapped_column(String(160))

    #: The household or operator behind a stay, when this supplier provides one.
    stay_id: Mapped[int | None] = mapped_column(
        ForeignKey("stays.id", ondelete="SET NULL")
    )

    #: Doc 06 wants supplier reliability tracked. A free-text note rather than a score
    #: for now: with two departures run, a numeric rating would be false precision.
    reliability_note: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )

    bookings: Mapped[list[SupplierBooking]] = relationship(
        back_populates="supplier", cascade="all, delete-orphan"
    )


class SupplierBooking(Base, TimestampMixin):
    """One supplier engaged for one departure."""

    __tablename__ = "supplier_bookings"
    __table_args__ = (
        CheckConstraint("agreed_cost >= 0", name="agreed_cost_non_negative"),
        CheckConstraint(
            "state <> 'cancelled' or length(trim(coalesce(cancellation_reason,''))) > 0",
            name="supplier_cancellation_needs_reason",
        ),
        Index("ix_supplier_bookings_departure", "departure_id", "state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    departure_id: Mapped[int] = mapped_column(
        ForeignKey("departures.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False
    )

    #: What they are actually providing: "Bolero, Kathgodam to Dharchula, 20-22 May".
    #: Free text because the variety here is genuine and an enum would be a lie.
    service: Mapped[str] = mapped_column(Text, nullable=False)

    state: Mapped[BookingState] = mapped_column(
        pg_enum(BookingState, "supplier_booking_state"),
        nullable=False,
        default=BookingState.ENQUIRED,
        server_default=text("'enquired'"),
    )

    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)

    agreed_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default=text("0")
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default=text("'INR'")
    )

    confirmed_by: Mapped[str | None] = mapped_column(String(120))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)

    supplier: Mapped[Supplier] = relationship(back_populates="bookings")
    payments: Mapped[list[SupplierPayment]] = relationship(
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="SupplierPayment.paid_at",
    )


class SupplierPayment(Base, TimestampMixin):
    """Money paid to a supplier. Append-only, mirroring the customer ledger.

    Same discipline for the same reason: the balance is the sum of this table, so it
    cannot be quietly corrected, and a mistake is fixed by recording a refund, which
    is also what actually happened.
    """

    __tablename__ = "supplier_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="supplier_amount_positive"),
        CheckConstraint("length(trim(recorded_by)) > 0", name="supplier_recorder_present"),
        Index("ix_supplier_payments_booking", "supplier_booking_id", "paid_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supplier_booking_id: Mapped[int] = mapped_column(
        ForeignKey("supplier_bookings.id", ondelete="CASCADE"), nullable=False
    )

    #: Reuses the customer enums. Money moves the same ways in both directions, and a
    #: parallel set would drift.
    direction: Mapped[PaymentDirection] = mapped_column(
        pg_enum(PaymentDirection, "payment_direction"),
        nullable=False,
        default=PaymentDirection.RECEIVED,
        server_default=text("'received'"),
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default=text("'INR'")
    )
    method: Mapped[PaymentMethod] = mapped_column(
        pg_enum(PaymentMethod, "payment_method"), nullable=False
    )
    reference: Mapped[str | None] = mapped_column(String(120))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recorded_by: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    booking: Mapped[SupplierBooking] = relationship(back_populates="payments")


class RoomingAssignment(Base, TimestampMixin):
    """One traveller, one night, one household. Decision D16."""

    __tablename__ = "rooming_assignments"
    __table_args__ = (
        # One bed per person per night. Somebody assigned to two households on the
        # same night is a planning error the database can catch for free.
        UniqueConstraint(
            "reservation_traveller_id", "night", name="one_bed_per_person_per_night"
        ),
        Index("ix_rooming_departure_night", "departure_id", "night"),
        Index("ix_rooming_stay_night", "stay_id", "night"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    departure_id: Mapped[int] = mapped_column(
        ForeignKey("departures.id", ondelete="CASCADE"), nullable=False
    )
    reservation_traveller_id: Mapped[int] = mapped_column(
        ForeignKey("reservation_travellers.id", ondelete="CASCADE"), nullable=False
    )
    stay_id: Mapped[int] = mapped_column(
        ForeignKey("stays.id", ondelete="RESTRICT"), nullable=False
    )
    night: Mapped[date] = mapped_column(Date, nullable=False)

    #: For "please keep my parents together", which is the request this whole table
    #: exists to be able to honour.
    note: Mapped[str | None] = mapped_column(Text)
    assigned_by: Mapped[str | None] = mapped_column(String(120))


class Incident(Base, TimestampMixin):
    """Something that went wrong, and what was done about it.

    **No diagnosis, ever.** One of the standing constraints is "no medical clearance,
    diagnosis or fitness certification, by human or AI", so the field is `observed`
    and not `condition`. "Complained of headache, unsteady, descended to Gunji" is a
    record; "had AMS" is a clinical judgement nobody here is qualified to make, and
    it is the sentence that would be read back in a dispute.
    """

    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint("length(trim(observed)) > 0", name="incident_observed_present"),
        CheckConstraint("length(trim(reported_by)) > 0", name="incident_reporter_present"),
        CheckConstraint(
            "resolved_at is null or length(trim(coalesce(outcome,''))) > 0",
            name="resolved_incident_needs_outcome",
        ),
        Index("ix_incidents_departure", "departure_id", "occurred_at"),
        Index("ix_incidents_open", "resolved_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    departure_id: Mapped[int | None] = mapped_column(
        ForeignKey("departures.id", ondelete="SET NULL")
    )
    #: Nullable: an incident can affect a whole convoy rather than one party.
    reservation_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservations.id", ondelete="SET NULL")
    )
    reservation_traveller_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservation_travellers.id", ondelete="SET NULL")
    )
    supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("suppliers.id", ondelete="SET NULL")
    )

    severity: Mapped[IncidentSeverity] = mapped_column(
        pg_enum(IncidentSeverity, "incident_severity"), nullable=False
    )
    category: Mapped[IncidentCategory] = mapped_column(
        pg_enum(IncidentCategory, "incident_category"), nullable=False
    )

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    #: What was seen. Never what it was.
    observed: Mapped[str] = mapped_column(Text, nullable=False)
    #: What was done, at the time.
    immediate_action: Mapped[str | None] = mapped_column(Text)
    #: How it ended. Required before an incident may be closed.
    outcome: Mapped[str | None] = mapped_column(Text)

    reported_by: Mapped[str] = mapped_column(String(120), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[str | None] = mapped_column(String(120))

    #: Whether the affected travellers have been told, through their booking page.
    #: Separate from resolution: an incident can be operationally over and still owe
    #: somebody an explanation.
    travellers_informed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
