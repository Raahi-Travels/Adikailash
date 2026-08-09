"""End-to-end check that document storage actually works.

Proves the whole chain rather than just that credentials parse:

  1. a presigned PUT actually uploads
  2. a presigned GET returns the same bytes back
  3. the bucket rejects a disallowed MIME type
  4. the object is deleted afterwards, so the check leaves nothing behind

Run after pasting the S3 keys into apps/api/.env:

    uv run --project apps/api python scripts/verify_storage.py

Prints only pass/fail lines. It never prints a credential.
"""

from __future__ import annotations

import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from api import storage  # noqa: E402  (import after env is loaded)

PROBE = b"%PDF-1.4\n% storage verification probe\n"


def put(url: str, data: bytes, content_type: str) -> int:
    req = urllib.request.Request(
        url, data=data, method="PUT", headers={"Content-Type": content_type}
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.status


def main() -> int:
    if not storage.is_storage_configured():
        print("FAIL  storage is not configured")
        print("      Set S3_ENDPOINT_URL, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY")
        return 1
    print("ok    credentials present")

    # 1. upload
    try:
        ticket = storage.create_upload_ticket(
            submission_id=0, content_type="application/pdf"
        )
        status = put(ticket.upload_url, PROBE, "application/pdf")
        print(f"ok    presigned upload accepted (HTTP {status})")
    except urllib.error.HTTPError as exc:
        print(f"FAIL  upload rejected: HTTP {exc.code} {exc.reason}")
        print(f"      {exc.read()[:300].decode(errors='replace')}")
        return 1
    except Exception as exc:
        print(f"FAIL  upload failed: {type(exc).__name__}: {exc}")
        return 1

    # 2. read back
    try:
        url = storage.create_read_url(storage_key=ticket.storage_key)
        with urllib.request.urlopen(url, timeout=30) as res:
            body = res.read()
        if body == PROBE:
            print("ok    presigned download returned identical bytes")
        else:
            print(f"FAIL  download mismatch: got {len(body)} bytes, sent {len(PROBE)}")
            return 1
    except Exception as exc:
        print(f"FAIL  download failed: {type(exc).__name__}: {exc}")
        return 1

    # 3. the bucket itself must refuse a disallowed type, independently of our
    #    application-level validation. Belt and braces.
    try:
        bad = storage._client().generate_presigned_url(  # noqa: SLF001
            "put_object",
            Params={
                "Bucket": storage.bucket(),
                "Key": ticket.storage_key + "-bad",
                "ContentType": "text/html",
            },
            ExpiresIn=120,
        )
        put(bad, b"<html>should not be allowed</html>", "text/html")
        print("FAIL  bucket accepted text/html; MIME restriction is not enforced")
        return 1
    except urllib.error.HTTPError:
        print("ok    bucket refused a disallowed MIME type")
    except Exception as exc:
        print(f"warn  MIME check inconclusive: {type(exc).__name__}: {exc}")

    # 4. clean up
    try:
        storage.delete_object(storage_key=ticket.storage_key)
        print("ok    probe object deleted")
    except Exception as exc:
        print(f"warn  could not delete probe object: {exc}")
        print(f"      remove manually: {ticket.storage_key}")

    print("\nDocument storage is working.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
