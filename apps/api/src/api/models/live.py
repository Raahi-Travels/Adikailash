"""The last thing each outside source told us, and when.

One row per source, overwritten in place. A history of what a scraper saw is
something nobody on this team will ever read, and an append-only table would make
the "current state" query slower every day for no benefit.

**Why store at all rather than fetch per request.** Three reasons, in order of
weight. A page load must not depend on a government portal being up, and two of these
five sources are visibly neglected infrastructure. The PWD register is a five
megabyte HTML document and fetching it in a request handler would be indefensible.
And a scheduled fetch is a rate we choose rather than one our traffic imposes on
somebody else's server.

**Every row carries `fetched_at` and nothing derives freshness from anything else.**
Same discipline as `WeatherSnapshot` and route status: staleness is computed at read
time from a timestamp, never stored as a flag that a failed job can leave lying.
"""

from __future__ import annotations

import enum
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base, TimestampMixin, pg_enum


class LiveSource(enum.StrEnum):
    """Outside sources, named for what they answer rather than who runs them."""

    #: Whether Inner Line Permits are being issued at all.
    PERMIT_PORTAL = "permit_portal"
    #: State road closure register. Covers the corridor nominally, not the high road.
    ROAD_REGISTER = "road_register"
    #: NDMA disaster alerts. Meteorological only; no road items.
    HAZARD_ALERTS = "hazard_alerts"
    #: Government rest house bed availability.
    BED_AVAILABILITY = "bed_availability"


#: How long each source's answer stays worth showing. Set from how fast the
#: underlying thing actually changes, not from a uniform default: a permit
#: suspension holds for weeks, a road closure for hours.
STALE_AFTER: dict[LiveSource, timedelta] = {
    LiveSource.PERMIT_PORTAL: timedelta(hours=18),
    LiveSource.ROAD_REGISTER: timedelta(hours=3),
    LiveSource.HAZARD_ALERTS: timedelta(hours=3),
    LiveSource.BED_AVAILABILITY: timedelta(hours=36),
}


class LiveReading(Base, TimestampMixin):
    """The most recent successful read from one outside source."""

    __tablename__ = "live_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[LiveSource] = mapped_column(
        pg_enum(LiveSource, "live_source"), nullable=False, unique=True
    )

    #: The parsed answer. Shape is the source's own; consumers know their source.
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    #: Set when the last attempt failed. The previous payload is deliberately kept
    #: alongside it, so a page can say "this is what we last saw, and we could not
    #: reach them since" rather than losing the information entirely. What it must
    #: never do is present the old payload as current, which is what `is_stale`
    #: exists to prevent.
    last_error: Mapped[str | None] = mapped_column(Text)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #: Where it came from, verbatim, so a reader can go and look.
    source_url: Mapped[str | None] = mapped_column(String(300))

    def is_stale(self, *, now: datetime | None = None) -> bool:
        moment = now or datetime.now(UTC)
        return moment - self.fetched_at > STALE_AFTER[self.source]
