"""Traveller-facing document endpoints, reached by an access link.

Doc 05's rules shape every response here:

  - "Explain what is required and why"
  - "Show review status separately from upload status"
  - "Provide a clear correction reason"
  - "Avoid exposing internal notes"
  - "Do not claim that document acceptance guarantees a permit"

The traveller sees their own checklist and nothing else. There is no lead id in any
URL: the token resolves to the lead server-side, so nobody can walk the range and
read another family's documents.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select

from api.deps import LocaleDep, SessionDep
from api.localization import resolve
from api.models.access import TravellerAccessToken, hash_token
from api.models.documents import (
    DocumentRequirement,
    DocumentState,
    DocumentSubmission,
)
from api.domain.reservations import Readiness
from api.models.catalogue import Journey
from api.models.leads import Lead
from api.models.operations import Departure
from api.models.reservations import PaymentDirection, Reservation, TravellerRole
from api.models.staff import StaffUser
from api.schemas import (
    BookingAcceptanceOut,
    BookingPaymentOut,
    BookingTravellerOut,
    TravellerBookingOut,
    TravellerChecklistOut,
    UpdateOut,
    TravellerDocumentOut,
    UploadTicketIn,
    UploadTicketOut,
)
from api.storage import (
    ACCEPTED_DOCUMENT_TYPES,
    MAX_DOCUMENT_BYTES,
    StorageUnavailable,
    create_upload_ticket,
)

router = APIRouter(prefix="/traveller", tags=["traveller"])

#: States where the traveller still has something to do. Everything else is with us.
AWAITING_TRAVELLER = {
    DocumentState.REQUIRED,
    DocumentState.AWAITING_UPLOAD,
    DocumentState.NEEDS_CORRECTION,
    DocumentState.EXPIRED,
}


@dataclass(slots=True)
class Access:
    """What one token opens.

    A token points at a lead, a reservation, or both: a lead is issued a checklist
    before they book, and that same link keeps working once the reservation exists.
    Whichever is present decides which submissions the holder may see.
    """

    row: TravellerAccessToken
    lead: Lead | None = None
    reservation: Reservation | None = None

    @property
    def name(self) -> str | None:
        """Who we are addressing.

        The lead's name when there is one; otherwise the group lead of the
        reservation, because a walk-in booking has no lead row and the page would
        otherwise greet nobody.
        """
        if self.lead and self.lead.name:
            return self.lead.name
        if self.reservation:
            for traveller in self.reservation.travellers:
                if traveller.role is TravellerRole.GROUP_LEAD:
                    return traveller.full_name
        return None


async def _resolve(session, token: str) -> Access:
    """Exchange a token for what it opens, or 404.

    Deliberately 404 and not 403: a distinct "this link is revoked" response would
    confirm to a stranger that the token was once real.
    """
    row = await session.scalar(
        select(TravellerAccessToken).where(
            TravellerAccessToken.token_hash == hash_token(token)
        )
    )
    if row is None or not row.is_valid():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "This link is not valid. It may have expired. Please ask the team for a "
            "new one.",
        )

    lead = await session.get(Lead, row.lead_id) if row.lead_id else None
    reservation = None
    if row.reservation_id:
        reservation = await session.get(Reservation, row.reservation_id)
        if reservation is not None:
            await session.refresh(reservation, ["travellers"])
    if lead is None and reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")

    row.last_used_at = datetime.now(UTC)
    row.use_count += 1
    return Access(row=row, lead=lead, reservation=reservation)


def _owned(access: Access):
    """The filter for submissions this token may see.

    Built from the token rather than from a path parameter, which is what stops
    someone changing an id in the URL and reading another family's documents.
    """
    clauses = []
    if access.lead is not None:
        clauses.append(DocumentSubmission.lead_id == access.lead.id)
    if access.reservation is not None:
        clauses.append(DocumentSubmission.reservation_id == access.reservation.id)
    return or_(*clauses)


async def _owned_submission(session, access: Access, submission_id: int):
    submission = await session.scalar(
        select(DocumentSubmission).where(
            DocumentSubmission.id == submission_id, _owned(access)
        )
    )
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    return submission


@router.get("/documents", response_model=TravellerChecklistOut)
async def my_documents(
    session: SessionDep,
    locale: LocaleDep,
    token: str = Query(min_length=20),
):
    """The traveller's own checklist, with each item's true state."""
    access = await _resolve(session, token)

    submissions = list(
        await session.scalars(
            select(DocumentSubmission)
            .where(_owned(access))
            .order_by(DocumentSubmission.id)
        )
    )

    items: list[TravellerDocumentOut] = []
    for sub in submissions:
        req = await session.get(DocumentRequirement, sub.requirement_id)
        items.append(
            TravellerDocumentOut(
                id=sub.id,
                requirement_code=req.code if req else "",
                requirement_label=(resolve(req.label, locale) if req else "") or "",
                requirement_description=resolve(req.description, locale) if req else None,
                for_traveller=sub.traveller_name,
                is_mandatory=req.is_mandatory if req else True,
                state=sub.state.value,
                # Doc 05: uploading is not approval, and the two must not be conflated.
                is_uploaded=sub.storage_key is not None,
                is_accepted=sub.state is DocumentState.ACCEPTED,
                awaiting_you=sub.state in AWAITING_TRAVELLER,
                original_filename=sub.original_filename,
                uploaded_at=sub.uploaded_at,
                # Customer-facing reason only. internal_note is never returned.
                correction_reason=resolve(sub.correction_reason, locale),
                valid_until=sub.valid_until,
            )
        )

    await session.commit()

    return TravellerChecklistOut(
        traveller_name=access.name,
        documents=items,
        outstanding_count=sum(1 for i in items if i.awaiting_you),
        max_bytes=MAX_DOCUMENT_BYTES,
        accepted_content_types=list(ACCEPTED_DOCUMENT_TYPES),
    )


@router.post("/documents/{submission_id}/upload-ticket", response_model=UploadTicketOut)
async def request_upload(
    submission_id: int,
    payload: UploadTicketIn,
    session: SessionDep,
    token: str = Query(min_length=20),
):
    """Mint a presigned upload URL for one of the traveller's own documents.

    The submission is re-checked against what the token owns, so a valid link cannot
    be used to overwrite somebody else's file by changing the id in the URL.
    """
    access = await _resolve(session, token)
    submission = await _owned_submission(session, access, submission_id)

    if submission.state is DocumentState.ACCEPTED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This document has already been accepted. Contact the team if it needs "
            "replacing.",
        )

    try:
        ticket = create_upload_ticket(
            submission_id=submission.id, content_type=payload.content_type
        )
    except StorageUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    submission.storage_key = ticket.storage_key
    submission.original_filename = payload.original_filename
    submission.content_type = payload.content_type
    submission.state = DocumentState.AWAITING_UPLOAD
    await session.commit()

    return UploadTicketOut(
        submission_id=submission.id,
        upload_url=ticket.upload_url,
        expires_at=ticket.expires_at,
        max_bytes=MAX_DOCUMENT_BYTES,
        accepted_content_types=list(ACCEPTED_DOCUMENT_TYPES),
    )


@router.post("/documents/{submission_id}/uploaded")
async def confirm_upload(
    submission_id: int,
    session: SessionDep,
    token: str = Query(min_length=20),
):
    """Called by the browser once the presigned PUT succeeds.

    Moves the document to UPLOADED, which is a queue for review and explicitly NOT
    approval. Doc 05: "The portal does not label a document as approved merely
    because it was uploaded."
    """
    access = await _resolve(session, token)
    submission = await _owned_submission(session, access, submission_id)
    if submission.storage_key is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "No upload was started.")

    submission.state = DocumentState.UPLOADED
    submission.uploaded_at = datetime.now(UTC)
    submission.correction_reason = None
    await session.commit()

    return {
        "id": submission.id,
        "state": submission.state.value,
        "message": "Received. A member of our team will check it and let you know.",
    }


#: How each state reads to the person who is going. The second sentence is the one
#: that matters: "held" and "confirmed" are a week apart operationally and a world
#: apart emotionally, and doc 04 requires a conditional hold to be described honestly.
_STATE_COPY: dict[str, tuple[str, str]] = {
    "draft": (
        "Being prepared",
        "We are putting your plan together. Nothing is held or committed yet.",
    ),
    "proposed": (
        "Proposal sent",
        "We have sent you a plan. Nothing is held until you tell us to hold it.",
    ),
    "held": (
        "Places held, not yet confirmed",
        "We are holding places for you. This is not a confirmed booking yet, and it "
        "is refundable in full until it is confirmed. Please do not book flights on "
        "the strength of a hold.",
    ),
    "confirmed": (
        "Confirmed",
        "Your places are confirmed. The route can still change: we will tell you "
        "the moment anything does.",
    ),
    "preparing": (
        "Confirmed, getting you ready",
        "Your places are confirmed and we are collecting what the permits need.",
    ),
    "ready": (
        "Ready to travel",
        "Everything we need is in place. Nothing is outstanding from you.",
    ),
    "travelled": ("Completed", "This journey is behind you. Thank you for travelling with us."),
    "cancelled_by_traveller": (
        "Cancelled",
        "You cancelled this reservation. Any refund follows the cancellation policy "
        "you accepted.",
    ),
    "cancelled_by_us": (
        "Cancelled by us",
        "We cancelled this departure. You are entitled to a full refund or a "
        "transfer to another date, your choice.",
    ),
    "lapsed": (
        "Hold expired",
        "The hold on your places expired and they have been released. Talk to us if "
        "you still want to travel.",
    ),
}


@router.get("/booking", response_model=TravellerBookingOut)
async def my_booking(
    session: SessionDep,
    locale: LocaleDep,
    token: str = Query(min_length=20),
):
    """The traveller's own reservation: state, party, money and accepted terms.

    Nothing internal is returned. `internal_note`, the coordinator's next action and
    the loss reason all stay on the staff side; what the traveller gets is what is
    true about their booking and what is still outstanding from them.
    """
    access = await _resolve(session, token)
    if access.reservation is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "This link does not open a booking yet. If you have reserved with us and "
            "are seeing this, please tell the team.",
        )

    reservation = access.reservation
    await session.refresh(
        reservation, ["travellers", "payments", "acceptances", "updates"]
    )

    # Opening the page is the acknowledgement. Doc 09 asks for a record of what
    # customers were told; "sent" is weaker evidence than "seen", and this is the
    # only moment we can honestly claim the latter.
    now = datetime.now(UTC)
    for update in reservation.updates:
        if update.acknowledged_at is None:
            update.acknowledged_at = now

    departure = await session.get(Departure, reservation.departure_id)
    journey_name = None
    if departure:
        journey = await session.get(Journey, departure.journey_id)
        if journey:
            journey_name = resolve(journey.name, locale)

    received = Decimal("0")
    for payment in reservation.payments:
        received += (
            payment.amount
            if payment.direction is PaymentDirection.RECEIVED
            else -payment.amount
        )

    coordinator = None
    if reservation.coordinator_staff_id:
        staff = await session.get(StaffUser, reservation.coordinator_staff_id)
        coordinator = staff.name if staff else None

    outstanding_docs = sum(
        1
        for sub in await session.scalars(
            select(DocumentSubmission).where(
                DocumentSubmission.reservation_id == reservation.id
            )
        )
        if sub.state is not DocumentState.ACCEPTED
    )

    readiness = Readiness(
        documents_outstanding=outstanding_docs,
        travellers_named=len(reservation.travellers),
        travellers_expected=reservation.party_size,
        policy_accepted=any(a.policy == "terms" for a in reservation.acceptances)
        and any(a.policy == "cancellation" for a in reservation.acceptances),
        coordinator=coordinator,
        amount_due=reservation.agreed_amount,
        amount_received=received,
    )

    label, meaning = _STATE_COPY.get(
        reservation.state.value, ("In progress", "Please ask the team where this stands.")
    )

    await session.commit()

    return TravellerBookingOut(
        reference=reservation.reference,
        state=reservation.state.value,
        state_label=label,
        state_meaning=meaning,
        journey_name=journey_name,
        start_date=departure.start_date if departure else None,
        end_date=departure.end_date if departure else None,
        gateway=departure.gateway if departure else None,
        party_size=reservation.party_size,
        travellers=[
            BookingTravellerOut(
                full_name=t.full_name, role=t.role.value, is_senior=t.is_senior
            )
            for t in reservation.travellers
        ],
        coordinator=coordinator,
        amount_due=reservation.agreed_amount,
        amount_received=received,
        balance_outstanding=readiness.balance_outstanding,
        currency=reservation.currency,
        payments=[
            BookingPaymentOut(
                direction=p.direction.value,
                amount=p.amount,
                method=p.method.value,
                reference=p.reference,
                received_at=p.received_at,
            )
            for p in reservation.payments
        ],
        # Hard-coded false, not read from config: decision O8 is open and no gateway
        # exists. When one does, this becomes the single switch the portal reads.
        online_payment_available=False,
        accepted_policies=[
            BookingAcceptanceOut(
                policy=a.policy,
                version=a.version,
                accepted_by=a.accepted_by,
                accepted_at=a.accepted_at,
            )
            for a in reservation.acceptances
        ],
        documents_outstanding=outstanding_docs,
        outstanding=readiness.outstanding,
        is_ready=readiness.is_ready,
        updates=[
            UpdateOut(
                id=u.id,
                category=u.category.value,
                title=u.title,
                body=u.body,
                published_by=u.published_by,
                acknowledged_at=u.acknowledged_at,
                created_at=u.created_at,
            )
            for u in reservation.updates
        ],
    )
