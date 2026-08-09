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

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from api.deps import LocaleDep, SessionDep
from api.localization import resolve
from api.models.access import TravellerAccessToken, hash_token
from api.models.documents import (
    DocumentRequirement,
    DocumentState,
    DocumentSubmission,
)
from api.models.leads import Lead
from api.schemas import (
    TravellerChecklistOut,
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


async def _resolve_lead(session, token: str) -> tuple[Lead, TravellerAccessToken]:
    """Exchange a token for its lead, or 404.

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

    lead = await session.get(Lead, row.lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")

    row.last_used_at = datetime.now(UTC)
    row.use_count += 1
    return lead, row


@router.get("/documents", response_model=TravellerChecklistOut)
async def my_documents(
    session: SessionDep,
    locale: LocaleDep,
    token: str = Query(min_length=20),
):
    """The traveller's own checklist, with each item's true state."""
    lead, _ = await _resolve_lead(session, token)

    submissions = list(
        await session.scalars(
            select(DocumentSubmission)
            .where(DocumentSubmission.lead_id == lead.id)
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
        traveller_name=lead.name,
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

    The submission is re-checked against the token's lead, so a valid link cannot be
    used to overwrite somebody else's file by changing the id in the URL.
    """
    lead, _ = await _resolve_lead(session, token)

    submission = await session.get(DocumentSubmission, submission_id)
    if submission is None or submission.lead_id != lead.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")

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
    lead, _ = await _resolve_lead(session, token)

    submission = await session.get(DocumentSubmission, submission_id)
    if submission is None or submission.lead_id != lead.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
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
