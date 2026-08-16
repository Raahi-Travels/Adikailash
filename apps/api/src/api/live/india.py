"""Fetching from an Indian address, when this host is not one.

Two of the five live sources are Indian government portals that answer an Indian IP
and refuse ours. Measured on 17 Aug 2026: `mis.pwduk.in` returns **403** from the
Hostinger VPS in Kuala Lumpur and **200** from Vercel's Mumbai region, and
`ilppithoragarh.uk.gov.in` will not complete a connection from Kuala Lumpur at all.
Same result from a browser User-Agent and from ours, so the block is on the address.

`apps/web/app/api/india-fetch/[source]/route.ts` is a function pinned to Mumbai that
mirrors three fixed pages. This module asks it for one of them.

**There is no secret and nothing to configure.** The relay accepts no caller-supplied
URL, only one of three fixed names, so there is nothing to abuse it for and therefore
nothing to protect. An earlier version took `?url=` against an allowlist, which is a
proxy, and a proxy needs a shared secret in two places, one of which needed dashboard
access to set. Removing the parameter removed the secret, the configuration and the
handover step together.

`INDIA_FETCH_URL` still exists as an override, for a preview deployment or a move to
a different host, but the default is the real one and it works unset.

**A relay failure falls back to direct.** Not because direct is likely to work in
production, but because the relay is one more thing that can be down, and the right
answer to that is to try the origin rather than to report a source as unreachable
when it might not be.
"""

from __future__ import annotations

import logging

import httpx

from api.config import get_settings

logger = logging.getLogger(__name__)

#: The deployed relay. A default rather than a required setting: it is a public URL
#: with no credential in it, and making it mandatory would mean the feature silently
#: does nothing on any deployment where somebody forgot.
DEFAULT_RELAY = "https://adikailash-ten.vercel.app/api/india-fetch"

#: Origin URL to the relay's name for it. The relay holds the same mapping; both
#: sides are deliberately explicit so neither can be talked into fetching something
#: else.
SOURCE_OF: dict[str, str] = {
    "https://mis.pwduk.in/pwd/roadClosure": "road",
    "https://ilppithoragarh.uk.gov.in/": "permit",
    "https://ilppithoragarh.uk.gov.in/registeruser": "permit-registration",
}


async def get(
    url: str,
    *,
    client: httpx.AsyncClient,
    timeout: float = 45.0,
) -> httpx.Response:
    """GET a URL, through Mumbai when the relay knows about it.

    Raises what `client.get` would, so callers need no new error handling. A non-200
    from the origin is re-raised as though it had come back directly, because from
    the caller's point of view it did.
    """
    settings = get_settings()
    relay = (settings.india_fetch_url or DEFAULT_RELAY).rstrip("/")
    source = SOURCE_OF.get(url)

    # A URL the relay does not mirror goes straight to the origin. Better than
    # failing: most sources are not blocked and should not pay for this at all.
    if not source or not relay:
        return await client.get(url, timeout=timeout)

    try:
        response = await client.get(f"{relay}/{source}", timeout=timeout + 15)
    except httpx.HTTPError as exc:
        logger.warning("India relay unreachable for %s (%s), trying direct", url, exc)
        return await client.get(url, timeout=timeout)

    if response.status_code != 200:
        logger.warning(
            "India relay answered %s for %s, trying direct", response.status_code, url
        )
        return await client.get(url, timeout=timeout)

    upstream = response.headers.get("x-upstream-status")
    if upstream and upstream != "200":
        # The relay worked; the portal did not. Surfaced as the portal's own status
        # so an existing `raise_for_status` behaves the same either way.
        logger.warning("%s answered %s through the relay", url, upstream)
        raise httpx.HTTPStatusError(
            f"{url} returned {upstream}",
            request=response.request,
            response=httpx.Response(int(upstream), request=response.request),
        )

    return response
