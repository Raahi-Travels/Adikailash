"""Weather observations for the route.

Weather is held to the same discipline as route status, and for the same reason:
doc 09 forbids publishing a "guaranteed route, weather, visibility, darshan or
spiritual result", and doc 08 requires that stale information become *visibly* stale.

A three-day-old forecast rendered as today's conditions is exactly the kind of quiet
falsehood that gets a family onto a road they should not be on. So freshness is
derived at read time from ``next_update_due`` — never stored, never trusted to a cron.

Doc 08 also warns: "The product should not label third-party data as authoritative
without defined verification." Hence ``source`` and ``is_field_verified`` — a reading
pulled from a weather API is labelled as such, distinct from a coordinator standing
on the pass looking at the sky.
"""

from __future__ import annotations

import enum
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Any

from api.db import Base, LocalizedText, TimestampMixin, pg_enum

#: Beyond this many hours past its due time, a reading stops being presentable.
WEATHER_STALE_GRACE_HOURS = 6


class WeatherCondition(enum.StrEnum):
    CLEAR = "clear"
    PARTLY_CLOUDY = "partly_cloudy"
    OVERCAST = "overcast"
    RAIN = "rain"
    HEAVY_RAIN = "heavy_rain"
    SNOW = "snow"
    HEAVY_SNOW = "heavy_snow"
    FOG = "fog"
    STORM = "storm"
    UNKNOWN = "unknown"


class WeatherSource(enum.StrEnum):
    """Distinguishes a machine reading from a human looking out of a window."""

    FIELD_COORDINATOR = "field_coordinator"
    OPERATING_PARTNER = "operating_partner"
    OFFICIAL_FORECAST = "official_forecast"
    WEATHER_API = "weather_api"


#: Conditions that should stop a departure being sold without a human decision.
#: Not automatic cancellation — doc 09 keeps disruption calls with operations.
SEVERE_CONDITIONS = frozenset(
    {
        WeatherCondition.HEAVY_SNOW,
        WeatherCondition.STORM,
        WeatherCondition.HEAVY_RAIN,
    }
)


class WeatherSnapshot(Base, TimestampMixin):
    """A dated reading for a destination or route segment."""

    __tablename__ = "weather_snapshots"
    __table_args__ = (
        CheckConstraint("next_update_due > observed_at", name="update_window_forward"),
        CheckConstraint(
            "temp_min_c is null or temp_max_c is null or temp_max_c >= temp_min_c",
            name="temperature_range_ordered",
        ),
        CheckConstraint(
            "destination_id is not null or route_segment_id is not null",
            name="weather_needs_a_place",
        ),
        # A field-verified reading must name the person who made it.
        CheckConstraint(
            "not is_field_verified or observed_by is not null",
            name="field_verification_needs_an_observer",
        ),
        Index("ix_weather_destination_observed", "destination_id", "observed_at"),
        Index("ix_weather_segment_observed", "route_segment_id", "observed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE")
    )
    route_segment_id: Mapped[int | None] = mapped_column(
        ForeignKey("route_segments.id", ondelete="CASCADE")
    )

    condition: Mapped[WeatherCondition] = mapped_column(
        pg_enum(WeatherCondition, "weather_condition"),
        nullable=False,
        server_default=text("'unknown'"),
    )
    temp_min_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    temp_max_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    wind_kph: Mapped[float | None] = mapped_column(Numeric(5, 1))
    snow_depth_cm: Mapped[int | None] = mapped_column(Integer)

    #: Practical guidance for travellers — "carry layers", not a meteorology lesson.
    advisory: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())

    source: Mapped[WeatherSource] = mapped_column(
        pg_enum(WeatherSource, "weather_source"), nullable=False
    )
    #: True only when a named human actually saw these conditions.
    is_field_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    observed_by: Mapped[str | None] = mapped_column(String(120))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    next_update_due: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    destination: Mapped[Any] = relationship("Destination", viewonly=True)

    def is_stale(self, *, now: datetime | None = None) -> bool:
        """Whether this reading is too old to present as current conditions."""
        moment = now or datetime.now(UTC)
        overdue = (moment - self.next_update_due).total_seconds() / 3600
        return overdue > WEATHER_STALE_GRACE_HOURS

    def is_presentable(self, *, now: datetime | None = None) -> bool:
        return not self.is_stale(now=now)

    @property
    def is_severe(self) -> bool:
        return self.condition in SEVERE_CONDITIONS
