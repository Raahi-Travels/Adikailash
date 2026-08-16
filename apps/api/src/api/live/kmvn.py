"""Bed availability at the government rest houses on this route.

Kumaon Mandal Vikas Nigam runs the only accommodation above Dharchula, and it
publishes live inventory through an unauthenticated endpoint its own booking page
calls. That makes it the most differentiated dataset available here: no other
operator's website can tell a traveller how many beds exist at Jyolingkong, and the
answer, **fifteen in total**, is the sort of fact that changes a plan.

Observed inventory: Gunji 40, Nabhidhang 30, Jyolingkong 15, Budhi 25, and the
Dharchula rest house 10. The Dharchula house showing 4 of 10 taken while the high
camps sat full is what proved the numbers are live rather than a static template.

**Two traps, both hit during research.**

The apex domain `kmvn.in` redirects to a dead plain-HTTP host, so the `www` host is
required rather than conventional.

The response is an HTML fragment, and its printed date cells can carry a stale
template date that does not match the range requested. So the caller's requested
range is authoritative and the printed date is ignored: reading the cell would
occasionally report next month's availability as tonight's.

`robots.txt` disallows only `/admin/`, so this path is not disallowed. The endpoint
is called at a low rate from a scheduled job, with the `Referer` its own page sends.
"""

from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

import httpx

logger = logging.getLogger(__name__)

#: The `www` host is required. The apex redirects into a dead host.
ENDPOINT = "https://www.kmvn.in/custom/ajax/avail.php"
REFERER = "https://www.kmvn.in/booking/pithoragarh"

#: KMVN's own property ids, with the altitude we hold for the place. Ordered up the
#: road, which is the order a traveller reads them in.
PROPERTIES: tuple[tuple[int, str, str], ...] = (
    (31, "TRH Dharchula", "dharchula"),
    (57, "Budhi Camp", "budhi"),
    (54, "Gunji Camp", "gunji"),
    (55, "Nabhidang Camp", "nabhidhang"),
    (56, "Jyolingkong Camp", "jyolingkong"),
)

#: A row of the availability table: total beds, available beds, tariff.
_ROW = re.compile(
    r"(\d{1,2}/\d{1,2}/\d{4})\s+(.*?)\s+(\d+)\s+(\d+)\s+₹\s*([\d,]+)", re.S
)


@dataclass(frozen=True)
class Availability:
    property_id: int
    property_name: str
    destination_slug: str
    #: The date asked for, never the one the fragment printed. See the docstring.
    on_date: date
    total_beds: int
    available_beds: int
    tariff_inr: int

    @property
    def is_full(self) -> bool:
        return self.available_beds == 0

    @property
    def is_scarce(self) -> bool:
        """Few enough left that a traveller should be told now rather than later."""
        return 0 < self.available_beds <= max(3, self.total_beds // 5)


def _text(markup: str) -> str:
    without_code = re.sub(r"<(script|style).*?</\1>", " ", markup, flags=re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", without_code)))


def parse(
    markup: str, *, property_id: int, name: str, slug: str, on_date: date
) -> Availability | None:
    text = _text(markup)
    match = _ROW.search(text)
    if not match:
        return None
    try:
        total = int(match.group(3))
        available = int(match.group(4))
        tariff = int(match.group(5).replace(",", ""))
    except ValueError:
        return None

    # Available above total means we have misread the columns rather than found a
    # remarkable rest house. Better to report nothing than to invent capacity.
    if available > total:
        logger.warning("%s: available %d > total %d, discarded", name, available, total)
        return None

    return Availability(
        property_id=property_id,
        property_name=name,
        destination_slug=slug,
        on_date=on_date,
        total_beds=total,
        available_beds=available,
        tariff_inr=tariff,
    )


def _epoch_ist(on_date: date) -> int:
    """Midnight IST for a date, as the endpoint expects."""
    ist = datetime.combine(on_date, time.min).replace(
        tzinfo=UTC
    ) - timedelta(hours=5, minutes=30)
    return int(ist.timestamp())


async def fetch(
    on_date: date, *, client: httpx.AsyncClient | None = None
) -> list[Availability]:
    owned = client is None
    http = client or httpx.AsyncClient(
        timeout=25,
        headers={"Referer": REFERER, "User-Agent": "adikailash-status/1"},
    )
    start = _epoch_ist(on_date)
    end = _epoch_ist(on_date + timedelta(days=1))
    out: list[Availability] = []

    try:
        for property_id, name, slug in PROPERTIES:
            try:
                response = await http.post(
                    ENDPOINT,
                    data={
                        "id": property_id,
                        "hit": name,
                        "start_time": start,
                        "end_time": end,
                    },
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                logger.warning("KMVN failed for %s: %s", name, exc)
                continue

            row = parse(
                response.text,
                property_id=property_id,
                name=name,
                slug=slug,
                on_date=on_date,
            )
            if row:
                out.append(row)
    finally:
        if owned:
            await http.aclose()

    return out
