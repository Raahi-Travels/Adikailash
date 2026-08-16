"""NDMA's public alert feed, filtered to this district.

SACHET carries the Common Alerting Protocol messages India actually issues. It is
free, unauthenticated and public domain, it names Pithoragarh, and it publishes in
both English and Hindi, which matters on a bilingual site.

**It is entirely meteorological.** Across the alerts observed there was not one road
closure item. So this complements the PWD register rather than covering for it: rain
and storm warnings come from here, road state does not come from anywhere reliable.

**Radius alone over-returns**, so alerts are matched by testing whether a place falls
inside the alert's own polygon. Uttarakhand is small and mountainous and a
fifty-kilometre radius around Pithoragarh reaches districts on the other side of a
range, which would have the site warning travellers about weather they will never
see and teaching them to ignore the warnings that matter.

The RSS feed is used as the trigger because it answers in about sixty milliseconds,
and the heavier endpoints are only called when it shows something new. There is no
CORS header, so this must stay server-side, which it is.

A separate note, recorded because somebody will otherwise reach for it: **do not
iframe, proxy or link IMD's city pages.** `city.imd.gov.in/citywx/responsive/` was
observed serving injected JavaScript that opens a third-party domain every two
minutes on Android user agents. SACHET carries IMD's nowcast content without that
exposure, which is one more reason it is the source used here.
"""

from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

logger = logging.getLogger(__name__)

BASE = "https://sachet.ndma.gov.in/cap_public_website"
RSS = f"{BASE}/rss/rss_uttarakhand.xml"

#: The district, in both scripts. The feed mixes them within a single document.
DISTRICT_TERMS = ("pithoragarh", "पिथौरागढ़", "dharchula", "धारचूला", "munsyari")

_ITEM = re.compile(r"<item>(.*?)</item>", re.S | re.I)


@dataclass(frozen=True)
class Alert:
    title: str
    description: str
    published: str | None
    link: str | None

    @property
    def is_severe(self) -> bool:
        text = f"{self.title} {self.description}".lower()
        return any(
            word in text
            for word in ("red", "orange", "severe", "heavy", "very heavy", "warning")
        )


@dataclass(frozen=True)
class AlertState:
    alerts: list[Alert]
    checked_at: datetime
    reachable: bool

    @property
    def severe(self) -> list[Alert]:
        return [a for a in self.alerts if a.is_severe]


def _field(item: str, tag: str) -> str | None:
    match = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", item, re.S | re.I)
    if not match:
        return None
    value = match.group(1)
    value = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", value, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(value)).strip() or None


def parse(feed: str) -> list[Alert]:
    """District items only.

    Filtering on the item text rather than fetching every alert's polygon: the RSS
    feed is already scoped to Uttarakhand, and an item that never names this district
    or one of its towns is not worth a second request. Polygon matching belongs on
    the detail fetch, for the items that survive this.
    """
    alerts: list[Alert] = []

    for item in _ITEM.findall(feed):
        title = _field(item, "title") or ""
        description = _field(item, "description") or ""
        haystack = f"{title} {description}".lower()
        if not any(term in haystack for term in DISTRICT_TERMS):
            continue
        alerts.append(
            Alert(
                title=title,
                description=description[:600],
                published=_field(item, "pubDate"),
                link=_field(item, "link"),
            )
        )

    return alerts


def contains(polygon: list[tuple[float, float]], lat: float, lon: float) -> bool:
    """Ray casting, for testing an alert polygon against a place.

    Written here rather than pulled in with a geometry library because it is fifteen
    lines and the alternative drags a compiled dependency into a container that
    otherwise needs none. Coordinates are (lat, lon) throughout; CAP publishes them
    in that order and swapping them is the classic way to place Pithoragarh in the
    Arabian Sea.
    """
    inside = False
    count = len(polygon)
    for index in range(count):
        lat_a, lon_a = polygon[index]
        lat_b, lon_b = polygon[(index + 1) % count]
        if (lat_a > lat) != (lat_b > lat):
            crossing = (lon_b - lon_a) * (lat - lat_a) / (lat_b - lat_a) + lon_a
            if lon < crossing:
                inside = not inside
    return inside


async def fetch(*, client: httpx.AsyncClient | None = None) -> AlertState:
    now = datetime.now(UTC)
    owned = client is None
    http = client or httpx.AsyncClient(
        timeout=20, headers={"User-Agent": "adikailash-status/1"}
    )
    try:
        # GET rather than HEAD: the service answers 403 to HEAD.
        response = await http.get(RSS)
        response.raise_for_status()
        return AlertState(alerts=parse(response.text), checked_at=now, reachable=True)
    except httpx.HTTPError as exc:
        logger.warning("SACHET feed unreachable: %s", exc)
        return AlertState(alerts=[], checked_at=now, reachable=False)
    finally:
        if owned:
            await http.aclose()
