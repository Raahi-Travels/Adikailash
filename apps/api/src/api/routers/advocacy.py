"""Post-trip feedback, the complaint gate, review requests and referrals (doc 07).

The public half is one endpoint: a traveller opens a token link and submits the
private form. The staff half reads what came back, resolves complaints, and — only
once nothing is open — records that we asked for a public review.

**`POST /admin/feedback/{id}/review-request` refuses while a complaint is open, and
there is no override parameter.** Doc 07 puts "resolve material complaints" at step 2
and "ask for a public review" at step 3, and an override flag is how step 2 quietly
becomes optional on a busy Tuesday. If the complaint really is settled, somebody
records the resolution — which is the work the ordering existed to force.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.deps import SessionDep, require_roles
from api.domain.advocacy import (
    CURRENT_TERMS,
    Complaint,
    Feedback,
    ResolutionState as DomainResolution,
    generate_referral_code,
    normalise_code,
    review_request_blockers,
)
from api.models.advocacy import (
    FeedbackComplaint,
    Referral,
    ReferralAttribution,
    ResolutionState,
    ReviewPlatform,
    ReviewRequest,
    TripFeedback,
)
from api.models.reservations import Reservation
from api.models.staff import SALES_ROLES, StaffUser
from api.schemas import (
    ComplaintOut,
    ComplaintResolutionIn,
    FeedbackIn,
    FeedbackOut,
    FeedbackReviewOut,
    ReferralOut,
    ReviewRequestIn,
    ReviewRequestOut,
)

router = APIRouter(tags=["advocacy"])

AdvocacyStaff = Annotated[
    StaffUser, Depends(require_roles(SALES_ROLES, "working post-trip feedback"))
]

#: The seven columns that carry a 1-5 rating, in doc 05's order.
RATING_COLUMNS = (
    "sales_promise_accuracy",
    "preparation",
    "pickup_and_transport",
    "accommodation",
    "coordinator_support",
    "route_communication",
    "spiritual_and_cultural",
)


def _ratings(row: TripFeedback) -> dict[str, int]:
    """Only the answered ones. A missing key is unanswered, never a low score."""
    return {c: getattr(row, c) for c in RATING_COLUMNS if getattr(row, c) is not None}


def _as_domain(row: TripFeedback) -> Feedback:
    return Feedback(
        ratings=_ratings(row),
        recommend_score=row.recommend_score,
        what_went_wrong=row.what_went_wrong,
        what_went_well=row.what_went_well,
    )


def _domain_complaints(rows: list[FeedbackComplaint]) -> list[Complaint]:
    return [
        Complaint(
            dimension=c.dimension,
            rating=c.rating,
            detail=c.detail,
            state=DomainResolution(c.resolution_state.value),
        )
        for c in rows
    ]


# ------------------------------------------------------------------- traveller


@router.post("/feedback", response_model=FeedbackOut)
async def submit_feedback(
    payload: FeedbackIn, session: SessionDep, token: str = Query(min_length=20)
):
    """Submit the private post-trip form.

    Private is a promise, not a description: nothing submitted here is published
    anywhere. Doc 07's whole sequence rests on somebody telling us about a problem
    before they tell the internet, and that bargain only works if we keep our half.

    Complaints are opened automatically from the answers rather than waiting for a
    coordinator to read the form. A 1-star on accommodation that nobody notices for
    three weeks is the same as no feedback at all.
    """
    row = await session.scalar(
        select(TripFeedback)
        .options(selectinload(TripFeedback.complaints))
        .where(TripFeedback.token == token)
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")
    if row.submitted_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You have already sent this. If something has changed since, please "
            "write to us directly rather than filling the form again.",
        )

    for column in RATING_COLUMNS:
        setattr(row, column, getattr(payload, column))
    row.recommend_score = payload.recommend_score
    row.what_went_well = payload.what_went_well
    row.what_went_wrong = payload.what_went_wrong
    row.submitted_by = payload.submitted_by
    row.submitted_at = datetime.now(UTC)

    from api.domain.advocacy import material_complaints

    found = material_complaints(_as_domain(row))
    for complaint in found:
        session.add(
            FeedbackComplaint(
                feedback_id=row.id,
                dimension=complaint.dimension,
                rating=complaint.rating,
                detail=complaint.detail,
                resolution_state=ResolutionState.OPEN,
            )
        )

    await session.commit()

    return FeedbackOut(
        submitted_at=row.submitted_at,
        will_follow_up=bool(found),
        message=(
            "Thank you. Somebody will call you about what went wrong — we would"
            " rather hear it from you than read it later."
            if found
            else "Thank you. This goes to the three of us and nowhere else."
        ),
    )


# ----------------------------------------------------------------------- staff


@router.get("/admin/feedback", response_model=list[FeedbackReviewOut])
async def list_feedback(
    session: SessionDep,
    staff: AdvocacyStaff,
    only_open_complaints: bool = False,
    limit: int = 50,
):
    """Submitted feedback, with the review gate evaluated for each.

    `review_request_blockers` is computed per row rather than stored, so it can never
    be stale against a complaint somebody resolved a minute ago.
    """
    rows = list(
        await session.scalars(
            select(TripFeedback)
            .options(
                selectinload(TripFeedback.complaints),
                selectinload(TripFeedback.review_requests),
            )
            .where(TripFeedback.submitted_at.isnot(None))
            .order_by(TripFeedback.submitted_at.desc())
            .limit(limit)
        )
    )

    out: list[FeedbackReviewOut] = []
    for row in rows:
        complaints = _domain_complaints(row.complaints)
        open_count = sum(1 for c in complaints if c.is_open)
        if only_open_complaints and open_count == 0:
            continue
        already = any(r.asked_at is not None for r in row.review_requests)
        reservation = await session.get(Reservation, row.reservation_id)
        out.append(
            FeedbackReviewOut(
                id=row.id,
                reservation_id=row.reservation_id,
                reservation_reference=reservation.reference if reservation else None,
                submitted_at=row.submitted_at,
                submitted_by=row.submitted_by,
                recommend_score=row.recommend_score,
                what_went_well=row.what_went_well,
                what_went_wrong=row.what_went_wrong,
                ratings=_ratings(row),
                complaints=[ComplaintOut.model_validate(c) for c in row.complaints],
                open_complaint_count=open_count,
                already_asked=already,
                review_request_blockers=review_request_blockers(
                    _as_domain(row), complaints, already_asked=already
                ),
            )
        )
    return out


@router.post("/admin/complaints/{complaint_id}/resolve", response_model=ComplaintOut)
async def resolve_complaint(
    complaint_id: int,
    payload: ComplaintResolutionIn,
    session: SessionDep,
    staff: AdvocacyStaff,
):
    """Record what was actually done about a complaint.

    The note is required — schema, domain and a database check all insist. Three
    layers for one rule, because this note is the only evidence that step 2 of doc
    07's sequence happened at all, and the review gate opens on the strength of it.
    """
    complaint = await session.get(FeedbackComplaint, complaint_id)
    if complaint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found.")

    complaint.resolution_state = ResolutionState(payload.state)
    complaint.resolution_note = payload.resolution_note
    complaint.resolved_by = staff.email or staff.id
    complaint.resolved_at = datetime.now(UTC)
    await session.commit()
    return ComplaintOut.model_validate(complaint)


@router.post(
    "/admin/feedback/{feedback_id}/review-request", response_model=ReviewRequestOut
)
async def request_review(
    feedback_id: int,
    payload: ReviewRequestIn,
    session: SessionDep,
    staff: AdvocacyStaff,
):
    """Record that we asked this traveller for a public review.

    Refuses with 409 and the full list of reasons while the gate is shut. There is
    no `force` parameter and there should not be one: asking somebody for a public
    review while their complaint is open is how a private, fixable problem becomes a
    permanent public one.

    We record the ask and the permissions. We do not store suggested wording — doc 07
    step 4 says "without scripting false praise", and a `draft_text` column is how
    that rule quietly dies.
    """
    row = await session.scalar(
        select(TripFeedback)
        .options(
            selectinload(TripFeedback.complaints),
            selectinload(TripFeedback.review_requests),
        )
        .where(TripFeedback.id == feedback_id)
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found.")

    already = any(r.asked_at is not None for r in row.review_requests)
    blockers = review_request_blockers(
        _as_domain(row), _domain_complaints(row.complaints), already_asked=already
    )
    if blockers:
        raise HTTPException(status.HTTP_409_CONFLICT, " ".join(blockers))

    request_row = ReviewRequest(
        feedback_id=row.id,
        platform=ReviewPlatform(payload.platform),
        asked_at=datetime.now(UTC),
        asked_by=staff.email or staff.id,
        may_publish_written_review=payload.may_publish_written_review,
        may_publish_images=payload.may_publish_images,
        may_publish_story=payload.may_publish_story,
        permission_note=payload.permission_note,
    )
    session.add(request_row)
    await session.commit()
    await session.refresh(request_row)
    return ReviewRequestOut.model_validate(request_row)


# ------------------------------------------------------------------- referrals


def _share_text(code: str, referrer: str | None) -> str:
    """What the referrer sends on.

    No superlatives, no star rating, no "I had an amazing time" — doc 07 forbids
    scripting praise, and that applies as much to a referral message as to a review.
    This says who sent it and what it is, and leaves the recommending to them.
    """
    who = f"{referrer} " if referrer else ""
    return (
        f"{who}thought this might be useful if you are thinking about Adi Kailash."
        f" Mention {code} when you write to them, so they know where you came from."
    )


@router.post("/admin/reservations/{reservation_id}/referral", response_model=ReferralOut)
async def issue_referral(reservation_id: int, session: SessionDep, staff: AdvocacyStaff):
    """Issue (or return) a referral code for a traveller.

    Idempotent: calling twice returns the same code rather than minting a second one,
    because a traveller with two live codes has one that silently stops attributing.
    """
    reservation = await session.get(Reservation, reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found.")

    existing = await session.scalar(
        select(Referral).where(
            Referral.reservation_id == reservation_id, Referral.is_active.is_(True)
        )
    )
    if existing is not None:
        return await _referral_out(session, existing)

    await session.refresh(reservation, ["travellers"])
    lead_name = next(
        (t.full_name for t in reservation.travellers if t.role.value == "group_lead"),
        None,
    )

    referral = Referral(
        reservation_id=reservation_id,
        code=generate_referral_code(lead_name),
        referrer_name=lead_name,
        terms_version=CURRENT_TERMS.version,
        benefit=CURRENT_TERMS.benefit,
    )
    session.add(referral)
    await session.commit()
    await session.refresh(referral)
    return await _referral_out(session, referral)


async def _referral_out(session, referral: Referral) -> ReferralOut:
    from sqlalchemy import func

    used = (
        await session.scalar(
            select(func.count())
            .select_from(ReferralAttribution)
            .where(
                ReferralAttribution.referral_id == referral.id,
                ReferralAttribution.matched.is_(True),
            )
        )
    ) or 0
    return ReferralOut(
        code=referral.code,
        referrer_name=referral.referrer_name,
        terms_version=referral.terms_version,
        benefit=referral.benefit,
        is_active=referral.is_active,
        times_used=used,
        share_text=_share_text(referral.code, referral.referrer_name),
        terms=list(CURRENT_TERMS.restrictions),
    )


async def attribute_referral(session, lead_id: int, raw_code: str) -> bool:
    """Record that a lead arrived with a code. Returns whether it matched.

    An unrecognised code is still recorded. Somebody mistyped, or the code was
    revoked, and either way a coordinator seeing "they mentioned MEE-K4T9P" can find
    the right traveller and thank them. Discarding it because a foreign key would not
    resolve throws away the only trace of a referral that actually happened.
    """
    from sqlalchemy import func

    normalised = normalise_code(raw_code)
    # Matched on the normalised form in SQL. The stored code carries a hyphen and
    # the person typing it read it off a WhatsApp message — case, spaces and the
    # hyphen are all things they will get wrong, and none of them should produce
    # "invalid code" for a referral that is perfectly real.
    matched = await session.scalar(
        select(Referral).where(
            Referral.is_active.is_(True),
            func.upper(func.regexp_replace(Referral.code, r"[^A-Za-z0-9]", "", "g"))
            == normalised,
        )
    )

    session.add(
        ReferralAttribution(
            lead_id=lead_id,
            referral_id=matched.id if matched else None,
            raw_code=raw_code[:40],
            matched=matched is not None,
        )
    )
    return matched is not None
