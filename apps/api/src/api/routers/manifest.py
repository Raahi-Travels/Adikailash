"""The departure manifest (Phase 3, doc 09).

Answers one question: can this departure leave, and if not, exactly what is stopping
it. Doc 09's exit condition is that "operations can identify and resolve every
critical blocker before departure".

The blocker/warning split lives in `api.domain.manifest` and matters more than it
looks. A screen that reports a missing dietary note with the same weight as a missing
permit is a screen nobody reads, and then the permit gets missed too.

Read-only. Nothing here changes a departure; moving a departure through its lifecycle
is the existing `/admin/departures/{id}/transition`, which has its own rules.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.deps import SessionDep, require_roles
from api.domain.manifest import DepartureReadiness, PartyReadiness
from api.domain.reservations import ReservationState
from api.localization import resolve
from api.models.catalogue import Journey, ServiceTier
from api.models.documents import DocumentRequirement, DocumentState, DocumentSubmission
from api.models.operations import Departure, OperatingPartner, StatusUpdate
from api.models.reservations import PaymentDirection, Reservation, TravellerRole
from api.models.staff import RESERVATION_ROLES, StaffUser
from api.schemas import ManifestOut, ManifestPartyOut, ManifestTravellerOut

router = APIRouter(prefix="/admin/departures", tags=["manifest"])

ManifestStaff = Annotated[
    StaffUser, Depends(require_roles(RESERVATION_ROLES, "reading a manifest"))
]

#: Reservation states whose people are actually expected to travel.
_TRAVELLING = frozenset(
    {
        ReservationState.CONFIRMED,
        ReservationState.PREPARING,
        ReservationState.READY,
        ReservationState.TRAVELLED,
    }
)


@router.get("/{departure_id}/manifest", response_model=ManifestOut)
async def departure_manifest(
    departure_id: int, session: SessionDep, staff: ManifestStaff, locale: str = "en"
):
    departure = await session.get(Departure, departure_id)
    if departure is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Departure not found.")

    journey = await session.get(Journey, departure.journey_id)
    tier = await session.get(ServiceTier, departure.service_tier_id)
    partner = (
        await session.get(OperatingPartner, departure.operating_partner_id)
        if departure.operating_partner_id
        else None
    )

    reservations = list(
        await session.scalars(
            select(Reservation)
            .where(Reservation.departure_id == departure_id)
            .options(
                selectinload(Reservation.travellers),
                selectinload(Reservation.payments),
                selectinload(Reservation.acceptances),
            )
            .order_by(Reservation.reference)
        )
    )

    # Which requirements bear a permit. These are the documents that stop a person at
    # the checkpost; everything else is a warning.
    permit_requirement_ids = {
        r.id
        for r in await session.scalars(
            select(DocumentRequirement).where(
                DocumentRequirement.is_permit_bearing.is_(True)
            )
        )
    }

    parties: list[ManifestPartyOut] = []
    readiness_parties: list[PartyReadiness] = []
    unresolved_holds = 0

    for reservation in reservations:
        if reservation.state is ReservationState.HELD:
            unresolved_holds += 1

        submissions = list(
            await session.scalars(
                select(DocumentSubmission).where(
                    DocumentSubmission.reservation_id == reservation.id
                )
            )
        )
        outstanding = [s for s in submissions if s.state is not DocumentState.ACCEPTED]

        per_traveller: dict[int | None, tuple[int, int]] = {}
        for sub in outstanding:
            total, permit = per_traveller.get(sub.reservation_traveller_id, (0, 0))
            per_traveller[sub.reservation_traveller_id] = (
                total + 1,
                permit + (1 if sub.requirement_id in permit_requirement_ids else 0),
            )

        permit_outstanding = sum(
            1 for s in outstanding if s.requirement_id in permit_requirement_ids
        )

        received = Decimal("0")
        for payment in reservation.payments:
            received += (
                payment.amount
                if payment.direction is PaymentDirection.RECEIVED
                else -payment.amount
            )
        balance = max(Decimal("0"), reservation.agreed_amount - received)

        group_lead = next(
            (
                t.full_name
                for t in reservation.travellers
                if t.role is TravellerRole.GROUP_LEAD
            ),
            None,
        )
        coordinator = None
        if reservation.coordinator_staff_id:
            found = await session.get(StaffUser, reservation.coordinator_staff_id)
            coordinator = found.name if found else None

        policy_accepted = any(
            a.policy == "terms" for a in reservation.acceptances
        ) and any(a.policy == "cancellation" for a in reservation.acceptances)

        parties.append(
            ManifestPartyOut(
                reservation_id=reservation.id,
                reference=reservation.reference,
                state=reservation.state.value,
                group_lead=group_lead,
                coordinator=coordinator,
                party_size=reservation.party_size,
                travellers=[
                    ManifestTravellerOut(
                        full_name=t.full_name,
                        role=t.role.value,
                        date_of_birth=t.date_of_birth,
                        is_senior=t.is_senior,
                        has_disclosed_health_information=t.has_disclosed_health_information,
                        documents_outstanding=per_traveller.get(t.id, (0, 0))[0],
                        permit_documents_outstanding=per_traveller.get(t.id, (0, 0))[1],
                    )
                    for t in reservation.travellers
                ],
                documents_outstanding=len(outstanding),
                permit_documents_outstanding=permit_outstanding,
                policy_accepted=policy_accepted,
                balance_outstanding=balance,
            )
        )

        readiness_parties.append(
            PartyReadiness(
                reference=reservation.reference,
                group_lead=group_lead,
                travellers_named=len(reservation.travellers),
                travellers_expected=reservation.party_size,
                documents_outstanding=len(outstanding),
                permit_documents_outstanding=permit_outstanding,
                policy_accepted=policy_accepted,
                is_confirmed=reservation.state in _TRAVELLING,
                balance_outstanding=balance > 0,
            )
        )

    # Route status for this journey's segments. Reuses the same rule the public site
    # uses to suppress sale, so ops and the website cannot disagree about the road.
    route_clear = True
    route_note = None
    latest = list(
        await session.scalars(
            select(StatusUpdate)
            .options(selectinload(StatusUpdate.segment))
            .order_by(StatusUpdate.verified_at.desc())
            .limit(20)
        )
    )
    seen: set[int] = set()
    for update in latest:
        if update.route_segment_id in seen:
            continue
        seen.add(update.route_segment_id)
        # `blocks_sale` and `public_label` delegate to api.domain.status, which is the
        # same code the public site uses. Reimplementing the rule here is how ops and
        # the website quietly start disagreeing about the road.
        if update.blocks_sale():
            route_clear = False
            # `segment.name` is localised JSONB. Interpolating it directly prints
            # the raw dict, which is what happened the first time this ran.
            segment_name = (
                resolve(update.segment.name, locale) if update.segment else "a segment"
            )
            route_note = (
                f"Route status for {segment_name} is {update.public_label()}. "
                "Confirm before departing."
            )
            break

    readiness = DepartureReadiness(
        operator_assigned=partner is not None,
        route_clear=route_clear,
        route_note=route_note,
        parties=tuple(readiness_parties),
        unresolved_holds=unresolved_holds,
    )

    return ManifestOut(
        departure_id=departure.id,
        journey_name=resolve(journey.name, locale) if journey else None,
        tier_name=resolve(tier.name, locale) if tier else None,
        start_date=departure.start_date,
        end_date=departure.end_date,
        gateway=departure.gateway,
        state=departure.state.value,
        operator_name=partner.legal_name if partner else None,
        capacity=departure.capacity,
        parties=parties,
        confirmed_parties=sum(1 for p in readiness_parties if p.is_confirmed),
        confirmed_travellers=readiness.travellers_named,
        unresolved_holds=unresolved_holds,
        can_depart=readiness.can_depart,
        blockers=readiness.blockers,
        warnings=readiness.warnings,
    )
