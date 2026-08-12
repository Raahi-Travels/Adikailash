"""IndexNow: tell Bing a page changed, the moment it changes.

**Why this is worth having at all.** ChatGPT search and Microsoft Copilot both
retrieve from Bing's index. Our differentiator is freshness — a route status carrying
the time a named coordinator checked it — and freshness is worthless if the index
holds a version from nine days ago. IndexNow is the only lever that turns a status
publish into near-immediate reindexing. Google does not support it; Bing, Yandex,
Seznam and Naver do, and Bing is the one that matters here.

**It is a hint, not a guarantee.** Submitting a URL does not make anything crawl,
rank or cite us. Nothing in this module should ever be described as making a page
appear anywhere.

Three deliberate constraints:

- **It never fails a request.** Publishing a verified route status is the important
  action; telling Bing about it is a courtesy. Every failure is swallowed and logged.
- **It runs in the background.** A coordinator on a phone at Dharchula waits for the
  database write, not for a round trip to Microsoft.
- **It no-ops without a key.** No key configured means no ping and a debug line, not
  a crash and not a pretence that it worked.

Setup: generate a key, set `INDEXNOW_KEY` on **both** services and
`PUBLIC_SITE_ORIGIN` on the API. The web app serves the key at
`/indexnow-key.txt`, and the submission points `keyLocation` there. Without a
reachable key file every submission is refused with a 403.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from api.config import get_settings

logger = logging.getLogger(__name__)

ENDPOINT = "https://api.indexnow.org/IndexNow"

#: IndexNow rejects batches over 10,000. We will never be near it, but a caller
#: looping over every journey should not be able to construct an invalid request.
MAX_URLS = 10_000


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.indexnow_key and settings.public_site_origin)


async def _submit(urls: list[str]) -> None:
    settings = get_settings()
    origin = settings.public_site_origin.rstrip("/")
    host = origin.split("://", 1)[-1]

    payload = {
        "host": host,
        "key": settings.indexnow_key,
        # Explicit rather than the default `<host>/<key>.txt`, so the key can live
        # in the environment instead of in a filename committed to the repository.
        "keyLocation": f"{origin}/indexnow-key.txt",
        "urlList": urls[:MAX_URLS],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(ENDPOINT, json=payload)
        # 200 accepted, 202 accepted but key validation pending. Both are fine.
        if response.status_code in (200, 202):
            logger.info("IndexNow accepted %d url(s): %s", len(urls), response.status_code)
        else:
            # 403 means the key file is missing or wrong; 422 means host mismatch.
            # Both are configuration errors worth seeing, and neither is worth an
            # exception on a path that already succeeded.
            logger.warning(
                "IndexNow refused %d url(s): %s %s",
                len(urls),
                response.status_code,
                response.text[:200],
            )
    except Exception as exc:  # noqa: BLE001 - a courtesy ping must never propagate
        logger.warning("IndexNow submission failed: %s", exc)


def submit(urls: list[str]) -> None:
    """Fire and forget. Returns immediately; never raises.

    Deliberately synchronous in signature so callers cannot accidentally await it and
    make a coordinator wait on Microsoft.
    """
    if not urls:
        return
    if not is_configured():
        logger.debug("IndexNow not configured; skipping %d url(s)", len(urls))
        return

    try:
        asyncio.get_running_loop().create_task(_submit(urls))
    except RuntimeError:
        # No loop (a script, a test). Nothing to schedule onto, and this is a hint,
        # so dropping it is correct rather than blocking to send it.
        logger.debug("No running loop; IndexNow submission skipped")


def status_urls() -> list[str]:
    """The pages a route-status change actually alters.

    Both locales, because doc 02 treats Hindi as a first-class layout rather than a
    translation, and the Hindi status page is exactly as stale as the English one.
    The home page carries the live status strip, so it changes too.
    """
    settings = get_settings()
    origin = settings.public_site_origin.rstrip("/")
    if not origin:
        return []
    return [
        f"{origin}/en/status",
        f"{origin}/hi/status",
        f"{origin}/en",
        f"{origin}/hi",
    ]


def article_urls(slug: str) -> list[str]:
    settings = get_settings()
    origin = settings.public_site_origin.rstrip("/")
    if not origin:
        return []
    return [f"{origin}/en/guides/{slug}", f"{origin}/hi/guides/{slug}"]
