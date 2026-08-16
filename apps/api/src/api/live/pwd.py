"""The Uttarakhand PWD road closure register.

The only machine-readable road register that covers this corridor at all, and the
caveat matters more than the data: **it does not really cover the high road.**

The BRO view holds roughly a dozen rows since January 2025. It does contain the
corridor nominally, with entries for Tawaghat to Sobla and Ghatiabagarh to Jibti, and
a row for *Gunji to Kutti to Jolingkong* whose only entry is from August 2025, over a
year old. Dharchula and Lipulekh have no rows at all. So the high road is listed and
not reported on, which is a specific and dangerous shape of missing data: a consumer
that treats "no closure row" as "open" would render the most exposed stretch of the
journey as clear.

This module therefore returns closures **and** the coverage caveat, and callers are
expected to show the second whenever they show the first. Silence from this source
means silence, not safety.

There is no API and no stated licence. The page is a server-rendered table at
`mis.pwduk.in/pwd/roadClosure`, unauthenticated, about five megabytes, and it holds
roughly two thousand rows statewide with about two hundred naming Pithoragarh.

**It refuses our production host.** The register answers 200 from a domestic
connection and **403 from the Hostinger datacentre range**, with a browser User-Agent
and with ours alike, so the block is on the address rather than on how we ask. Nothing
in this module can fix that. It degrades to reporting nothing rather than to reporting
an empty road register, which would read as "no closures" on a page about closures:
see the first-fetch handling in `live/ingest.py`. Getting these rows in production
needs a fetch from an address the register will talk to, which is a deployment
decision rather than a code one.
"""

from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

logger = logging.getLogger(__name__)

REGISTER = "https://mis.pwduk.in/pwd/roadClosure"

#: Names that place a road in our corridor. Matched against the road name, so a
#: statewide register of two thousand rows becomes the handful that concern us.
#: Deliberately generous: a road we show and do not need is noise, a road we miss is
#: a traveller not told.
CORRIDOR = (
    "pithoragarh",
    "dharchula",
    "tawaghat",
    "jauljibi",
    "joljivi",
    "ghatiabagarh",
    "sobla",
    "jibti",
    "gunji",
    "kutti",
    "kuti",
    "jolingkong",
    "jyolingkong",
    "munsyari",
    "munsiyari",
    "lipulekh",
    "budhi",
    "nabhidhang",
)

#: The stretch nobody reports on. Named so the caveat can be specific rather than a
#: general disclaimer that readers learn to skip.
UNREPORTED_ABOVE = "Tawaghat"

_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
_CELL = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S | re.I)


#: Terms that place a row in this district even when the road name does not name one
#: of our stops. The register carries the reporting officer and division alongside
#: each row, so a road called "Ogla to Bhagichora Pasma Hanseshwar" is identifiable as
#: ours through the rest of the row rather than through its name.
DISTRICT_TERMS = ("pithoragarh", "पिथौरागढ़")


@dataclass(frozen=True)
class Closure:
    road: str
    status: str
    reported_from: str | None
    reported_to: str | None
    duration: str | None
    reported_by: str | None
    #: True when the road name names a place on the journey. False for a closure
    #: elsewhere in the district.
    #:
    #: Both are kept, and the distinction is why. Filtering on road name alone
    #: returned 21 rows where 197 concern this district, and some of the 176 sit on
    #: the approach a traveller drives to reach the corridor. Discarding them would
    #: have been a silent narrowing dressed up as precision. Showing them all without
    #: the flag would be the opposite error, burying the four rows that matter.
    on_corridor: bool

    @property
    def is_closed(self) -> bool:
        return "close" in self.status.lower()


@dataclass(frozen=True)
class RegisterState:
    closures: list[Closure]
    checked_at: datetime
    reachable: bool
    #: Always present, always meant to be shown alongside the rows.
    caveat: str = (
        "The state road register does not report on the road above "
        f"{UNREPORTED_ABOVE}. An absence of closures for the high route means "
        "nobody has published anything, not that the road is open."
    )

    @property
    def open_closures(self) -> list[Closure]:
        return [c for c in self.closures if c.is_closed]

    @property
    def on_corridor(self) -> list[Closure]:
        """Closures on the journey itself, as opposed to elsewhere in the district."""
        return [c for c in self.closures if c.on_corridor]


def _clean(cell: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", cell))).strip()


def parse(markup: str) -> list[Closure]:
    """Pull our corridor's rows out of the statewide table.

    Positional rather than header-driven because the table has no usable header
    markup. The columns observed on 17 Aug 2026 are: serial, road name, chainages,
    from, to, duration, status, reporting officer, length. A row that does not have
    at least the status column is skipped rather than guessed at.
    """
    closures: list[Closure] = []

    for row in _ROW.findall(markup):
        cells = [_clean(c) for c in _CELL.findall(row)]
        if len(cells) < 7:
            continue

        road = cells[1]
        on_corridor = any(place in road.lower() for place in CORRIDOR)

        # The whole row, so a road whose name gives no clue is still caught by its
        # reporting division. See `Closure.on_corridor`.
        whole_row = " ".join(cells).lower()
        in_district = any(term in whole_row for term in DISTRICT_TERMS)

        if not (on_corridor or in_district):
            continue

        closures.append(
            Closure(
                road=road,
                status=cells[6],
                reported_from=cells[3] or None,
                reported_to=cells[4] or None,
                duration=cells[5] or None,
                reported_by=cells[7] if len(cells) > 7 else None,
                on_corridor=on_corridor,
            )
        )

    return closures


async def fetch(*, client: httpx.AsyncClient | None = None) -> RegisterState:
    now = datetime.now(UTC)
    owned = client is None
    # Generous timeout: the response is several megabytes of server-rendered table.
    http = client or httpx.AsyncClient(
        timeout=45, headers={"User-Agent": "adikailash-status/1"}
    )
    try:
        response = await http.get(REGISTER)
        response.raise_for_status()
        return RegisterState(
            closures=parse(response.text), checked_at=now, reachable=True
        )
    except httpx.HTTPError as exc:
        logger.warning("PWD register unreachable: %s", exc)
        return RegisterState(closures=[], checked_at=now, reachable=False)
    finally:
        if owned:
            await http.aclose()
