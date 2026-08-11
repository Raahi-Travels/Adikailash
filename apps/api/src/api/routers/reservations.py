"""Reservation endpoints (Phase 2, doc 09).

**No payment provider is reachable from this module.** Decision O3 settled offline
payments for the first season, so `POST /reservations/{id}/payments` records money a
coordinator watched arrive. That is a ledger entry, not a charge.

**Confirmation is computed, never chosen.** The standing constraint is that a
departure must not be presented as confirmed because a payment succeeded, so
`transition` to `confirmed` runs `confirmation_blockers` and refuses with every
failing gate listed. A coordinator cannot click past it, and money is only one of
seven gates.

Actor always comes from the session. Nothing here accepts a name in the body.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from api.deps import SessionDep, require_roles
from api.domain.departures import DepartureState
from api.domain.reservations import (
    ConfirmationGates,
    Readiness,
    ReservationState,
    TransitionRefused,
    allowed_transitions,
    confirmation_blockers,
    transition,
)
from api.localization import resolve
from api.models.access import (
    DEFAULT_TTL,
    TravellerAccessToken,
    generate_token,
    hash_token,
)
from api.models.catalogue import Journey
from api.models.documents import (
    DocumentRequirement,
    DocumentState,
    DocumentSubmission,
)
from api.models.operations import Departure
from api.models.reservations import (
    PaymentDirection,
    PaymentMethod,
    PaymentRecord,
    PolicyAcceptance,
    Reservation,
    ReservationTraveller,
    ReservationUpdate,
    TravellerRole,
    UpdateCategory,
)
from api.models.staff import FINANCE_ROLES, RESERVATION_ROLES, StaffUser
from api.schemas import (
    PaymentIn,
    PolicyAcceptanceIn,
    ReadinessOut,
    ReservationCreateIn,
    ReservationDetailOut,
    ReservationListItemOut,
    ReservationQueueOut,
    ReservationTransitionIn,
    ReservationUpdateIn,
    TravellerIn,
    UpdateIn,
    UpdateOut,
)

router = APIRouter(prefix="/admin/reservations", tags=["reservations"])

ReservationStaff = Annotated[
    StaffUser, Depends(require_roles(RESERVATION_ROLES, "working reservations"))
]
FinanceStaff = Annotated[
    StaffUser, Depends(require_roles(FINANCE_ROLES, "recording payments"))
]

#: Departure states that can carry a confirmed traveller. Anything else means the
#: departure itself is not ready to have people committed to it.
_CONFIRMABLE_DEPARTURE_STATES = frozenset(
    {
        DepartureState.CONFIRMED,
        DepartureState.PREPARATION,
        DepartureState.READY_TO_DEPART,
        DepartureState.IN_PROGRESS,
    }
)


async def _next_reference(session: SessionDep, year: int) -> str:
    """A human-readable reference, e.g. AK-2027-0007.

    Counted rather than sequenced because it has to restart each season and be
    readable over a bad phone line from Dharchula. The unique constraint on
    `reference` is the real guarantee; a race just means the insert fails and the
    caller retries, which is rare enough at this volume to be the right trade.
    """
    prefix = f"AK-{year}-"
    used = await session.scalar(
        select(func.count()).select_from(Reservation).where(
            Reservation.reference.like(f"{prefix}%")
        )
    )
    return f"{prefix}{(used or 0) + 1:04d}"


async def _load(session: SessionDep, reservation_id: int) -> Reservation:
    reservation = await session.scalar(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(
            selectinload(Reservation.travellers),
            selectinload(Reservation.payments),
            selectinload(Reservation.acceptances),
        )
    )
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found.")
    return reservation


def _received(reservation: Reservation) -> Decimal:
    """Net of the ledger. Refunds subtract, so the balance cannot drift from evidence."""
    total = Decimal("0")
    for payment in reservation.payments:
        if payment.direction is PaymentDirection.RECEIVED:
            total += payment.amount
        else:
            total -= payment.amount
    return total


async def _coordinator_name(session: SessionDep, staff_id: str | None) -> str | None:
    if not staff_id:
        return None
    staff = await session.get(StaffUser, staff_id)
    return staff.name if staff else None


async def _readiness(
    session: SessionDep, reservation: Reservation, coordinator: str | None
) -> Readiness:
    """Derived at read time, never stored. A cached readiness is a stale readiness."""
    outstanding = await session.scalar(
        select(func.count())
        .select_from(DocumentSubmission)
        .where(
            DocumentSubmission.reservation_id == reservation.id,
            DocumentSubmission.state != DocumentState.ACCEPTED,
        )
    )
    return Readiness(
        documents_outstanding=outstanding or 0,
        travellers_named=len(reservation.travellers),
        travellers_expected=reservation.party_size,
        policy_accepted=any(
            a.policy == "terms" for a in reservation.acceptances
        )
        and any(a.policy == "cancellation" for a in reservation.acceptances),
        coordinator=coordinator,
        amount_due=reservation.agreed_amount,
        amount_received=_received(reservation),
    )


async def _gates(
    session: SessionDep, reservation: Reservation, readiness: Readiness
) -> ConfirmationGates:
    departure = await session.get(Departure, reservation.departure_id)
    return ConfirmationGates(
        departure_confirmed=bool(
            departure and departure.state in _CONFIRMABLE_DEPARTURE_STATES
        ),
        operator_assigned=bool(departure and departure.operating_partner_id),
        # The departure reaching a confirmable state is itself the minimum-group
        # decision: doc 04 has minimum_group_pending as a distinct state that a human
        # moves out of once the count is met.
        minimum_group_met=bool(
            departure and departure.state in _CONFIRMABLE_DEPARTURE_STATES
        ),
        policy_accepted=readiness.policy_accepted,
        party_complete=readiness.party_complete,
        coordinator_assigned=bool(readiness.coordinator),
        amount_due=readiness.amount_due,
        amount_received=readiness.amount_received,
    )


async def _to_list_item(
    session: SessionDep, reservation: Reservation, now: datetime
) -> ReservationListItemOut:
    departure = await session.get(Departure, reservation.departure_id)
    journey_name = None
    if departure:
        journey = await session.get(Journey, departure.journey_id)
        if journey:
            journey_name = resolve(journey.name, "en")

    lead = next(
        (t for t in reservation.travellers if t.role is TravellerRole.GROUP_LEAD), None
    )
    received = _received(reservation)

    return ReservationListItemOut(
        id=reservation.id,
        reference=reservation.reference,
        state=reservation.state.value,
        departure_id=reservation.departure_id,
        journey_name=journey_name,
        start_date=departure.start_date if departure else None,
        party_size=reservation.party_size,
        travellers_named=len(reservation.travellers),
        coordinator=await _coordinator_name(session, reservation.coordinator_staff_id),
        group_lead_name=lead.full_name if lead else None,
        agreed_amount=reservation.agreed_amount,
        amount_received=received,
        balance_outstanding=max(Decimal("0"), reservation.agreed_amount - received),
        next_action=reservation.next_action,
        next_action_due_at=reservation.next_action_due_at,
        is_overdue=bool(
            reservation.next_action_due_at and reservation.next_action_due_at < now
        ),
        hold_expires_at=reservation.hold_expires_at,
        hold_expired=bool(
            reservation.state is ReservationState.HELD
            and reservation.hold_expires_at
            and reservation.hold_expires_at < now
        ),
        created_at=reservation.created_at,
    )


# ---------------------------------------------------------------------------- queue


@router.get("", response_model=ReservationQueueOut)
async def reservation_queue(
    session: SessionDep,
    staff: ReservationStaff,
    state: str | None = None,
    departure_id: int | None = None,
    unassigned: bool = False,
):
    """The reservation queue, ordered by what needs a person first.

    Same product rule as the lead queue: unowned, then expired holds, then overdue.
    An expired hold ranks high because it is occupying capacity somebody else could
    use, and nobody has decided anything.
    """
    now = datetime.now(UTC)

    stmt = select(Reservation).options(
        selectinload(Reservation.travellers),
        selectinload(Reservation.payments),
        selectinload(Reservation.acceptances),
    )
    if state:
        stmt = stmt.where(Reservation.state == state)
    if departure_id:
        stmt = stmt.where(Reservation.departure_id == departure_id)
    if unassigned:
        stmt = stmt.where(Reservation.coordinator_staff_id.is_(None))

    rows = list(await session.scalars(stmt.order_by(Reservation.created_at.desc())))
    items = [await _to_list_item(session, r, now) for r in rows]

    items.sort(
        key=lambda i: (i.coordinator is not None, not i.hold_expired, not i.is_overdue)
    )

    return ReservationQueueOut(
        reservations=items,
        total=len(items),
        unassigned_count=sum(1 for i in items if i.coordinator is None),
        overdue_count=sum(1 for i in items if i.is_overdue),
        expired_hold_count=sum(1 for i in items if i.hold_expired),
    )


@router.post("", response_model=ReservationDetailOut, status_code=201)
async def create_reservation(
    payload: ReservationCreateIn, session: SessionDep, staff: ReservationStaff
):
    departure = await session.get(Departure, payload.departure_id)
    if departure is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Departure not found.")

    reservation = Reservation(
        reference=await _next_reference(session, departure.start_date.year),
        lead_id=payload.lead_id,
        departure_id=payload.departure_id,
        party_size=payload.party_size,
        agreed_amount=payload.agreed_amount,
        # Default the coordinator to whoever opened it. A reservation belonging to
        # nobody from the moment it exists is the failure this defaults away from.
        coordinator_staff_id=payload.coordinator_staff_id or staff.id,
        internal_note=payload.internal_note,
        state=ReservationState.DRAFT,
    )
    session.add(reservation)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Could not allocate a reference. Please try again.",
        ) from None

    return await _detail(session, reservation.id)


# --------------------------------------------------------------------------- detail


async def _detail(session: SessionDep, reservation_id: int) -> ReservationDetailOut:
    reservation = await _load(session, reservation_id)
    now = datetime.now(UTC)
    base = await _to_list_item(session, reservation, now)

    coordinator = base.coordinator
    readiness = await _readiness(session, reservation, coordinator)
    gates = await _gates(session, reservation, readiness)

    return ReservationDetailOut(
        **base.model_dump(),
        currency=reservation.currency,
        internal_note=reservation.internal_note,
        cancellation_reason=reservation.cancellation_reason,
        travellers=list(reservation.travellers),
        payments=list(reservation.payments),
        acceptances=list(reservation.acceptances),
        readiness=ReadinessOut(
            documents_outstanding=readiness.documents_outstanding,
            travellers_named=readiness.travellers_named,
            travellers_expected=readiness.travellers_expected,
            policy_accepted=readiness.policy_accepted,
            coordinator=readiness.coordinator,
            amount_due=readiness.amount_due,
            amount_received=readiness.amount_received,
            balance_outstanding=readiness.balance_outstanding,
            party_complete=readiness.party_complete,
            is_ready=readiness.is_ready,
            outstanding=readiness.outstanding,
        ),
        confirmation_blockers=confirmation_blockers(gates),
        allowed_transitions=sorted(
            s.value for s in allowed_transitions(reservation.state)
        ),
    )


@router.get("/{reservation_id}", response_model=ReservationDetailOut)
async def reservation_detail(
    reservation_id: int, session: SessionDep, staff: ReservationStaff
):
    return await _detail(session, reservation_id)


@router.patch("/{reservation_id}", response_model=ReservationDetailOut)
async def update_reservation(
    reservation_id: int,
    payload: ReservationUpdateIn,
    session: SessionDep,
    staff: ReservationStaff,
):
    reservation = await _load(session, reservation_id)

    if payload.party_size is not None:
        if payload.party_size < len(reservation.travellers):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{len(reservation.travellers)} travellers are already named. "
                "Remove one before reducing the party size.",
            )
        reservation.party_size = payload.party_size
    if payload.agreed_amount is not None:
        reservation.agreed_amount = payload.agreed_amount
    if payload.coordinator_staff_id is not None:
        reservation.coordinator_staff_id = payload.coordinator_staff_id or None
    if payload.next_action is not None:
        reservation.next_action = payload.next_action or None
    if payload.next_action_due_at is not None:
        reservation.next_action_due_at = payload.next_action_due_at
    if payload.hold_expires_at is not None:
        reservation.hold_expires_at = payload.hold_expires_at
    if payload.internal_note is not None:
        reservation.internal_note = payload.internal_note or None

    await session.commit()
    return await _detail(session, reservation_id)


# ------------------------------------------------------------------------ the party


@router.post("/{reservation_id}/travellers", response_model=ReservationDetailOut, status_code=201)
async def add_traveller(
    reservation_id: int,
    payload: TravellerIn,
    session: SessionDep,
    staff: ReservationStaff,
):
    reservation = await _load(session, reservation_id)

    if len(reservation.travellers) >= reservation.party_size:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"The party is set to {reservation.party_size}. "
            "Raise the party size before adding another traveller.",
        )
    try:
        role = TravellerRole(payload.role)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown traveller role."
        ) from None

    session.add(
        ReservationTraveller(
            reservation_id=reservation.id,
            full_name=payload.full_name.strip(),
            role=role,
            date_of_birth=payload.date_of_birth,
            relationship_to_lead=payload.relationship_to_lead,
            phone=payload.phone,
            email=payload.email,
            is_senior=payload.is_senior,
            has_disclosed_health_information=payload.has_disclosed_health_information,
            dietary_note=payload.dietary_note,
        )
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        # The partial unique index. One group lead per reservation.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This reservation already has a group lead.",
        ) from None

    return await _detail(session, reservation_id)


@router.delete("/{reservation_id}/travellers/{traveller_id}", response_model=ReservationDetailOut)
async def remove_traveller(
    reservation_id: int,
    traveller_id: int,
    session: SessionDep,
    staff: ReservationStaff,
):
    traveller = await session.get(ReservationTraveller, traveller_id)
    if traveller is None or traveller.reservation_id != reservation_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Traveller not found.")
    await session.delete(traveller)
    await session.commit()
    return await _detail(session, reservation_id)


# ---------------------------------------------------------------------- the ledger


@router.post("/{reservation_id}/payments", response_model=ReservationDetailOut, status_code=201)
async def record_payment(
    reservation_id: int,
    payload: PaymentIn,
    session: SessionDep,
    staff: FinanceStaff,
):
    """Record money that has already moved.

    This endpoint charges nobody. Under decision O3 a coordinator sees a bank or UPI
    credit and records it here with its reference, so finance can reconcile against a
    statement. `recorded_by` comes from the session.
    """
    await _load(session, reservation_id)

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
            "No payment gateway is configured. Decision O8 is still open, and the "
            "site takes no money online. Record how the money actually arrived.",
        )

    session.add(
        PaymentRecord(
            reservation_id=reservation_id,
            direction=direction,
            amount=payload.amount,
            method=method,
            reference=payload.reference,
            received_at=payload.received_at,
            recorded_by=staff.name,
            note=payload.note,
        )
    )
    await session.commit()
    return await _detail(session, reservation_id)


@router.post("/{reservation_id}/acceptances", response_model=ReservationDetailOut, status_code=201)
async def record_acceptance(
    reservation_id: int,
    payload: PolicyAcceptanceIn,
    session: SessionDep,
    staff: ReservationStaff,
):
    """Record that a named person accepted a specific version of a policy."""
    await _load(session, reservation_id)

    session.add(
        PolicyAcceptance(
            reservation_id=reservation_id,
            policy=payload.policy,
            version=payload.version,
            accepted_by=payload.accepted_by.strip(),
            accepted_at=payload.accepted_at or datetime.now(UTC),
            channel=payload.channel,
            recorded_by=staff.name,
        )
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That policy version is already recorded as accepted for this reservation.",
        ) from None

    return await _detail(session, reservation_id)


# ------------------------------------------------------------------------ lifecycle


@router.post("/{reservation_id}/transition", response_model=ReservationDetailOut)
async def transition_reservation(
    reservation_id: int,
    payload: ReservationTransitionIn,
    session: SessionDep,
    staff: ReservationStaff,
):
    """Move a reservation, or refuse and return every reason.

    Confirmation runs the gates. A 422 here is the system working: it means somebody
    was about to tell a family they were going when something was still missing.
    """
    reservation = await _load(session, reservation_id)

    try:
        target = ReservationState(payload.target_state)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown reservation state."
        ) from None

    readiness = await _readiness(
        session,
        reservation,
        await _coordinator_name(session, reservation.coordinator_staff_id),
    )
    gates = await _gates(session, reservation, readiness)

    try:
        change = transition(
            current=reservation.state,
            target=target,
            actor=staff.name,
            reason=payload.reason,
            gates=gates,
        )
    except TransitionRefused as refused:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, {"reasons": refused.reasons}
        ) from None

    reservation.state = change.new_state
    reservation.state_changed_at = datetime.now(UTC)
    reservation.state_changed_by = change.actor
    if target in {
        ReservationState.CANCELLED_BY_TRAVELLER,
        ReservationState.CANCELLED_BY_US,
    }:
        reservation.cancellation_reason = change.reason

    await session.commit()
    return await _detail(session, reservation_id)


@router.post("/{reservation_id}/request-documents", status_code=201)
async def request_documents(
    reservation_id: int,
    session: SessionDep,
    staff: ReservationStaff,
):
    """Create a document checklist per named traveller, and issue one access link.

    Per traveller, not per party: a permit is issued against a person, so a party of
    four produces four sets. "The group lead uploaded a passport" is not enough and
    the old lead-level checklist quietly implied it was.

    Requirements resolve the same way the public checklist resolves them, so nobody
    ever sees a different list from the one on the website.

    The token is returned exactly once. It is stored only as a SHA-256 hash, so a
    lost link is reissued and the old one revoked, never recovered.
    """
    reservation = await _load(session, reservation_id)
    if not reservation.travellers:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Name the travellers first. Permits are issued against people, so there "
            "is nothing to ask for until we know who is going.",
        )

    departure = await session.get(Departure, reservation.departure_id)
    stmt = select(DocumentRequirement).where(DocumentRequirement.is_active.is_(True))
    if departure:
        stmt = stmt.where(
            (DocumentRequirement.journey_id == departure.journey_id)
            | (DocumentRequirement.journey_id.is_(None))
        )
    requirements = list(await session.scalars(stmt.order_by(DocumentRequirement.sort_order)))

    created = 0
    for traveller in reservation.travellers:
        for req in requirements:
            exists = await session.scalar(
                select(DocumentSubmission).where(
                    DocumentSubmission.reservation_traveller_id == traveller.id,
                    DocumentSubmission.requirement_id == req.id,
                )
            )
            if exists is not None:
                continue
            session.add(
                DocumentSubmission(
                    reservation_id=reservation.id,
                    reservation_traveller_id=traveller.id,
                    lead_id=reservation.lead_id,
                    departure_id=reservation.departure_id,
                    requirement_id=req.id,
                    traveller_name=traveller.full_name,
                    state=DocumentState.REQUIRED,
                )
            )
            created += 1

    token = generate_token()
    session.add(
        TravellerAccessToken(
            reservation_id=reservation.id,
            lead_id=reservation.lead_id,
            token_hash=hash_token(token),
            expires_at=datetime.now(UTC) + DEFAULT_TTL,
            issued_by=staff.name,
        )
    )
    await session.commit()

    return {
        "reservation_id": reservation.id,
        "reference": reservation.reference,
        "requirements_per_traveller": len(requirements),
        "documents_created": created,
        "travellers": len(reservation.travellers),
        # Shown once. There is no endpoint that can return it again.
        "access_token": token,
        "expires_at": (datetime.now(UTC) + DEFAULT_TTL).isoformat(),
    }


# --------------------------------------------------------------------- updates


@router.get("/{reservation_id}/updates", response_model=list[UpdateOut])
async def list_updates(
    reservation_id: int, session: SessionDep, staff: ReservationStaff
):
    reservation = await _load(session, reservation_id)
    await session.refresh(reservation, ["updates"])
    return list(reservation.updates)


@router.post("/{reservation_id}/updates", response_model=UpdateOut, status_code=201)
async def publish_update(
    reservation_id: int,
    payload: UpdateIn,
    session: SessionDep,
    staff: ReservationStaff,
):
    """Tell a party something, and keep the record.

    Visible on their booking page immediately. There is deliberately no edit or
    delete endpoint: the value of this record is that it says what the customer
    actually saw, and a message that can be quietly reworded afterwards is not
    evidence of anything. A correction is a new update.

    This does not send anything. Decision O9 has not settled a WhatsApp provider, so
    a coordinator still picks up the phone; when a provider exists it will read this
    table rather than replace it.
    """
    await _load(session, reservation_id)

    try:
        category = UpdateCategory(payload.category)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown update category."
        ) from None

    update = ReservationUpdate(
        reservation_id=reservation_id,
        category=category,
        title=payload.title.strip(),
        body=payload.body.strip(),
        published_by=staff.name,
    )
    session.add(update)
    await session.commit()
    await session.refresh(update)
    return update
