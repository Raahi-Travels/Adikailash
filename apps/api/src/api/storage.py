"""Private document storage, over Supabase Storage's S3-compatible protocol.

Doc 08's requirements for this data class: "Private object storage or secure document
service, signed time-limited access, virus and file-type checks, encryption and audit,
retention and deletion workflow."

**Why S3 access keys and not the service_role key.**

Supabase's `service_role` key bypasses RLS across the *entire* project. This project's
database is shared with the Raahi cab platform, so handing that key to the Adi Kailash
API would grant it full read/write over Raahi's passengers, trips and payments in the
`public` schema. An S3 access key is scoped to Storage and nothing else, so a
compromise of this service cannot reach another product's data.

Two rules hold everywhere in this module:

  - A storage key is never a URL and is never returned to a public client.
  - Access is granted as a short-lived presigned URL, minted per request, and logged.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

from api.config import get_settings

#: Deliberately narrow. Doc 08 requires file-type checks; anything executable or
#: scriptable is refused rather than sanitised. Mirrored on the bucket itself, so a
#: bug here is still caught by Supabase.
ACCEPTED_DOCUMENT_TYPES: tuple[str, ...] = (
    "image/jpeg",
    "image/png",
    "image/heic",
    "application/pdf",
)

#: A passport scan or medical certificate. Generous enough for a phone photo, small
#: enough to finish over a hill-town connection. Also set on the bucket.
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

#: Upload grants are short-lived: long enough to complete on a slow connection, short
#: enough that a leaked URL is not a standing key to the bucket.
UPLOAD_TICKET_TTL = timedelta(minutes=20)

#: Read grants are shorter still. A reviewer opens the file and is done.
READ_URL_TTL = timedelta(minutes=5)

def bucket() -> str:
    return get_settings().document_bucket


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


def is_storage_configured() -> bool:
    """Whether real credentials are present, placeholders excluded."""
    return get_settings().storage_configured


@lru_cache(maxsize=1)
def _client() -> Any:
    """Cached S3 client. Returns None when storage is not configured.

    Cached because botocore client construction is slow and this is on the request
    path. Credentials come from the environment only; nothing is read from disk.
    """
    if not is_storage_configured():
        return None

    import boto3
    from botocore.config import Config

    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


class StorageUnavailable(RuntimeError):
    """Raised when a storage operation is attempted before storage is configured."""


def create_upload_ticket(*, submission_id: int, content_type: str) -> UploadTicket:
    """Reserve a key and mint a presigned PUT URL.

    ``content_type`` is signed into the URL, so the ticket cannot be reused to upload
    a different kind of file than the one that was validated.
    """
    validate_upload(content_type=content_type, byte_size=None)

    client = _client()
    if client is None:
        raise StorageUnavailable(
            "Document storage is not configured. Set S3_ENDPOINT_URL, "
            "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY."
        )

    key = build_storage_key(submission_id=submission_id)
    url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket(), "Key": key, "ContentType": content_type},
        ExpiresIn=int(UPLOAD_TICKET_TTL.total_seconds()),
    )
    return UploadTicket(
        storage_key=key,
        upload_url=url,
        expires_at=datetime.now(UTC) + UPLOAD_TICKET_TTL,
    )


def create_read_url(*, storage_key: str) -> str:
    """A short-lived presigned GET URL for an authorised reviewer.

    Callers must have already checked the reviewer's role and must record the access
    in `document_access_log`. This function grants; it does not authorise.
    """
    client = _client()
    if client is None:
        raise StorageUnavailable("Document storage is not configured.")

    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket(), "Key": storage_key},
        ExpiresIn=int(READ_URL_TTL.total_seconds()),
    )


def delete_object(*, storage_key: str) -> None:
    """Remove a stored document. Used by the retention and correction workflows."""
    client = _client()
    if client is None:
        raise StorageUnavailable("Document storage is not configured.")
    client.delete_object(Bucket=bucket(), Key=storage_key)


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
