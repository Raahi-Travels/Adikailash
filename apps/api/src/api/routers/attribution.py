"""Contribution by acquisition source (doc 07, Phase 4).

The rules live in `api.domain.attribution` and are tested without a database. This
module does the reading, and the reading is the awkward part: supplier cost is
committed per *departure*, revenue is agreed per *reservation*, and the source is on
the *lead*. Getting from one end to the other is three joins and one apportionment,
and the apportionment is an estimate the report labels as such.

**Staff-only, and finance-shaped.** These numbers are the ones a founder would quote
to a partner or an investor, so every caveat travels with them — see
`SourcePerformance.caveats`, which returns text rather than leaving the warning to
whichever screen happens to render it.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from api.deps import SessionDep, require_roles
from api.domain.attribution import (
    ATTRIBUTION_MODEL,
    UNATTRIBUTED,
    ContributionReport,
    ReservationContribution,
    SourcePerformance,
    apportioned_cost,
)
from api.domain.reservations import ReservationState, format_inr
from api.domain.supply import COMMITTED_STATES
from api.models.attribution import AcquisitionSpend
from api.models.leads import Lead
from api.models.reservations import PaymentDirection, PaymentRecord, Reservation
from api.models.staff import FINANCE_ROLES, StaffUser
from api.models.supply import SupplierBooking
from api.schemas import ContributionReportOut, SourcePerformanceOut, SpendIn, SpendOut

router = APIRouter(prefix="/admin", tags=["attribution"])

FinanceStaff = Annotated[
    StaffUser, Depends(require_roles(FINANCE_ROLES, "reading contribution by source"))
]


async def _committed_cost_by_departure(session) -> dict[int, Decimal]:
    """Committed supplier cost per departure.

    Cancelled bookings are excluded, matching `DepartureEconomics.committed_cost` —
    two definitions of "what this departure costs" in one codebase is how two
    screens end up disagreeing in front of a founder.
    """
    rows = await session.execute(
        select(
            SupplierBooking.departure_id,
            func.coalesce(func.sum(SupplierBooking.agreed_cost), 0),
        )
        .where(SupplierBooking.state.in_([s.value for s in COMMITTED_STATES]))
        .group_by(SupplierBooking.departure_id)
    )
    return {departure_id: Decimal(cost) for departure_id, cost in rows.all()}


async def _party_total_by_departure(session) -> dict[int, int]:
    """Travellers on each departure whose reservation is actually earning.

    The denominator for apportionment. Cancelled and lapsed parties are excluded: a
    seat nobody took does not make the remaining travellers cheaper to serve, and
    including them would understate the cost of every party that did travel.
    """
    rows = await session.execute(
        select(
            Reservation.departure_id,
            func.coalesce(func.sum(Reservation.party_size), 0),
        )
        .where(
            Reservation.state.in_(
                [
                    ReservationState.CONFIRMED.value,
                    ReservationState.PREPARING.value,
                    ReservationState.READY.value,
                    ReservationState.TRAVELLED.value,
                ]
            )
        )
        .group_by(Reservation.departure_id)
    )
    return {departure_id: int(total) for departure_id, total in rows.all()}


async def _money_by_reservation(session) -> dict[int, tuple[Decimal, Decimal]]:
    """(received, refunded) per reservation, from the append-only ledger.

    Summed separately rather than netted in SQL, because the two are different facts
    and doc 07 wants refund exposure visible rather than folded into revenue.
    """
    rows = await session.execute(
        select(
            PaymentRecord.reservation_id,
            PaymentRecord.direction,
            func.coalesce(func.sum(PaymentRecord.amount), 0),
        ).group_by(PaymentRecord.reservation_id, PaymentRecord.direction)
    )
    money: dict[int, tuple[Decimal, Decimal]] = {}
    for reservation_id, direction, total in rows.all():
        received, refunded = money.get(reservation_id, (Decimal("0"), Decimal("0")))
        if direction == PaymentDirection.RECEIVED:
            received += Decimal(total)
        else:
            refunded += Decimal(total)
        money[reservation_id] = (received, refunded)
    return money


async def _spend_by_channel(
    session, since: date | None, until: date | None
) -> dict[str, Decimal]:
    """Recorded spend per channel over the window.

    An absent channel is absent from the dict, not zero — the domain layer turns
    that into `None` rather than into "free".
    """
    query = select(
        AcquisitionSpend.channel, func.coalesce(func.sum(AcquisitionSpend.amount), 0)
    ).group_by(AcquisitionSpend.channel)
    if since:
        query = query.where(AcquisitionSpend.period_end >= since)
    if until:
        query = query.where(AcquisitionSpend.period_start <= until)
    rows = await session.execute(query)
    return {channel: Decimal(total) for channel, total in rows.all()}


@router.get("/attribution", response_model=ContributionReportOut)
async def contribution_by_source(
    session: SessionDep,
    staff: FinanceStaff,
    since: date | None = None,
    until: date | None = None,
):
    """Contribution by first-touch source.

    Not revenue by source. Doc 07: "Do not report return on ad spend using gross
    booking value alone when supplier costs, refunds and conditional reservations
    materially affect the business." All three do here, so all three are subtracted
    or separated before anything is ranked.
    """
    costs = await _committed_cost_by_departure(session)
    parties = await _party_total_by_departure(session)
    money = await _money_by_reservation(session)
    spend = await _spend_by_channel(session, since, until)

    # Leads carry the source; reservations carry the money. A reservation with no
    # lead is real — a walk-in, a phone call taken by a founder — and lands in the
    # unattributed bucket rather than being dropped.
    lead_query = select(Lead)
    if since:
        lead_query = lead_query.where(Lead.created_at >= since)
    if until:
        lead_query = lead_query.where(Lead.created_at <= until)
    leads = list(await session.scalars(lead_query))
    source_of_lead = {
        lead.id: (lead.first_touch_source or UNATTRIBUTED) for lead in leads
    }

    performance: dict[str, SourcePerformance] = {}

    def bucket(name: str) -> SourcePerformance:
        if name not in performance:
            performance[name] = SourcePerformance(source=name, spend=spend.get(name))
        return performance[name]

    for lead in leads:
        bucket(source_of_lead[lead.id]).leads += 1

    reservation_query = select(Reservation)
    if since:
        reservation_query = reservation_query.where(Reservation.created_at >= since)
    if until:
        reservation_query = reservation_query.where(Reservation.created_at <= until)

    for reservation in await session.scalars(reservation_query):
        received, refunded = money.get(
            reservation.id, (Decimal("0"), Decimal("0"))
        )
        source = (
            source_of_lead.get(reservation.lead_id, UNATTRIBUTED)
            if reservation.lead_id
            else UNATTRIBUTED
        )
        row = ReservationContribution(
            reservation_id=reservation.id,
            reference=reservation.reference,
            state=reservation.state,
            party_size=reservation.party_size,
            source=source,
            campaign=None,
            landing_page=None,
            agreed_amount=Decimal(reservation.agreed_amount or 0),
            received=received,
            refunded=refunded,
            apportioned_supplier_cost=apportioned_cost(
                costs.get(reservation.departure_id, Decimal("0")),
                parties.get(reservation.departure_id, 0),
                reservation.party_size,
            ),
        )
        bucket(source).add(row)

    report = ContributionReport(sources=list(performance.values()))

    # Spend recorded against a channel no lead ever arrived from. Surfaced rather
    # than dropped: it is almost always a typo in the channel name, and a silently
    # ignored spend row makes every other channel look better than it is.
    unmatched = sorted(set(spend) - set(performance))

    return ContributionReportOut(
        attribution_model=ATTRIBUTION_MODEL,
        sources=[
            SourcePerformanceOut(
                source=s.source,
                leads=s.leads,
                reservations=s.reservations,
                earning_reservations=s.earning_reservations,
                conditional_reservations=s.conditional_reservations,
                travellers=s.travellers,
                gross_agreed=s.gross_agreed,
                supplier_cost=s.supplier_cost,
                refunded=s.refunded,
                received=s.received,
                contribution=s.contribution,
                contribution_display=format_inr(s.contribution),
                contribution_margin_percent=s.contribution_margin_percent,
                conditional_value=s.conditional_value,
                lead_to_reservation_percent=s.lead_to_reservation_percent,
                contribution_per_lead=s.contribution_per_lead,
                spend=s.spend,
                cost_per_qualified_lead=s.cost_per_qualified_lead,
                acquisition_share_of_contribution=s.acquisition_share_of_contribution,
                is_low_confidence=s.is_low_confidence,
                caveats=s.caveats,
            )
            for s in report.ranked()
        ],
        total_contribution=report.total_contribution,
        total_contribution_display=format_inr(report.total_contribution),
        total_conditional_value=report.total_conditional_value,
        unattributed_lead_share_percent=report.unattributed_lead_share_percent,
        unattributed_contribution_share_percent=(
            report.unattributed_contribution_share_percent
        ),
        unmatched_spend_channels=unmatched,
    )


@router.get("/acquisition-spend", response_model=list[SpendOut])
async def list_spend(session: SessionDep, staff: FinanceStaff, limit: int = 100):
    """Every spend row, newest period first.

    Needed to see what has already been entered before adding more — the unique
    constraint catches a duplicate, but only after somebody has typed it, and a
    finance screen that cannot show its own inputs is one people stop trusting.
    """
    rows = await session.scalars(
        select(AcquisitionSpend)
        .order_by(AcquisitionSpend.period_start.desc(), AcquisitionSpend.channel)
        .limit(limit)
    )
    return [SpendOut.model_validate(r) for r in rows]


@router.post("/acquisition-spend", response_model=SpendOut, status_code=201)
async def record_spend(payload: SpendIn, session: SessionDep, staff: FinanceStaff):
    """Record what was spent on a channel over a period.

    Entered by hand rather than pulled from an ad platform: a monthly figure typed
    off an invoice is more accurate than a mis-mapped API field, and it does not tie
    a three-person team to a provider before they have decided to advertise.
    """
    if payload.period_end < payload.period_start:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "The period ends before it starts.",
        )

    row = AcquisitionSpend(
        channel=payload.channel.strip(),
        campaign=(payload.campaign or "").strip(),
        period_start=payload.period_start,
        period_end=payload.period_end,
        amount=payload.amount,
        note=payload.note,
        recorded_by=staff.name or staff.email or staff.id,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError:
        # The unique constraint on (channel, campaign, period_start). Almost always
        # somebody entering the same invoice twice — and a silently doubled
        # denominator makes a channel look half as efficient as it is, which is the
        # exact error the constraint exists to catch. So it has to say so, rather
        # than surfacing as a 500 that invites a third attempt.
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Spend for {payload.channel} in this period is already recorded. Edit "
            "that row rather than adding a second one, or the cost per lead for this "
            "channel will be double what it should be.",
        ) from None

    await session.refresh(row)
    return SpendOut.model_validate(row)
