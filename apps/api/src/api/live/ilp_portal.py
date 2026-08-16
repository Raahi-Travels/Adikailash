"""Whether the Inner Line Permit portal is issuing.

This is the single highest-value live datum on the site. If permits are not being
issued, nothing else about a journey matters, and the portal says so on its front
page in plain language. As of 17 Aug 2026 it reads, verbatim:

    Official Notice: Adi Kailash & Om Parvat Yatra Suspended. In view of the onset of
    the monsoon and prevailing heavy rainfall in the Himalayan region, issuance of
    Inner Line Permits (ILPs) for Adi Kailash and Om Parvat Yatra is hereby suspended
    until further orders.

**There is no API.** `/api` returns 404 and `/api/user` returns 500, so this reads the
public pages. Two independent signals, because either alone can mislead: the banner
text on the homepage, and whether `/registeruser` still serves a registration form.
A homepage can carry a stale notice after issuing resumes, and a registration page
can be down for maintenance while permits are still being issued at the counter.
When the two disagree we report uncertain rather than picking one.

**Suspension is not always about weather.** The portal closed for a week in October
2025 for an ultra marathon at Adi Kailash. So the reason is captured verbatim rather
than being classified, and the site quotes it rather than paraphrasing.

Two facts worth keeping next to this. The permit is obtained at Dharchula or
Pithoragarh, but the Inner Line is crossed at **Chiyalekh**; and the widespread claim
that the ILP is in-person only is out of date. Both live in the permit guide.
"""

from __future__ import annotations

import html
import logging
import re
import ssl
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

from api.live.india import get as india_get

logger = logging.getLogger(__name__)

PORTAL = "https://ilppithoragarh.uk.gov.in"


def _legacy_tls_context() -> ssl.SSLContext:
    """An SSL context this NIC server will actually talk to.

    The portal negotiates TLS in a way OpenSSL 3 refuses by default, failing with
    `UNSAFE_LEGACY_RENEGOTIATION_DISABLED`. curl still connects, which is why the
    endpoint looks fine when probed by hand and then fails from Python.

    The flag is narrowed as far as it goes: certificate verification and hostname
    checking both stay **on**, so this is not a blanket "trust anything" context. It
    permits one specific handshake behaviour on one government host that has not
    updated its TLS stack. Reaching for `verify=False` here would have been the
    quick fix and would have turned a scraping problem into a security one.
    """
    context = ssl.create_default_context()
    context.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
    return context

#: Words that, in the portal's own notices, mean permits are not being issued.
_SUSPENDED = re.compile(r"\b(suspend\w*|closed until|not being issued)\b", re.I)

#: The notice block. Anchored on the portal's own heading rather than on a CSS class,
#: because a Laravel template's classes change more often than its wording.
_NOTICE = re.compile(r"(Official Notice.{0,600}?)(?:\.\s|$)", re.I | re.S)


@dataclass(frozen=True)
class PortalState:
    #: True, False, or None when the two signals disagree or the site is unreachable.
    is_issuing: bool | None
    #: The portal's own words, never our paraphrase of them.
    notice: str | None
    registration_open: bool | None
    checked_at: datetime
    #: Why we could not tell, when `is_issuing` is None.
    uncertainty: str | None = None

    @property
    def is_known(self) -> bool:
        return self.is_issuing is not None


def _text(markup: str) -> str:
    without_code = re.sub(r"<(script|style).*?</\1>", " ", markup, flags=re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", without_code)))


async def fetch(*, client: httpx.AsyncClient | None = None) -> PortalState:
    now = datetime.now(UTC)
    owned = client is None
    http = client or httpx.AsyncClient(
        timeout=20,
        follow_redirects=False,
        headers={"User-Agent": "adikailash-status/1"},
        verify=_legacy_tls_context(),
    )

    notice: str | None = None
    banner_says_suspended: bool | None = None
    registration_open: bool | None = None

    try:
        try:
            home = await india_get(f"{PORTAL}/", client=http)
            home.raise_for_status()
            text = _text(home.text)
            match = _NOTICE.search(text)
            if match:
                notice = match.group(1).strip()[:500]
            banner_says_suspended = bool(_SUSPENDED.search(notice or text))
        except httpx.HTTPError as exc:
            logger.warning("ILP portal homepage unreachable: %s", exc)

        try:
            register = await india_get(f"{PORTAL}/registeruser", client=http)
            # A redirect away from the registration form, or an explicit refusal in
            # the body, both mean the same thing to a traveller: they cannot start.
            if register.status_code in (301, 302, 303, 307, 308):
                registration_open = False
            elif register.status_code == 200:
                registration_open = "registration disabled" not in _text(
                    register.text
                ).lower()
        except httpx.HTTPError as exc:
            logger.warning("ILP registration page unreachable: %s", exc)
    finally:
        if owned:
            await http.aclose()

    if banner_says_suspended is None and registration_open is None:
        return PortalState(
            is_issuing=None,
            notice=None,
            registration_open=None,
            checked_at=now,
            uncertainty="The permit portal could not be reached.",
        )

    issuing_by_banner = (
        None if banner_says_suspended is None else not banner_says_suspended
    )

    # Both signals present and disagreeing. Reporting either one would be a guess
    # about which is stale, and this is the fact people plan a trip around.
    if (
        issuing_by_banner is not None
        and registration_open is not None
        and issuing_by_banner != registration_open
    ):
        return PortalState(
            is_issuing=None,
            notice=notice,
            registration_open=registration_open,
            checked_at=now,
            uncertainty=(
                "The permit portal's notice and its registration page disagree "
                "about whether permits are being issued. Please ask us before "
                "making plans."
            ),
        )

    resolved = issuing_by_banner if issuing_by_banner is not None else registration_open

    return PortalState(
        is_issuing=resolved,
        notice=notice,
        registration_open=registration_open,
        checked_at=now,
    )
