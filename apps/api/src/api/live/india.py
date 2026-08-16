"""Fetching from an Indian address, when this host is not one.

Two of the five live sources are Indian government portals that answer an Indian IP
and refuse ours. `ilppithoragarh.uk.gov.in` does not complete a connection at all and
`mis.pwduk.in` returns 403, from a browser User-Agent and from ours alike, so the
block is on the address. The API runs on a Hostinger VPS in **Kuala Lumpur**.

`apps/web/app/api/india-fetch/route.ts` is a Vercel function pinned to Mumbai that
fetches an allowlisted URL and returns the bytes. This module routes through it when
`INDIA_FETCH_URL` is set, and goes direct otherwise, so local development is
unaffected and the whole thing disappears if the block ever lifts.

**A failure through the relay falls back to direct.** Not because direct is likely to
work in production, but because the relay is one more thing that can be down, and the
right answer to "the relay is broken" is to try the origin rather than to report the
source as unreachable when it might not be.
"""

from __future__ import annotations

import logging

import httpx

from api.config import get_settings

logger = logging.getLogger(__name__)


async def get(
    url: str,
    *,
    client: httpx.AsyncClient,
    timeout: float = 45.0,
) -> httpx.Response:
    """GET a URL, through Mumbai if this deployment is configured for it.

    Raises the same exceptions `client.get` would, so callers need no new error
    handling. The relay reports the origin's status in `x-upstream-status` and its
    own in the HTTP status, and a non-200 origin is re-raised as though it had come
    back directly, because to the caller it did.
    """
    settings = get_settings()
    relay = settings.india_fetch_url
    secret = settings.india_fetch_secret

    if not relay or not secret:
        return await client.get(url, timeout=timeout)

    try:
        response = await client.get(
            relay,
            params={"url": url},
            headers={"x-fetch-secret": secret},
            timeout=timeout + 10,
        )
    except httpx.HTTPError as exc:
        logger.warning("India relay unreachable for %s (%s), trying direct", url, exc)
        return await client.get(url, timeout=timeout)

    if response.status_code != 200:
        logger.warning(
            "India relay refused %s with %s, trying direct", url, response.status_code
        )
        return await client.get(url, timeout=timeout)

    upstream = response.headers.get("x-upstream-status")
    if upstream and upstream != "200":
        # The relay worked; the portal did not. Surfaced as the portal's own status
        # so a caller's existing `raise_for_status` behaves identically either way.
        logger.warning("%s answered %s through the relay", url, upstream)
        raise httpx.HTTPStatusError(
            f"{url} returned {upstream}",
            request=response.request,
            response=httpx.Response(int(upstream), request=response.request),
        )

    return response
