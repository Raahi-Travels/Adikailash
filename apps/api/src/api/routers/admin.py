"""Authenticated staff endpoints.

Three rules from doc 09 shape every handler:

  - "High-stakes state changes and waivers are attributable." Actor comes from the
    session, never from the request body — a caller cannot claim to be someone else.
  - "Only authorised roles may publish a verified status."
  - Uploading is not approval; acceptance requires a named reviewer.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import desc, select

from api.deps import SessionDep, StaffDep, require_roles
from api.domain.departures import (
    DepartureState,
    IllegalTransition,
    allowed_transitions,
    transition,
)
from api.domain.status import Access, PublicationStage, SourceType
from api.localization import resolve
from api.models.catalogue import Destination, Journey, JourneyFamily
from api.models.documents import (
    DocumentAccessLog,
    DocumentRequirement,
    DocumentState,
    DocumentSubmission,
)
from api.models.operations import Departure, DepartureStateChange, RouteSegment, StatusUpdate
from api.models.staff import (
    CONTENT_ROLES,
    DEPARTURE_LIFECYCLE_ROLES,
    DOCUMENT_REVIEW_ROLES,
    STATUS_PUBLISHING_ROLES,
    StaffUser,
)
from api.models.weather import WeatherCondition, WeatherSnapshot, WeatherSource
from api.schemas import (
    DepartureTransitionIn,
    DocumentReviewIn,
    JourneyIn,
    JourneySummaryOut,
    StatusPublishIn,
    UploadTicketOut,
    WeatherPublishIn,
)
from api.storage import MAX_DOCUMENT_BYTES, ACCEPTED_DOCUMENT_TYPES, create_upload_ticket

router = APIRouter(prefix="/admin", tags=["admin"])

ContentStaff = Annotated[StaffUser, Depends(require_roles(CONTENT_ROLES, "editing content"))]
OpsStaff = Annotated[
    StaffUser, Depends(require_roles(DEPARTURE_LIFECYCLE_ROLES, "changing departure state"))
]
PublisherStaff = Annotated[
    StaffUser, Depends(require_roles(STATUS_PUBLISHING_ROLES, "publishing verified status"))
]
ReviewerStaff = Annotated[
    StaffUser, Depends(require_roles(DOCUMENT_REVIEW_ROLES, "reviewing traveller documents"))
]


def _actor(staff: StaffUser) -> str:
    """Attribution string. Taken from the session, never from user input."""
    return f"{staff.name} <{staff.email}>"


# --------------------------------------------------------------------------- content


@router.get("/journeys", response_model=list[JourneySummaryOut])
async def list_all_journeys(session: SessionDep, staff: ContentStaff, locale: str = "en"):
    """Every journey including drafts — the admin's view, unlike the public list."""
    rows = await session.scalars(select(Journey).order_by(Journey.id))
    return [
        JourneySummaryOut(
            id=j.id,
            slug=j.slug,
            name=resolve(j.name, locale) or j.slug,
            essence=resolve(j.essence, locale),
            family=j.family.value,
            gateway=j.gateway,
            duration_nights=j.duration_nights,
            highest_altitude_m=j.highest_altitude_m,
            is_published=j.is_published,
        )
        for j in rows
    ]


@router.post("/journeys", response_model=JourneySummaryOut, status_code=201)
async def create_journey(payload: JourneyIn, session: SessionDep, staff: ContentStaff):
    existing = await session.scalar(select(Journey).where(Journey.slug == payload.slug))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That slug is already in use.")
    try:
        family = JourneyFamily(payload.family)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown journey family.")

    journey = Journey(
        slug=payload.slug,
        name=payload.name.to_jsonb(),
        essence=payload.essence.to_jsonb() if payload.essence else None,
        family=family,
        gateway=payload.gateway,
        duration_nights=payload.duration_nights,
        highest_altitude_m=payload.highest_altitude_m,
        is_published=payload.is_published,
        last_reviewed_at=datetime.now(UTC).date().isoformat(),
        last_reviewed_by=_actor(staff),
    )
    session.add(journey)
    await session.commit()
    return JourneySummaryOut(
        id=journey.id,
        slug=journey.slug,
        name=payload.name.en,
        essence=payload.essence.en if payload.essence else None,
        family=family.value,
        gateway=journey.gateway,
        duration_nights=journey.duration_nights,
        highest_altitude_m=journey.highest_altitude_m,
        is_published=journey.is_published,
    )


@router.patch("/journeys/{journey_id}", response_model=JourneySummaryOut)
async def update_journey(
    journey_id: int, payload: JourneyIn, session: SessionDep, staff: ContentStaff
):
    journey = await session.get(Journey, journey_id)
    if journey is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journey not found.")

    # Publishing requires approved facts. The database enforces this too; failing
    # here gives the editor a readable reason instead of a constraint violation.
    if payload.is_published and (payload.essence is None or payload.duration_nights is None):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A published journey needs an essence and a duration. "
            "Approved facts are still missing (decision O6).",
        )

    journey.name = payload.name.to_jsonb()
    journey.essence = payload.essence.to_jsonb() if payload.essence else None
    journey.family = JourneyFamily(payload.family)
    journey.gateway = payload.gateway
    journey.duration_nights = payload.duration_nights
    journey.highest_altitude_m = payload.highest_altitude_m
    journey.is_published = payload.is_published
    journey.last_reviewed_at = datetime.now(UTC).date().isoformat()
    journey.last_reviewed_by = _actor(staff)

    await session.commit()
    return JourneySummaryOut(
        id=journey.id,
        slug=journey.slug,
        name=payload.name.en,
        essence=payload.essence.en if payload.essence else None,
        family=journey.family.value,
        gateway=journey.gateway,
        duration_nights=journey.duration_nights,
        highest_altitude_m=journey.highest_altitude_m,
        is_published=journey.is_published,
    )


# ------------------------------------------------------------------------ departures


@router.get("/departures/{departure_id}/transitions")
async def get_allowed_transitions(departure_id: int, session: SessionDep, staff: OpsStaff):
    """What this departure may legally become next.

    Surfacing this lets the admin offer only valid moves rather than presenting every
    state and rejecting most of them.
    """
    departure = await session.get(Departure, departure_id)
    if departure is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Departure not found.")
    return {
        "current": departure.state.value,
        "allowed": sorted(s.value for s in allowed_transitions(departure.state)),
    }


@router.post("/departures/{departure_id}/transition")
async def transition_departure(
    departure_id: int,
    payload: DepartureTransitionIn,
    session: SessionDep,
    staff: OpsStaff,
):
    """Move a departure, recording who and why.

    The actor is the signed-in user. A reason is mandatory at three layers: the
    request schema, the domain function, and a NOT NULL column.
    """
    departure = await session.get(Departure, departure_id)
    if departure is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Departure not found.")

    try:
        target = DepartureState(payload.target_state)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown state.")

    try:
        change = transition(
            departure_id=str(departure.id),
            current=departure.state,
            target=target,
            actor=_actor(staff),
            reason=payload.reason,
        )
    except IllegalTransition as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))

    previous = departure.state
    departure.state = target
    departure.state_changed_at = datetime.now(UTC)
    departure.state_changed_by = change.actor
    departure.state_change_reason = change.reason

    session.add(
        DepartureStateChange(
            departure_id=departure.id,
            previous_state=previous,
            new_state=target,
            actor=change.actor,
            reason=change.reason,
        )
    )
    await session.commit()
    return {"id": departure.id, "state": target.value, "actor": change.actor}


# ---------------------------------------------------------------------------- status


@router.post("/status", status_code=201)
async def publish_status(
    payload: StatusPublishIn, session: SessionDep, staff: PublisherStaff
):
    """Publish a verified route status.

    `valid_for_hours` is required rather than defaulted silently: the publisher is
    committing to re-check by a specific time, and that commitment is what makes the
    staleness rendering honest.
    """
    segment = await session.scalar(
        select(RouteSegment).where(RouteSegment.slug == payload.route_segment_slug)
    )
    if segment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Route segment not found.")

    try:
        access = Access(payload.access)
        source = SourceType(payload.source)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown access or source.")

    now = datetime.now(UTC)
    update = StatusUpdate(
        route_segment_id=segment.id,
        access=access,
        stage=PublicationStage.PUBLISHED,
        source=source,
        verified_by=_actor(staff),
        verified_at=now,
        next_verification_due=now + timedelta(hours=payload.valid_for_hours),
        summary=payload.summary.to_jsonb(),
    )
    session.add(update)
    await session.commit()
    return {
        "id": update.id,
        "segment": segment.slug,
        "access": access.value,
        "verified_by": update.verified_by,
        "next_verification_due": update.next_verification_due.isoformat(),
    }


@router.post("/weather", status_code=201)
async def publish_weather(
    payload: WeatherPublishIn, session: SessionDep, staff: PublisherStaff
):
    """Record a weather observation.

    `is_field_verified` may only be set by someone who actually saw the conditions;
    the model requires an observer name when it is true, so an API pull cannot
    masquerade as a person on the pass.
    """
    if not payload.destination_slug and not payload.route_segment_slug:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A destination or route segment is required.",
        )

    destination_id = None
    segment_id = None
    if payload.destination_slug:
        d = await session.scalar(
            select(Destination).where(Destination.slug == payload.destination_slug)
        )
        if d is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Destination not found.")
        destination_id = d.id
    if payload.route_segment_slug:
        s = await session.scalar(
            select(RouteSegment).where(RouteSegment.slug == payload.route_segment_slug)
        )
        if s is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Route segment not found.")
        segment_id = s.id

    try:
        condition = WeatherCondition(payload.condition)
        source = WeatherSource(payload.source)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown condition or source."
        )

    now = datetime.now(UTC)
    snapshot = WeatherSnapshot(
        destination_id=destination_id,
        route_segment_id=segment_id,
        condition=condition,
        temp_min_c=payload.temp_min_c,
        temp_max_c=payload.temp_max_c,
        wind_kph=payload.wind_kph,
        snow_depth_cm=payload.snow_depth_cm,
        advisory=payload.advisory.to_jsonb() if payload.advisory else None,
        source=source,
        is_field_verified=payload.is_field_verified,
        observed_by=_actor(staff) if payload.is_field_verified else None,
        observed_at=now,
        next_update_due=now + timedelta(hours=payload.valid_for_hours),
    )
    session.add(snapshot)
    await session.commit()
    return {"id": snapshot.id, "condition": condition.value}


# -------------------------------------------------------------------------- documents


@router.post("/documents/{submission_id}/upload-ticket", response_model=UploadTicketOut)
async def issue_upload_ticket(
    submission_id: int, session: SessionDep, staff: ReviewerStaff
):
    """Issue a short-lived signed upload URL.

    The client never learns a durable storage path. Doc 08: "Do not expose raw
    document locations directly to public clients."
    """
    submission = await session.get(DocumentSubmission, submission_id)
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found.")

    ticket = create_upload_ticket(submission_id=submission.id)
    submission.storage_key = ticket.storage_key
    submission.state = DocumentState.AWAITING_UPLOAD
    await session.commit()

    return UploadTicketOut(
        submission_id=submission.id,
        upload_url=ticket.upload_url,
        expires_at=ticket.expires_at,
        max_bytes=MAX_DOCUMENT_BYTES,
        accepted_content_types=list(ACCEPTED_DOCUMENT_TYPES),
    )


@router.post("/documents/{submission_id}/review")
async def review_document(
    submission_id: int,
    payload: DocumentReviewIn,
    request: Request,
    session: SessionDep,
    staff: ReviewerStaff,
):
    """Accept, request correction, or waive — always with a named reviewer.

    Doc 05: "The portal does not label a document as approved merely because it was
    uploaded." Every branch here records who decided and, where relevant, why.
    """
    submission = await session.get(DocumentSubmission, submission_id)
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found.")

    now = datetime.now(UTC)
    actor = _actor(staff)

    if payload.decision == "accept":
        if submission.storage_key is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Nothing has been uploaded for this requirement yet.",
            )
        submission.state = DocumentState.ACCEPTED
        submission.reviewed_by = actor
        submission.reviewed_at = now
        submission.valid_until = payload.valid_until
        submission.correction_reason = None

    elif payload.decision == "request_correction":
        if payload.correction_reason is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "A correction needs a reason the traveller can act on.",
            )
        submission.state = DocumentState.NEEDS_CORRECTION
        submission.reviewed_by = actor
        submission.reviewed_at = now
        submission.correction_reason = payload.correction_reason.to_jsonb()

    else:  # waive
        if not payload.waiver_reason:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "A waiver needs a recorded reason."
            )
        submission.state = DocumentState.WAIVED
        submission.waived_by = actor
        submission.waiver_reason = payload.waiver_reason

    session.add(
        DocumentAccessLog(
            submission_id=submission.id,
            staff_user_id=staff.id,
            action=f"review:{payload.decision}",
            ip_address=request.client.host if request.client else None,
        )
    )
    await session.commit()
    return {"id": submission.id, "state": submission.state.value, "reviewed_by": actor}


@router.get("/documents/pending")
async def pending_documents(session: SessionDep, staff: ReviewerStaff, locale: str = "en"):
    """Submissions awaiting a decision — doc 06's "critical missing documents" view."""
    rows = await session.scalars(
        select(DocumentSubmission)
        .where(
            DocumentSubmission.state.in_(
                [DocumentState.UPLOADED, DocumentState.UNDER_REVIEW]
            )
        )
        .order_by(desc(DocumentSubmission.uploaded_at))
    )
    out = []
    for s in rows:
        req = await session.get(DocumentRequirement, s.requirement_id)
        out.append(
            {
                "id": s.id,
                "requirement": resolve(req.label, locale) if req else None,
                "traveller_name": s.traveller_name,
                "state": s.state.value,
                "uploaded_at": s.uploaded_at.isoformat() if s.uploaded_at else None,
            }
        )
    return out
