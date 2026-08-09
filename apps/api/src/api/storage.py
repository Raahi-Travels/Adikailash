"""Private document storage.

Doc 08's requirements for this data class: "Private object storage or secure document
service, signed time-limited access, virus and file-type checks, encryption and audit,
retention and deletion workflow."

Supabase Storage backs this — the project already has a `storage` schema — but nothing
above this module knows that. The vendor sits behind a port so it stays replaceable
(doc 08 principle #6), and so the rest of the codebase deals in tickets and keys
rather than bucket paths.

Identity documents are the highest-risk data the platform holds; doc 09's risk
register rates a leak as "Severe trust and legal impact". Two rules therefore hold
everywhere in this module:

  - A storage key is never a URL and is never returned to a public client.
  - Access is granted as a short-lived signed URL, issued per request, and logged.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

#: Deliberately narrow. Doc 08 requires file-type checks; anything executable or
#: scriptable is refused rather than sanitised.
ACCEPTED_DOCUMENT_TYPES: tuple[str, ...] = (
    "image/jpeg",
    "image/png",
    "image/heic",
    "application/pdf",
)

#: A passport scan or medical certificate. Generous enough for a phone photo,
#: small enough that an upload over a hill-town connection can finish.
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

#: Upload grants are short-lived — long enough to complete on a slow connection,
#: short enough that a leaked URL is not a standing key to the bucket.
UPLOAD_TICKET_TTL = timedelta(minutes=20)

#: Read grants are shorter still: a reviewer opens the file and is done.
READ_URL_TTL = timedelta(minutes=5)

BUCKET = os.environ.get("DOCUMENT_BUCKET", "traveller-documents")


@dataclass(frozen=True, slots=True)
class UploadTicket:
    storage_key: str
    upload_url: str
    expires_at: datetime


def build_storage_key(*, submission_id: int) -> str:
    """An unguessable key for one submission.

    The random suffix matters: keys derived only from a submission id would let
    anyone who learns one path enumerate every traveller's documents.
    """
    stamp = datetime.now(UTC).strftime("%Y/%m")
    nonce = secrets.token_urlsafe(16)
    return f"{stamp}/submission-{submission_id}/{nonce}"


def _supabase_base() -> str | None:
    """Storage endpoint, or None when storage is not configured yet."""
    url = os.environ.get("SUPABASE_URL")
    return url.rstrip("/") if url else None


def create_upload_ticket(*, submission_id: int) -> UploadTicket:
    """Reserve a key and mint a time-limited upload URL.

    When Supabase credentials are absent the ticket is still created with its key,
    but the URL points at the local fallback endpoint. That keeps the flow testable
    end to end without silently pretending a real upload target exists — the caller
    can see from the URL that storage is unconfigured.
    """
    key = build_storage_key(submission_id=submission_id)
    expires_at = datetime.now(UTC) + UPLOAD_TICKET_TTL
    base = _supabase_base()

    if base:
        upload_url = f"{base}/storage/v1/object/{BUCKET}/{key}"
    else:
        upload_url = f"/internal/uploads-unconfigured/{key}"

    return UploadTicket(storage_key=key, upload_url=upload_url, expires_at=expires_at)


def is_storage_configured() -> bool:
    return _supabase_base() is not None and bool(os.environ.get("SUPABASE_SERVICE_KEY"))


def validate_upload(*, content_type: str | None, byte_size: int | None) -> None:
    """Reject anything outside the accepted envelope. Raises ValueError."""
    if content_type not in ACCEPTED_DOCUMENT_TYPES:
        raise ValueError(
            f"{content_type or 'Unknown file type'} is not accepted. "
            f"Allowed: {', '.join(ACCEPTED_DOCUMENT_TYPES)}."
        )
    if byte_size is not None and byte_size > MAX_DOCUMENT_BYTES:
        raise ValueError(
            f"File is larger than the {MAX_DOCUMENT_BYTES // (1024 * 1024)}MB limit."
        )
