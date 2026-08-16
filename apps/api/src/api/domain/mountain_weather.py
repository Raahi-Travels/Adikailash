"""Turning a coarse global forecast into something honest about a Himalayan valley.

**The problem this exists to solve.** Every weather model available for India here is
a global one at 10 to 25 km resolution. No regional high-resolution model covers this
area: ICON-D2, AROME, JMA-MSM and GEM-Regional all refuse the coordinates outright.
Within a 10 by 8 km box near Gunji the ground spans 2,658 m to 5,534 m, which is
**2,876 metres of relief inside a single grid cell**. The model does not know about
the valley; it knows about an average.

So the model reports the temperature for whatever elevation its own terrain grid
thinks is there, and that elevation is wrong here by hundreds of metres in both
directions. Measured against the three places that matter:

===============  ==========  =========  ==========  ====================
Place            true alt.   model alt. raw temp    error if uncorrected
===============  ==========  =========  ==========  ====================
Nabhidhang         4,260 m     4,989 m     5.2 C     5.4 C **too cold**
Jyolingkong        4,570 m     3,895 m    11.4 C     4.4 C **too warm**
Gunji              3,160 m     3,809 m    10.4 C     3.6 C too cold
===============  ==========  =========  ==========  ====================

The errors run in *both* directions, which is what makes this dangerous rather than
merely imprecise. A traveller reading "11 degrees at Jyolingkong" packs for a
different night than the one they get.

**The correction.** A standard environmental lapse rate, applied across the gap
between the model's terrain elevation and the real one. This is not a refinement, it
is the difference between a usable number and a misleading one. Open-Meteo is the
only provider tested that both reports its model elevation and lets you override it.
OpenWeatherMap and WeatherAPI report neither, which is why they are not used here:
you cannot correct an error you cannot see.

**Why a range rather than a number.** Across models the spread after correction
reached 8.8 C. The ensemble from a single model showed about 2 C, which is
under-dispersed and would give false confidence. So a reading carries a low and a
high from genuinely different models, and the UI is expected to show both.

None of this is observation. The nearest station reporting actual weather is
Pantnagar, at 236 m and about 230 km away, on the other side of the range. Everything
here is model output and `WeatherSource.WEATHER_API` says so.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

#: Degrees Celsius lost per metre of ascent. The standard environmental lapse rate,
#: 6.5 C per 1,000 m. Real lapse rates vary with humidity and inversion, and in a
#: gorge at dawn they can invert entirely, which is one more reason the output is a
#: range with a caveat rather than a figure.
LAPSE_RATE_C_PER_M = Decimal("0.0065")

#: Beyond this, the model is describing different terrain rather than the same
#: terrain slightly displaced, and a lapse-rate correction is extrapolation dressed
#: up as arithmetic. Chosen against the observed cases: the worst real gap in the
#: table above is 729 m at Nabhidhang, so this admits those and rejects the case
#: where a coordinate has landed in the wrong valley altogether.
MAX_TRUSTWORTHY_GAP_M = 1200

#: Under this, correcting changes the reading by less than half a degree and the
#: precision is not real. Reported uncorrected, so nobody reads significance into it.
NEGLIGIBLE_GAP_M = 40


@dataclass(frozen=True)
class ModelReading:
    """One model's output for a point, before any correction."""

    model: str
    #: The elevation the model's own terrain grid holds for this point.
    model_elevation_m: int
    temp_min_c: Decimal
    temp_max_c: Decimal
    wind_kph: Decimal | None = None
    snow_depth_cm: int | None = None


@dataclass(frozen=True)
class CorrectedReading:
    """A reading placed at the real elevation, with its own honesty attached."""

    model: str
    temp_min_c: Decimal
    temp_max_c: Decimal
    #: Metres between the model's terrain and the real ground. Signed: positive means
    #: the model thought the place was higher than it is.
    gap_m: int
    #: False when the gap is too large to correct honestly. The reading is still
    #: returned, because withholding it entirely tells a traveller nothing, but it
    #: must not be presented as a temperature for that place.
    is_trustworthy: bool
    was_corrected: bool


def correct_to_elevation(
    reading: ModelReading, true_elevation_m: int
) -> CorrectedReading:
    """Move a reading from the model's terrain to the real ground.

    Cooling with height, so a model that placed the point *too high* has reported a
    temperature that is too cold, and the correction adds warmth. Getting this sign
    backwards doubles the error instead of removing it, which is why the direction is
    asserted in the tests rather than left to reading the arithmetic.
    """
    gap = reading.model_elevation_m - true_elevation_m

    if abs(gap) < NEGLIGIBLE_GAP_M:
        return CorrectedReading(
            model=reading.model,
            temp_min_c=reading.temp_min_c,
            temp_max_c=reading.temp_max_c,
            gap_m=gap,
            is_trustworthy=True,
            was_corrected=False,
        )

    adjustment = Decimal(gap) * LAPSE_RATE_C_PER_M
    return CorrectedReading(
        model=reading.model,
        temp_min_c=(reading.temp_min_c + adjustment).quantize(Decimal("0.1")),
        temp_max_c=(reading.temp_max_c + adjustment).quantize(Decimal("0.1")),
        gap_m=gap,
        is_trustworthy=abs(gap) <= MAX_TRUSTWORTHY_GAP_M,
        was_corrected=True,
    )


@dataclass(frozen=True)
class Consensus:
    """What several corrected models agree and disagree about."""

    #: Coldest low and warmest high across the models. Deliberately the outer
    #: envelope rather than a mean: on this route the cost of being colder than
    #: expected is carried by somebody at 4,000 m at night.
    temp_min_c: Decimal
    temp_max_c: Decimal
    #: How far apart the models are on the daily high. The honest measure of how much
    #: any of this is worth.
    spread_c: Decimal
    model_count: int
    #: True when every contributing model sat within the correctable gap.
    is_trustworthy: bool

    @property
    def is_low_confidence(self) -> bool:
        """Whether the disagreement is large enough that the range is the answer.

        Four degrees is roughly the difference between a cold night and a dangerous
        one at this altitude, so beyond it the UI should stop showing a range as
        though it were a forecast.
        """
        return not self.is_trustworthy or self.spread_c > Decimal("4")


def combine(readings: list[CorrectedReading]) -> Consensus | None:
    """Fold several models into one range, keeping the disagreement visible.

    Returns None for an empty list rather than a zero-width range at zero degrees,
    which would render as a confident forecast of freezing.
    """
    if not readings:
        return None

    lows = [r.temp_min_c for r in readings]
    highs = [r.temp_max_c for r in readings]

    return Consensus(
        temp_min_c=min(lows),
        temp_max_c=max(highs),
        spread_c=(max(highs) - min(highs)).quantize(Decimal("0.1")),
        model_count=len(readings),
        is_trustworthy=all(r.is_trustworthy for r in readings),
    )


#: WMO weather interpretation codes, collapsed onto our own vocabulary.
#:
#: Grouped by what a traveller should do rather than by meteorological category: 71
#: and 73 are "slight" and "moderate" snowfall to the WMO and both mean "snow" to
#: somebody deciding whether to set off, while 75 and 77 mean the road may not be
#: there tomorrow.
_WMO: dict[int, str] = {
    0: "clear",
    1: "clear",
    2: "partly_cloudy",
    3: "overcast",
    45: "fog",
    48: "fog",
    51: "rain",
    53: "rain",
    55: "rain",
    56: "rain",
    57: "rain",
    61: "rain",
    63: "rain",
    65: "heavy_rain",
    66: "rain",
    67: "heavy_rain",
    71: "snow",
    73: "snow",
    75: "heavy_snow",
    77: "snow",
    80: "rain",
    81: "rain",
    82: "heavy_rain",
    85: "snow",
    86: "heavy_snow",
    95: "storm",
    96: "storm",
    99: "storm",
}


def condition_from_wmo(code: int | None) -> str:
    """Map a WMO code onto our condition vocabulary.

    An unrecognised code becomes `unknown` rather than `clear`. The failure mode
    being avoided is a code we have not seen rendering as good weather.
    """
    if code is None:
        return "unknown"
    return _WMO.get(code, "unknown")


#: Above this the World Health Organization calls for protection. Reached routinely
#: on this route on days that feel cold, which is what makes it worth saying: nobody
#: reaches for sunscreen at four thousand metres in a wind.
UV_WORTH_MENTIONING = 6.0


def advisory_for(
    condition: str,
    consensus: Consensus | None,
    altitude_m: int | None,
    uv_index: float | None = None,
) -> tuple[str, str] | None:
    """Practical guidance, in English and Hindi, or nothing.

    Doc 02 wants "carry layers", not a meteorology lesson, and returning None when
    there is nothing useful to say is deliberate: an advisory printed beside every
    reading stops being read.
    """
    if condition in {"heavy_snow", "storm"}:
        return (
            "Conditions here can close the road. Do not set off on this stretch "
            "without speaking to us first.",
            "इन परिस्थितियों में सड़क बंद हो सकती है। इस हिस्से पर निकलने से पहले हमसे "
            "बात अवश्य करें।",
        )
    if condition == "heavy_rain":
        return (
            "Heavy rain on these slopes brings landslides. Check with us before "
            "travelling this leg.",
            "इन ढलानों पर भारी वर्षा भूस्खलन लाती है। इस चरण की यात्रा से पहले हमसे "
            "पुष्टि कर लें।",
        )
    if consensus and consensus.temp_min_c < Decimal("0"):
        return (
            "Below freezing overnight. Carry more warmth than the daytime "
            "temperature suggests.",
            "रात में तापमान शून्य से नीचे। दिन के तापमान से अधिक गर्म कपड़े साथ रखें।",
        )
    if uv_index is not None and uv_index >= UV_WORTH_MENTIONING:
        return (
            f"Ultraviolet index around {uv_index:.0f}. Sun at this altitude burns "
            "even when the air is cold, and on snow it reaches you twice.",
            f"पराबैंगनी सूचकांक लगभग {uv_index:.0f}। इस ऊँचाई पर ठंड में भी धूप जलाती "
            "है, और बर्फ़ पर वह दो बार पड़ती है।",
        )
    if altitude_m and altitude_m >= 3000 and condition == "clear":
        return (
            "Clear and high. Sun at this altitude burns even when the air is cold.",
            "साफ़ मौसम और अधिक ऊँचाई। इस ऊँचाई पर ठंड में भी धूप जलाती है।",
        )
    return None
