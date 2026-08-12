"""Suppliers, payables, rooming and incidents (Phase 3, doc 09).

Three access rules, each for a stated reason:

- **Supplier bookings and rooming** are operations work: `DEPARTURE_LIFECYCLE_ROLES`.
- **Supplier payments** are finance, the same narrow set that records customer money.
  Doc 06 wants finance held separately, and every row is a human asserting money moved.
- **Reporting an incident** uses the widest role set in the codebase. Least privilege
  is about *reading* sensitive data; a coordinator who cannot file an incident because
  of a permission is a coordinator who tells nobody, and that is the failure this is
  meant to prevent.

No gateway anywhere. Decision O3 covers customers and the same holds for suppliers:
these endpoints record money that already moved.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.deps import SessionDep, require_roles
from api.domain.incidents import IncidentCategory, IncidentSeverity, IncidentStatus
from api.domain.reservations import ReservationState
from api.domain.supply import (
    Bed,
    BookingCost,
    BookingState,
    DepartureEconomics,
    RoomingPlan,
    SupplierKind,
)
from api.localization import resolve
from api.models.catalogue import Stay
from api.models.operations import Departure, DepartureCheckIn
from api.models.reservations import (
    PaymentDirection,
    PaymentMethod,
    Reservation,
    ReservationTraveller,
)
from api.models.staff import (
    DEPARTURE_LIFECYCLE_ROLES,
    FINANCE_ROLES,
    INCIDENT_ROLES,
    StaffUser,
)
from api.models.supply import (
    Incident,
    RoomingAssignment,
    Supplier,
    SupplierBooking,
    SupplierPayment,
)
from api.schemas import (
    CheckInIn,
    EconomicsOut,
    IncidentIn,
    IncidentOut,
    SharedCheckInOut,
    IncidentUpdateIn,
    RoomingAssignmentIn,
    RoomingBedOut,
    RoomingOut,
    SupplierBookingIn,
    SupplierBookingOut,
    SupplierBookingUpdateIn,
    SupplierIn,
    SupplierOut,
    SupplierPaymentIn,
)

router = APIRouter(prefix="/admin", tags=["operations"])

OpsStaff = Annotated[
    StaffUser, Depends(require_roles(DEPARTURE_LIFECYCLE_ROLES, "managing suppliers"))
]
FinanceStaff = Annotated[
    StaffUser, Depends(require_roles(FINANCE_ROLES, "recording supplier payments"))
]
AnyOpsStaff = Annotated[
    StaffUser, Depends(require_roles(INCIDENT_ROLES, "reporting an incident"))
]

#: Reservation states whose people actually need a bed.
_TRAVELLING = frozenset(
    {
        ReservationState.CONFIRMED,
        ReservationState.PREPARING,
        ReservationState.READY,
        ReservationState.TRAVELLED,
    }
)


def _paid(booking: SupplierBooking) -> Decimal:
    """Net of the supplier ledger. Refunds from a supplier subtract."""
    total = Decimal("0")
    for payment in booking.payments:
        if payment.direction is PaymentDirection.RECEIVED:
            total += payment.amount
        else:
            total -= payment.amount
    return total


def _booking_out(booking: SupplierBooking) -> SupplierBookingOut:
    cost = BookingCost(
        reference=str(booking.id),
        supplier_name=booking.supplier.name,
        kind=booking.supplier.kind,
        state=booking.state,
        agreed_cost=booking.agreed_cost,
        paid=_paid(booking),
    )
    return SupplierBookingOut(
        id=booking.id,
        supplier_id=booking.supplier_id,
        supplier_name=booking.supplier.name,
        kind=booking.supplier.kind.value,
        service=booking.service,
        state=booking.state.value,
        starts_on=booking.starts_on,
        ends_on=booking.ends_on,
        agreed_cost=booking.agreed_cost,
        paid=cost.paid,
        outstanding=cost.outstanding,
        is_overpaid=cost.is_overpaid,
        currency=booking.currency,
        confirmed_by=booking.confirmed_by,
        cancellation_reason=booking.cancellation_reason,
        note=booking.note,
        payments=list(booking.payments),
    )


async def _bookings(session: SessionDep, departure_id: int) -> list[SupplierBooking]:
    return list(
        await session.scalars(
            select(SupplierBooking)
            .where(SupplierBooking.departure_id == departure_id)
            .options(
                selectinload(SupplierBooking.supplier),
                selectinload(SupplierBooking.payments),
            )
            .order_by(SupplierBooking.id)
        )
    )


# ------------------------------------------------------------------- suppliers


@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(session: SessionDep, staff: OpsStaff, kind: str | None = None):
    stmt = select(Supplier).where(Supplier.is_active.is_(True))
    if kind:
        stmt = stmt.where(Supplier.kind == kind)
    return list(await session.scalars(stmt.order_by(Supplier.name)))


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
async def create_supplier(payload: SupplierIn, session: SessionDep, staff: OpsStaff):
    try:
        kind = SupplierKind(payload.kind)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown supplier kind."
        ) from None

    supplier = Supplier(
        name=payload.name.strip(),
        kind=kind,
        contact_name=payload.contact_name,
        phone=payload.phone,
        village=payload.village,
        stay_id=payload.stay_id,
        reliability_note=payload.reliability_note,
    )
    session.add(supplier)
    await session.commit()
    await session.refresh(supplier)
    return supplier


# ------------------------------------------------------- bookings and payables


@router.get(
    "/departures/{departure_id}/suppliers", response_model=list[SupplierBookingOut]
)
async def departure_suppliers(
    departure_id: int, session: SessionDep, staff: OpsStaff
):
    return [_booking_out(b) for b in await _bookings(session, departure_id)]


@router.post(
    "/departures/{departure_id}/suppliers",
    response_model=SupplierBookingOut,
    status_code=201,
)
async def book_supplier(
    departure_id: int,
    payload: SupplierBookingIn,
    session: SessionDep,
    staff: OpsStaff,
):
    departure = await session.get(Departure, departure_id)
    if departure is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Departure not found.")
    if await session.get(Supplier, payload.supplier_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found.")

    booking = SupplierBooking(
        departure_id=departure_id,
        supplier_id=payload.supplier_id,
        service=payload.service.strip(),
        starts_on=payload.starts_on or departure.start_date,
        ends_on=payload.ends_on or departure.end_date,
        agreed_cost=payload.agreed_cost,
        note=payload.note,
        state=BookingState.ENQUIRED,
    )
    session.add(booking)
    await session.commit()

    loaded = await session.scalar(
        select(SupplierBooking)
        .where(SupplierBooking.id == booking.id)
        .options(
            selectinload(SupplierBooking.supplier),
            selectinload(SupplierBooking.payments),
        )
    )
    return _booking_out(loaded)


@router.patch("/supplier-bookings/{booking_id}", response_model=SupplierBookingOut)
async def update_booking(
    booking_id: int,
    payload: SupplierBookingUpdateIn,
    session: SessionDep,
    staff: OpsStaff,
):
    booking = await session.scalar(
        select(SupplierBooking)
        .where(SupplierBooking.id == booking_id)
        .options(
            selectinload(SupplierBooking.supplier),
            selectinload(SupplierBooking.payments),
        )
    )
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found.")

    if payload.state is not None:
        try:
            new_state = BookingState(payload.state)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown booking state."
            ) from None
        if new_state is BookingState.CANCELLED and not (
            payload.cancellation_reason or booking.cancellation_reason
        ):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "A cancelled supplier booking needs a reason. It is how you learn "
                "which suppliers to stop using.",
            )
        if new_state is BookingState.CONFIRMED and booking.confirmed_at is None:
            booking.confirmed_at = datetime.now(UTC)
            booking.confirmed_by = staff.name
        booking.state = new_state

    if payload.service is not None:
        booking.service = payload.service.strip()
    if payload.agreed_cost is not None:
        booking.agreed_cost = payload.agreed_cost
    if payload.cancellation_reason is not None:
        booking.cancellation_reason = payload.cancellation_reason or None
    if payload.note is not None:
        booking.note = payload.note or None

    await session.commit()
    await session.refresh(booking, ["supplier", "payments"])
    return _booking_out(booking)


@router.post(
    "/supplier-bookings/{booking_id}/payments",
    response_model=SupplierBookingOut,
    status_code=201,
)
async def record_supplier_payment(
    booking_id: int,
    payload: SupplierPaymentIn,
    session: SessionDep,
    staff: FinanceStaff,
):
    """Record money paid to a supplier. Charges nothing; this is a ledger entry."""
    booking = await session.get(SupplierBooking, booking_id)
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found.")

    try:
        method = PaymentMethod(payload.method)
        direction = PaymentDirection(payload.direction)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown payment method or direction."
        ) from None
    if method is PaymentMethod.GATEWAY:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No payment gateway is configured. Record how the money actually moved.",
        )

    session.add(
        SupplierPayment(
            supplier_booking_id=booking_id,
            direction=direction,
            amount=payload.amount,
            method=method,
            reference=payload.reference,
            paid_at=payload.paid_at,
            recorded_by=staff.name,
            note=payload.note,
        )
    )
    await session.commit()

    loaded = await session.scalar(
        select(SupplierBooking)
        .where(SupplierBooking.id == booking_id)
        .options(
            selectinload(SupplierBooking.supplier),
            selectinload(SupplierBooking.payments),
        )
    )
    return _booking_out(loaded)


@router.get("/departures/{departure_id}/economics", response_model=EconomicsOut)
async def departure_economics(
    departure_id: int, session: SessionDep, staff: OpsStaff
):
    """Committed supplier cost against agreed customer revenue.

    Doc 09's Phase 4 exit condition asks for growth "without losing unit-economics
    visibility". This is the smallest honest version: it counts only confirmed
    reservations and non-cancelled supplier bookings, and never nets one against the
    other.
    """
    bookings = await _bookings(session, departure_id)

    reservations = list(
        await session.scalars(
            select(Reservation)
            .where(Reservation.departure_id == departure_id)
            .options(selectinload(Reservation.payments))
        )
    )
    agreed = Decimal("0")
    received = Decimal("0")
    for reservation in reservations:
        if reservation.state not in _TRAVELLING:
            continue
        agreed += reservation.agreed_amount
        for payment in reservation.payments:
            received += (
                payment.amount
                if payment.direction is PaymentDirection.RECEIVED
                else -payment.amount
            )

    economics = DepartureEconomics(
        bookings=tuple(
            BookingCost(
                reference=str(b.id),
                supplier_name=b.supplier.name,
                kind=b.supplier.kind,
                state=b.state,
                agreed_cost=b.agreed_cost,
                paid=_paid(b),
            )
            for b in bookings
        ),
        customer_revenue_agreed=agreed,
        customer_revenue_received=received,
    )

    return EconomicsOut(
        customer_revenue_agreed=economics.customer_revenue_agreed,
        customer_revenue_received=economics.customer_revenue_received,
        committed_cost=economics.committed_cost,
        paid_to_suppliers=economics.paid_to_suppliers,
        owed_to_suppliers=economics.owed_to_suppliers,
        margin=economics.margin,
        margin_percent=economics.margin_percent,
        is_loss_making=economics.is_loss_making,
    )


# --------------------------------------------------------------------- rooming


def _nights(departure: Departure) -> list[date]:
    """Nights on the road: the last day is a departure day, not a night."""
    span = (departure.end_date - departure.start_date).days
    return [departure.start_date + timedelta(days=i) for i in range(max(0, span))]


@router.get("/departures/{departure_id}/rooming", response_model=RoomingOut)
async def departure_rooming(
    departure_id: int, session: SessionDep, staff: OpsStaff, locale: str = "en"
):
    departure = await session.get(Departure, departure_id)
    if departure is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Departure not found.")

    rows = list(
        await session.scalars(
            select(RoomingAssignment)
            .where(RoomingAssignment.departure_id == departure_id)
            .order_by(RoomingAssignment.night, RoomingAssignment.id)
        )
    )

    beds: list[Bed] = []
    out: list[RoomingBedOut] = []
    for row in rows:
        traveller = await session.get(ReservationTraveller, row.reservation_traveller_id)
        stay = await session.get(Stay, row.stay_id)
        stay_name = resolve(stay.name, locale) if stay else "Unknown stay"
        beds.append(
            Bed(
                traveller_id=row.reservation_traveller_id,
                traveller_name=traveller.full_name if traveller else "Unknown",
                stay_id=row.stay_id,
                stay_name=stay_name,
                night=row.night,
                stay_capacity=stay.typical_occupancy if stay else None,
            )
        )
        out.append(
            RoomingBedOut(
                id=row.id,
                reservation_traveller_id=row.reservation_traveller_id,
                traveller_name=traveller.full_name if traveller else "Unknown",
                stay_id=row.stay_id,
                stay_name=stay_name,
                night=row.night,
                note=row.note,
            )
        )

    # Only confirmed parties need beds. A hold that never converted must not appear
    # as an unassigned traveller and swamp the real gaps.
    expected: list[tuple[int, str]] = []
    for reservation in await session.scalars(
        select(Reservation)
        .where(Reservation.departure_id == departure_id)
        .options(selectinload(Reservation.travellers))
    ):
        if reservation.state not in _TRAVELLING:
            continue
        for traveller in reservation.travellers:
            expected.append((traveller.id, traveller.full_name))

    nights = _nights(departure)
    plan = RoomingPlan(
        beds=tuple(beds), expected=tuple(expected), nights=tuple(nights)
    )

    return RoomingOut(
        beds=out,
        nights=nights,
        over_capacity=plan.over_capacity,
        unknown_capacity=plan.unknown_capacity,
        unassigned=plan.unassigned,
        is_complete=plan.is_complete,
    )


@router.post("/departures/{departure_id}/rooming", response_model=RoomingOut, status_code=201)
async def assign_bed(
    departure_id: int,
    payload: RoomingAssignmentIn,
    session: SessionDep,
    staff: OpsStaff,
):
    if await session.get(Departure, departure_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Departure not found.")

    existing = await session.scalar(
        select(RoomingAssignment).where(
            RoomingAssignment.reservation_traveller_id
            == payload.reservation_traveller_id,
            RoomingAssignment.night == payload.night,
        )
    )
    if existing is not None:
        # Moving somebody is the common case, so update rather than refuse.
        existing.stay_id = payload.stay_id
        existing.note = payload.note
        existing.assigned_by = staff.name
    else:
        session.add(
            RoomingAssignment(
                departure_id=departure_id,
                reservation_traveller_id=payload.reservation_traveller_id,
                stay_id=payload.stay_id,
                night=payload.night,
                note=payload.note,
                assigned_by=staff.name,
            )
        )
    await session.commit()
    return await departure_rooming(departure_id, session, staff)


@router.delete("/rooming/{assignment_id}", status_code=204)
async def remove_bed(assignment_id: int, session: SessionDep, staff: OpsStaff):
    row = await session.get(RoomingAssignment, assignment_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found.")
    await session.delete(row)
    await session.commit()


# -------------------------------------------------------------------- incidents


def _incident_out(incident: Incident, *, now: datetime | None = None) -> IncidentOut:
    state = IncidentStatus(
        severity=incident.severity,
        occurred_at=incident.occurred_at,
        resolved_at=incident.resolved_at,
        last_updated_at=incident.updated_at,
        travellers_informed=incident.travellers_informed,
    )
    return IncidentOut(
        id=incident.id,
        severity=incident.severity.value,
        category=incident.category.value,
        occurred_at=incident.occurred_at,
        observed=incident.observed,
        immediate_action=incident.immediate_action,
        outcome=incident.outcome,
        reported_by=incident.reported_by,
        resolved_at=incident.resolved_at,
        resolved_by=incident.resolved_by,
        travellers_informed=incident.travellers_informed,
        departure_id=incident.departure_id,
        reservation_id=incident.reservation_id,
        created_at=incident.created_at,
        is_open=state.is_open(),
        is_overdue=state.is_overdue(now=now),
        needs_founder=state.severity in {IncidentSeverity.SERIOUS, IncidentSeverity.CRITICAL},
        obligations=state.obligations(now=now),
    )


@router.get("/incidents", response_model=list[IncidentOut])
async def list_incidents(
    session: SessionDep,
    staff: AnyOpsStaff,
    departure_id: int | None = None,
    open_only: bool = False,
):
    stmt = select(Incident)
    if departure_id:
        stmt = stmt.where(Incident.departure_id == departure_id)
    if open_only:
        stmt = stmt.where(Incident.resolved_at.is_(None))

    rows = list(await session.scalars(stmt.order_by(Incident.occurred_at.desc())))
    items = [_incident_out(i) for i in rows]
    # Open and overdue first, then by severity. Same product rule as the other
    # queues: what needs a person, first.
    order = {s.value: i for i, s in enumerate(reversed(list(IncidentSeverity)))}
    items.sort(key=lambda i: (not i.is_open, not i.is_overdue, order.get(i.severity, 99)))
    return items


@router.post("/incidents", response_model=IncidentOut, status_code=201)
async def report_incident(
    payload: IncidentIn, session: SessionDep, staff: AnyOpsStaff
):
    """File an incident.

    `observed` records what was seen, never what it was. The standing constraint is
    "no medical clearance, diagnosis or fitness certification, by human or AI", and
    this is the endpoint where somebody would be most tempted.
    """
    try:
        severity = IncidentSeverity(payload.severity)
        category = IncidentCategory(payload.category)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown severity or category."
        ) from None

    incident = Incident(
        departure_id=payload.departure_id,
        reservation_id=payload.reservation_id,
        reservation_traveller_id=payload.reservation_traveller_id,
        supplier_id=payload.supplier_id,
        severity=severity,
        category=category,
        occurred_at=payload.occurred_at,
        observed=payload.observed.strip(),
        immediate_action=payload.immediate_action,
        reported_by=staff.name,
    )
    session.add(incident)
    await session.commit()
    await session.refresh(incident)
    return _incident_out(incident)


@router.patch("/incidents/{incident_id}", response_model=IncidentOut)
async def update_incident(
    incident_id: int,
    payload: IncidentUpdateIn,
    session: SessionDep,
    staff: AnyOpsStaff,
):
    incident = await session.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found.")

    if payload.immediate_action is not None:
        incident.immediate_action = payload.immediate_action or None
    if payload.outcome is not None:
        incident.outcome = payload.outcome or None
    if payload.travellers_informed is not None:
        incident.travellers_informed = payload.travellers_informed

    if payload.resolve:
        if not (incident.outcome or "").strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "An incident cannot be closed without an outcome. What happened in "
                "the end is the part somebody will ask about.",
            )
        incident.resolved_at = datetime.now(UTC)
        incident.resolved_by = staff.name

    await session.commit()
    await session.refresh(incident)
    return _incident_out(incident)


@router.post("/departures/{departure_id}/check-in", response_model=SharedCheckInOut)
async def post_check_in(
    departure_id: int,
    payload: CheckInIn,
    session: SessionDep,
    staff: AnyOpsStaff,
):
    """A coordinator says where the group is and that everyone is well.

    This is the source for both the family share view and the traveller companion.
    It is typed by a person on purpose — doc 05 wants a check-in *offered*, and an
    automatic "they should be in Gunji by now" derived from the itinerary would be a
    claim we cannot stand behind at exactly the moment a family is relying on it.

    Append-only. Correcting a check-in means posting another one, so a family sees
    that a correction happened rather than history changing quietly under them.

    `is_shareable=false` keeps it internal: true, useful operationally, and not
    something to put in front of a relative without context.
    """
    departure = await session.get(Departure, departure_id)
    if departure is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Departure not found.")

    row = DepartureCheckIn(
        departure_id=departure_id,
        note=payload.note.strip(),
        location=payload.location,
        # The staff member's *name*, not their email. This string is shown to a
        # family member on a share link, and doc 05 asks for a named coordinator —
        # "ops@example.invalid" is neither a name nor something to hand to an
        # external party. The email is the fallback only so the NOT NULL check can
        # never be what stops a check-in being posted from the field.
        posted_by=staff.name or staff.email or staff.id,
        occurred_at=payload.occurred_at or datetime.now(UTC),
        is_shareable=payload.is_shareable,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)

    return SharedCheckInOut(at=row.occurred_at, note=row.note, posted_by=row.posted_by)
