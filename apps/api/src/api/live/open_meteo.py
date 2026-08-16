"""Open-Meteo, asked properly.

Chosen over OpenWeatherMap, WeatherAPI and Visual Crossing for one reason that
outranks everything else about them: it reports the elevation its own model grid
holds for a point, **and it lets you override it**. The others report neither, and on
this route that is disqualifying rather than inconvenient. See
`api.domain.mountain_weather` for the measurements: uncorrected, the error at
Nabhidhang is 5.4 C too cold and at Jyolingkong 4.4 C too warm, in opposite
directions, on the same day.

Three things this module does that a naive integration would not.

**It passes `elevation` explicitly.** Verified on 17 Aug 2026 that the parameter is
honoured rather than echoed: the same point returned 12.5 C at the model's own
3,477 m and 14.6 C when told the ground is at 3,160 m, a gradient of 6.6 C per
1,000 m. That is the API doing the lapse-rate correction. We check the returned
elevation against what we asked for and correct it ourselves if it ever stops
matching, because silently reverting to the model's own terrain is the failure that
would be hardest to notice.

**It pins the timezone.** `timezone=auto` returns **Asia/Kathmandu** for Nabhidhang,
Kalapani and Lipulekh, because the geocoder resolves the disputed border in Nepal's
favour. A day boundary fifteen minutes out silently shifts which day's forecast a
traveller reads. Confirmed live: Dharchula resolves to Asia/Kolkata, Nabhidhang to
Asia/Kathmandu.

**It asks several models.** Post-correction spread across models reached 8.8 C, while
a single model's own ensemble showed about 2 C. The ensemble is under-dispersed and
believing it would give false confidence, so the range shown to a traveller comes
from genuinely different models.

Licensing: the free tier is non-commercial and CC-BY 4.0. A commercial deployment
needs the paid host, which is a business decision rather than a technical one, so
`OPEN_METEO_API_KEY` and `OPEN_METEO_HOST` are settings and the default is the free
host. Attribution belongs on any page that shows this.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import httpx

from api.domain.mountain_weather import (
    ModelReading,
    condition_from_wmo,
    correct_to_elevation,
)

logger = logging.getLogger(__name__)

FREE_HOST = "https://api.open-meteo.com"
COMMERCIAL_HOST = "https://customer-api.open-meteo.com"

#: Deliberately different families rather than one provider's ensemble. ICON is
#: DWD, GFS is NOAA, and where they disagree the disagreement is real information.
MODELS = ("icon_seamless", "gfs_seamless")

#: The route runs along a disputed border and the geocoder gets it wrong. Never
#: `auto`. See the module docstring.
TIMEZONE = "Asia/Kolkata"

_DAILY = (
    "temperature_2m_max",
    "temperature_2m_min",
    "weather_code",
    "wind_speed_10m_max",
    "snowfall_sum",
)


@dataclass(frozen=True)
class PointForecast:
    """One place, one day, several models, already placed at the real elevation."""

    slug: str
    on_date: date
    readings: list[ModelReading]
    condition: str
    #: What the API says its terrain holds, after any override we asked for.
    resolved_elevation_m: int
    #: True when we had to apply the lapse rate ourselves because the override was
    #: not honoured. Should always be False; if it starts being True, the provider
    #: changed something.
    corrected_locally: bool


@dataclass(frozen=True)
class Point:
    slug: str
    latitude: float
    longitude: float
    elevation_m: int


async def elevations(
    points: list[tuple[float, float]], *, client: httpx.AsyncClient | None = None
) -> list[float] | None:
    """The model's terrain elevation for each coordinate.

    Used to sanity-check a coordinate rather than to correct anything: if a point we
    believe is at 910 m sits on terrain the DEM calls 4,900 m, the coordinate is in
    the wrong valley and no lapse rate will rescue it. Capped at 100 coordinates by
    the provider.
    """
    if not points:
        return []

    owned = client is None
    http = client or httpx.AsyncClient(timeout=20)
    try:
        response = await http.get(
            f"{FREE_HOST}/v1/elevation",
            params={
                "latitude": ",".join(f"{lat:.6f}" for lat, _ in points),
                "longitude": ",".join(f"{lon:.6f}" for _, lon in points),
            },
        )
        response.raise_for_status()
        return list(response.json()["elevation"])
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.warning("Open-Meteo elevation lookup failed: %s", exc)
        return None
    finally:
        if owned:
            await http.aclose()


async def forecast(
    points: list[Point],
    *,
    days: int = 3,
    api_key: str | None = None,
    host: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> list[PointForecast]:
    """Forecasts for a list of places, one request per place.

    One request per point rather than the batched multi-coordinate form, because the
    batch form takes a single `elevation` for every coordinate. On a route spanning
    910 m to 4,570 m that would apply one place's correction to all of them, which is
    worse than no correction at all: it would be wrong in a way that looks
    deliberate.

    A failure on one point drops that point and keeps the rest. Weather for five of
    six places is useful; an exception that loses all six because one timed out is
    not.
    """
    if not points:
        return []

    owned = client is None
    http = client or httpx.AsyncClient(timeout=25)
    base = host or (COMMERCIAL_HOST if api_key else FREE_HOST)
    results: list[PointForecast] = []

    try:
        for point in points:
            params: dict[str, str | int | float] = {
                "latitude": f"{point.latitude:.6f}",
                "longitude": f"{point.longitude:.6f}",
                # The whole reason this provider was chosen.
                "elevation": point.elevation_m,
                "daily": ",".join(_DAILY),
                "models": ",".join(MODELS),
                "timezone": TIMEZONE,
                "forecast_days": days,
            }
            if api_key:
                params["apikey"] = api_key

            try:
                response = await http.get(f"{base}/v1/forecast", params=params)
                response.raise_for_status()
                payload = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Open-Meteo failed for %s: %s", point.slug, exc)
                continue

            results.extend(_parse(point, payload))
    finally:
        if owned:
            await http.aclose()

    return results


def _parse(point: Point, payload: dict) -> list[PointForecast]:
    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    if not dates:
        return []

    resolved = int(payload.get("elevation") or point.elevation_m)

    # The override should make these equal. If it does not, the provider has changed
    # behaviour and we do the arithmetic ourselves rather than publishing the
    # model's own terrain temperature as this place's.
    needs_local_fix = abs(resolved - point.elevation_m) > 5

    out: list[PointForecast] = []
    for index, iso in enumerate(dates):
        readings: list[ModelReading] = []
        codes: list[int] = []

        for model in MODELS:
            highs = daily.get(f"temperature_2m_max_{model}") or []
            lows = daily.get(f"temperature_2m_min_{model}") or []
            if index >= len(highs) or index >= len(lows):
                continue
            if highs[index] is None or lows[index] is None:
                continue

            winds = daily.get(f"wind_speed_10m_max_{model}") or []
            snows = daily.get(f"snowfall_sum_{model}") or []
            code = (daily.get(f"weather_code_{model}") or [None] * (index + 1))[index]
            if code is not None:
                codes.append(int(code))

            reading = ModelReading(
                model=model,
                model_elevation_m=resolved,
                temp_min_c=Decimal(str(lows[index])),
                temp_max_c=Decimal(str(highs[index])),
                wind_kph=(
                    Decimal(str(winds[index]))
                    if index < len(winds) and winds[index] is not None
                    else None
                ),
                snow_depth_cm=(
                    int(snows[index])
                    if index < len(snows) and snows[index] is not None
                    else None
                ),
            )

            if needs_local_fix:
                fixed = correct_to_elevation(reading, point.elevation_m)
                reading = ModelReading(
                    model=reading.model,
                    model_elevation_m=point.elevation_m,
                    temp_min_c=fixed.temp_min_c,
                    temp_max_c=fixed.temp_max_c,
                    wind_kph=reading.wind_kph,
                    snow_depth_cm=reading.snow_depth_cm,
                )

            readings.append(reading)

        if not readings:
            continue

        # The worse of the models' codes, on the same reasoning as taking the outer
        # temperature envelope: if one model says snow and the other says cloud, a
        # traveller should hear snow.
        condition = _worst(condition_from_wmo(c) for c in codes)

        out.append(
            PointForecast(
                slug=point.slug,
                on_date=date.fromisoformat(iso),
                readings=readings,
                condition=condition,
                resolved_elevation_m=point.elevation_m if needs_local_fix else resolved,
                corrected_locally=needs_local_fix,
            )
        )

    return out


#: Worst first. `unknown` sits above the benign conditions deliberately: not knowing
#: is a worse thing to report as "clear" than as "unknown".
_SEVERITY = [
    "storm",
    "heavy_snow",
    "heavy_rain",
    "snow",
    "rain",
    "fog",
    "unknown",
    "overcast",
    "partly_cloudy",
    "clear",
]


def _worst(conditions) -> str:
    seen = set(conditions)
    for condition in _SEVERITY:
        if condition in seen:
            return condition
    return "unknown"
