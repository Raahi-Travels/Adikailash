"""Pull outside data in and store it as readings that know how old they are.

Run with:

    uv run --project apps/api python -m api.live.ingest

Designed to be run on a schedule and to be safe to run twice. Every writer here is
idempotent on a natural key, because the alternative is a cron that doubles a
traveller's forecast list every time it fires.

**Nothing written here is field-verified.** `WeatherSnapshot.is_field_verified` stays
false and `source` stays `WEATHER_API`, so the model output can never be mistaken on
a screen for a coordinator standing at Gunji looking at the sky. The database
constraint `field_verification_needs_an_observer` enforces the other half of that.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.db import SessionLocal
from api.domain.mountain_weather import advisory_for, combine, correct_to_elevation
from api.live import ilp_portal, kmvn, open_meteo, pwd, sachet
from api.models.catalogue import Destination
from api.models.live import LiveReading, LiveSource
from api.models.weather import WeatherCondition, WeatherSnapshot, WeatherSource

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("ingest")

#: How long a model forecast stays presentable. Six hours is roughly how often the
#: global models publish, so a reading older than this has been superseded upstream
#: whether or not we fetched the newer one.
FORECAST_VALID_FOR = timedelta(hours=8)

#: Places worth asking about. Deliberately not every destination: the Kumaon circuit
#: stops are at ordinary altitudes where a traveller can read any weather app, and
#: the value here is entirely in the places where ordinary weather apps are wrong.
ROUTE_SLUGS = ("dharchula", "gunji", "nabhidhang", "adi-kailash", "pithoragarh")


async def ingest_weather(session: AsyncSession) -> int:
    settings = get_settings()
    if not settings.live_sources_enabled:
        logger.info("Live sources disabled, skipping weather")
        return 0

    destinations = list(
        await session.scalars(
            select(Destination).where(Destination.slug.in_(ROUTE_SLUGS))
        )
    )

    points: list[open_meteo.Point] = []
    by_slug: dict[str, Destination] = {}
    for destination in destinations:
        # A place with no coordinate or no altitude cannot be corrected, and an
        # uncorrected reading here is worse than none: see the module docstring on
        # `api.domain.mountain_weather` for how large the error is.
        if (
            destination.latitude is None
            or destination.longitude is None
            or destination.altitude_m is None
        ):
            logger.warning(
                "%s has no coordinate or altitude, skipped", destination.slug
            )
            continue
        by_slug[destination.slug] = destination
        points.append(
            open_meteo.Point(
                slug=destination.slug,
                latitude=float(destination.latitude),
                longitude=float(destination.longitude),
                elevation_m=destination.altitude_m,
            )
        )

    forecasts = await open_meteo.forecast(
        points,
        api_key=settings.open_meteo_api_key or None,
        host=settings.open_meteo_host or None,
    )
    if not forecasts:
        logger.warning("No forecasts returned")
        return 0

    now = datetime.now(UTC)
    written = 0

    for point_forecast in forecasts:
        destination = by_slug[point_forecast.slug]

        if point_forecast.corrected_locally:
            # The provider stopped honouring the elevation override. Worth shouting
            # about: it is the difference between a usable number and one that is
            # several degrees wrong in an unpredictable direction.
            logger.warning(
                "%s: elevation override not honoured, corrected locally",
                point_forecast.slug,
            )

        corrected = [
            correct_to_elevation(reading, destination.altitude_m)
            for reading in point_forecast.readings
        ]
        consensus = combine(corrected)
        if consensus is None:
            continue

        # Only today's reading becomes a snapshot. The later days are a forecast, and
        # the snapshot table is for "what are conditions", not "what might they be".
        # Publishing day three as a current reading is exactly the quiet falsehood
        # the model's docstring warns about.
        if point_forecast.on_date != now.astimezone().date():
            continue

        advisory = advisory_for(
            point_forecast.condition, consensus, destination.altitude_m
        )

        existing = await session.scalar(
            select(WeatherSnapshot)
            .where(
                WeatherSnapshot.destination_id == destination.id,
                WeatherSnapshot.source == WeatherSource.WEATHER_API,
            )
            .order_by(WeatherSnapshot.observed_at.desc())
            .limit(1)
        )

        # Replace our own previous machine reading rather than appending. A history
        # of forecasts is not something anybody on this team will ever read, and an
        # ever-growing table makes the "newest reading" query slower every day.
        # A coordinator's field observation is a different row and is never touched.
        target = existing or WeatherSnapshot(destination_id=destination.id)

        target.condition = WeatherCondition(point_forecast.condition)
        target.temp_min_c = consensus.temp_min_c
        target.temp_max_c = consensus.temp_max_c
        target.wind_kph = max(
            (r.wind_kph for r in point_forecast.readings if r.wind_kph is not None),
            default=None,
        )
        target.source = WeatherSource.WEATHER_API
        target.is_field_verified = False
        target.observed_by = None
        target.observed_at = now
        target.next_update_due = now + FORECAST_VALID_FOR
        target.advisory = (
            {"en": advisory[0], "hi": advisory[1]} if advisory else None
        )

        if existing is None:
            session.add(target)

        confidence = " LOW CONFIDENCE" if consensus.is_low_confidence else ""
        logger.info(
            "%-12s %s  %s to %s C  spread %s%s",
            point_forecast.slug,
            point_forecast.condition,
            consensus.temp_min_c,
            consensus.temp_max_c,
            consensus.spread_c,
            confidence,
        )
        written += 1

    await session.commit()
    return written


async def _store(
    session: AsyncSession,
    source: LiveSource,
    payload: dict,
    *,
    url: str,
    error: str | None = None,
) -> None:
    """Upsert one source's answer.

    A failure keeps the previous payload and records the error beside it, so a page
    can say "this is what we last saw, and we have not been able to reach them
    since". `fetched_at` is only advanced on success, which is what stops a failing
    job from making stale data look fresh: staleness is derived from that timestamp
    and nothing else touches it.
    """
    now = datetime.now(UTC)
    row = await session.scalar(select(LiveReading).where(LiveReading.source == source))

    if row is None:
        row = LiveReading(source=source, payload=payload, fetched_at=now)
        session.add(row)
    elif error is None:
        row.payload = payload
        row.fetched_at = now

    row.source_url = url
    row.last_attempt_at = now
    row.last_error = error


async def ingest_permit_portal(session: AsyncSession) -> None:
    state = await ilp_portal.fetch()
    await _store(
        session,
        LiveSource.PERMIT_PORTAL,
        {
            "is_issuing": state.is_issuing,
            "notice": state.notice,
            "registration_open": state.registration_open,
            "uncertainty": state.uncertainty,
        },
        url=ilp_portal.PORTAL,
        error=None if state.is_known else (state.uncertainty or "unreachable"),
    )
    logger.info("permit portal: issuing=%s", state.is_issuing)


async def ingest_road_register(session: AsyncSession) -> None:
    state = await pwd.fetch()
    await _store(
        session,
        LiveSource.ROAD_REGISTER,
        {
            "caveat": state.caveat,
            "unreported_above": pwd.UNREPORTED_ABOVE,
            "closures": [
                {
                    "road": c.road,
                    "status": c.status,
                    "is_closed": c.is_closed,
                    "on_corridor": c.on_corridor,
                    "from": c.reported_from,
                    "to": c.reported_to,
                    "duration": c.duration,
                    "reported_by": c.reported_by,
                }
                for c in state.closures
            ],
        },
        url=pwd.REGISTER,
        error=None if state.reachable else "unreachable",
    )
    logger.info(
        "road register: %d district row(s), %d on the corridor, %d closed",
        len(state.closures),
        len(state.on_corridor),
        len(state.open_closures),
    )


async def ingest_hazard_alerts(session: AsyncSession) -> None:
    state = await sachet.fetch()
    await _store(
        session,
        LiveSource.HAZARD_ALERTS,
        {
            # Stated on the payload rather than left to the reader, because a feed
            # with no road items looks like a feed saying the roads are fine.
            "covers": "weather warnings only, no road closures",
            "alerts": [
                {
                    "title": a.title,
                    "description": a.description,
                    "published": a.published,
                    "link": a.link,
                    "is_severe": a.is_severe,
                }
                for a in state.alerts
            ],
        },
        url=sachet.RSS,
        error=None if state.reachable else "unreachable",
    )
    logger.info("hazard alerts: %d for this district", len(state.alerts))


async def ingest_beds(session: AsyncSession) -> None:
    # A month out: far enough that the answer is about capacity rather than about
    # this weekend, which is the question worth publishing. Same-day availability
    # changes faster than we fetch and would be misleading.
    on_date = (datetime.now(UTC) + timedelta(days=30)).date()
    rows = await kmvn.fetch(on_date)
    await _store(
        session,
        LiveSource.BED_AVAILABILITY,
        {
            "on_date": on_date.isoformat(),
            "properties": [
                {
                    "name": b.property_name,
                    "destination": b.destination_slug,
                    "total_beds": b.total_beds,
                    "available_beds": b.available_beds,
                    "tariff_inr": b.tariff_inr,
                    "is_full": b.is_full,
                    "is_scarce": b.is_scarce,
                }
                for b in rows
            ],
        },
        url=kmvn.REFERER,
        error=None if rows else "no rows returned",
    )
    logger.info("beds: %d propert(ies)", len(rows))


async def run() -> None:
    settings = get_settings()
    async with SessionLocal() as session:
        count = await ingest_weather(session)

        if settings.live_sources_enabled:
            # Each is independent, and one provider being down must not cost us the
            # others. Two of these are visibly neglected government sites.
            for name, job in (
                ("permit portal", ingest_permit_portal),
                ("road register", ingest_road_register),
                ("hazard alerts", ingest_hazard_alerts),
                ("bed availability", ingest_beds),
            ):
                try:
                    await job(session)
                except Exception as exc:  # noqa: BLE001 — one source must not sink the rest
                    logger.warning("%s ingest failed: %s", name, exc)
            await session.commit()

    logger.info("%d weather reading(s) written", count)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
