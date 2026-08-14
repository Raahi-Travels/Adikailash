"""Vendor performance and post-trip learning (doc 06, Phase 4).

The judgement lives in `api.domain.vendors` and is tested without a database. This
module gathers the four kinds of evidence that feed it, and the awkward one is the
fourth:

  1. Coordinator reviews — `supplier_reviews`, one per vendor per departure.
  2. Incidents — already carry `supplier_id`.
  3. Cost variance — agreed on the booking, paid from the supplier ledger.
  4. **Traveller ratings** — which live on `trip_feedback`, attached to a
     *reservation*, and have to be walked back to a vendor through the departure.

That last walk is where a plausible-looking mistake lives. A departure has several
vendors; a traveller rating for `accommodation` belongs to the stay, and
`pickup_and_transport` to the vehicle. Handing every vendor on a departure every
rating would credit a driver for a good homestay and blame a host for a late jeep.
`FEEDBACK_DIMENSION_BY_KIND` is what stops that, and a vendor kind absent from it
gets no traveller signal at all — nothing on the traveller form asks about a permit
agent, and inventing an answer would be worse than the gap.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from api.deps import SessionDep, require_roles
from api.domain.incidents import IncidentSeverity
from api.domain.vendors import (
    FEEDBACK_DIMENSION_BY_KIND,
    CostVariance,
    IncidentSummary,
    Review,
    TravellerSignal,
    VendorRecord,
    assess,
)
from api.models.advocacy import TripFeedback
from api.models.reservations import Reservation
from api.models.staff import DEPARTURE_LIFECYCLE_ROLES, StaffUser
from api.models.supply import (
    Incident,
    Supplier,
    SupplierBooking,
    SupplierPayment,
    SupplierReview,
)
from api.schemas import (
    SupplierReviewIn,
    SupplierReviewOut,
    VendorAssessmentOut,
    VendorHoldIn,
)

router = APIRouter(prefix="/admin", tags=["vendors"])

OpsStaff = Annotated[
    StaffUser,
    Depends(require_roles(DEPARTURE_LIFECYCLE_ROLES, "reviewing vendor performance")),
]

RATING_COLUMNS = (
    "confirmation_reliability",
    "punctuality",
    "accuracy_against_promise",
    "cleanliness_and_condition",
    "staff_behaviour",
    "communication",
    "issue_resolution",
)


async def _traveller_signal(
    session, supplier: Supplier, departure_ids: list[int]
) -> TravellerSignal | None:
    """Traveller ratings for the one dimension this vendor is answerable for.

    Returns None for a vendor kind the traveller form does not ask about, rather than
    an empty signal — "no opinion was collected" and "travellers rated this zero" must
    not render the same way.
    """
    dimension = FEEDBACK_DIMENSION_BY_KIND.get(supplier.kind.value)
    if dimension is None or not departure_ids:
        return None

    column = getattr(TripFeedback, dimension)
    rows = await session.scalars(
        select(column)
        .join(Reservation, Reservation.id == TripFeedback.reservation_id)
        .where(
            Reservation.departure_id.in_(departure_ids),
            TripFeedback.submitted_at.isnot(None),
            column.isnot(None),
        )
    )
    return TravellerSignal(dimension=dimension, ratings=tuple(int(r) for r in rows))


async def _record(session, supplier: Supplier) -> VendorRecord:
    bookings = list(
        await session.scalars(
            select(SupplierBooking).where(SupplierBooking.supplier_id == supplier.id)
        )
    )
    departure_ids = [b.departure_id for b in bookings]

    reviews = [
        Review(
            departure_id=row.departure_id,
            ratings={
                column: getattr(row, column)
                for column in RATING_COLUMNS
                if getattr(row, column) is not None
            },
            would_use_again=row.would_use_again,
            note=row.note,
            reviewed_by=row.reviewed_by,
        )
        for row in await session.scalars(
            select(SupplierReview).where(SupplierReview.supplier_id == supplier.id)
        )
    ]

    incidents = [
        IncidentSummary(
            incident_id=row.id,
            severity=IncidentSeverity(row.severity),
            observed=row.observed,
            outcome=row.outcome,
            is_resolved=row.resolved_at is not None,
        )
        for row in await session.scalars(
            select(Incident).where(Incident.supplier_id == supplier.id)
        )
    ]

    paid = (
        await session.scalar(
            select(func.coalesce(func.sum(SupplierPayment.amount), 0)).where(
                SupplierPayment.supplier_booking_id.in_([b.id for b in bookings] or [0])
            )
        )
    ) or 0

    return VendorRecord(
        supplier_id=supplier.id,
        name=supplier.name,
        kind=supplier.kind.value,
        reviews=reviews,
        incidents=incidents,
        traveller_signal=await _traveller_signal(session, supplier, departure_ids),
        cost=CostVariance(
            agreed=sum(
                (Decimal(b.agreed_cost or 0) for b in bookings), Decimal("0")
            ),
            paid=Decimal(paid),
        ),
        manual_hold_reason=supplier.hold_reason,
    )


def _out(assessment) -> VendorAssessmentOut:
    return VendorAssessmentOut(
        supplier_id=assessment.supplier_id,
        name=assessment.name,
        recommendation=assessment.recommendation.value,
        headline=assessment.headline,
        blocking_concerns=assessment.blocking_concerns,
        notes=assessment.notes,
        ratings=assessment.ratings,
        traveller_average=assessment.traveller_average,
        traveller_count=assessment.traveller_count,
        review_count=assessment.review_count,
        incident_count=assessment.incident_count,
        cost_variance=assessment.cost_variance,
        cost_outstanding=assessment.cost_outstanding,
        cost_settled=assessment.cost_settled,
        is_rateable=assessment.is_rateable,
        reliability_score=assessment.reliability_score,
        score_explanation=assessment.score_explanation,
        is_score_capped=assessment.is_score_capped,
    )


@router.get("/vendors", response_model=list[VendorAssessmentOut])
async def vendor_performance(session: SessionDep, staff: OpsStaff):
    """Every vendor, with what is known about them and what to do next season.

    Ordered so anything needing a decision surfaces first. A list sorted by score
    would bury the vendor with an open serious incident somewhere in the middle,
    which is precisely what doc 06 forbids.
    """
    suppliers = list(await session.scalars(select(Supplier).order_by(Supplier.name)))
    assessments = [assess(await _record(session, s)) for s in suppliers]

    order = {
        "do_not_use": 0,
        "review_before_rebooking": 1,
        "use_again": 2,
        "too_early_to_say": 3,
    }
    # Sorted by recommendation first and score second — never by score alone. A
    # score-ordered list would put a capped 40 above an unrated newcomer and read as
    # a league table, which is the framing doc 06 is guarding against.
    assessments.sort(
        key=lambda a: (
            order[a.recommendation.value],
            -(a.reliability_score or -1),
            a.name,
        )
    )
    return [_out(a) for a in assessments]


@router.get("/vendors/{supplier_id}", response_model=VendorAssessmentOut)
async def one_vendor(supplier_id: int, session: SessionDep, staff: OpsStaff):
    supplier = await session.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found.")
    return _out(assess(await _record(session, supplier)))


@router.post(
    "/suppliers/{supplier_id}/reviews", response_model=SupplierReviewOut, status_code=201
)
async def review_supplier(
    supplier_id: int,
    payload: SupplierReviewIn,
    session: SessionDep,
    staff: OpsStaff,
):
    """Record how a vendor did on one departure.

    Doc 06 asks for this "after each departure", which is the only time anybody
    remembers the detail. `would_use_again = false` requires a note, enforced by a
    database check — the reason is the entire value of this row to whoever reads it
    next season, and a bare boolean tells them nothing they can act on.
    """
    supplier = await session.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found.")

    if payload.would_use_again is False and not (payload.note or "").strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Saying you would not use this vendor again needs a reason. Whoever plans"
            " next season will read that sentence, not the checkbox.",
        )

    row = SupplierReview(
        supplier_id=supplier_id,
        departure_id=payload.departure_id,
        would_use_again=payload.would_use_again,
        note=payload.note,
        reviewed_by=staff.name or staff.email or staff.id,
        **{c: getattr(payload, c) for c in RATING_COLUMNS},
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This vendor has already been reviewed for that departure. A second"
            " review is either a duplicate or a disagreement, and both are worth a"
            " conversation rather than two rows quietly averaged together.",
        ) from None

    await session.refresh(row)
    return SupplierReviewOut.model_validate(row)


@router.post("/suppliers/{supplier_id}/hold", response_model=VendorAssessmentOut)
async def hold_supplier(
    supplier_id: int, payload: VendorHoldIn, session: SessionDep, staff: OpsStaff
):
    """Stop using a vendor, or lift a hold. A person's decision, with its reason.

    Doc 06: "serious incidents and manual judgement must remain visible rather than
    hidden in an average." This is the manual judgement, and it outranks every
    computed figure in the assessment — no run of good reviews clears it. Lifting it
    is a separate deliberate act by somebody who read why it was put there.
    """
    supplier = await session.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found.")

    if payload.reason and not payload.reason.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "A hold needs a reason."
        )

    supplier.hold_reason = payload.reason.strip() if payload.reason else None
    await session.commit()
    return _out(assess(await _record(session, supplier)))
