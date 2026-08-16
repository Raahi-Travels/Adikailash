"""The lapse-rate correction, checked against the three real measurements.

The cases below are not invented. They are the actual model elevations and raw
temperatures Open-Meteo returned for Nabhidhang, Jyolingkong and Gunji on 16 Aug
2026, which is what makes them worth testing against: they include the case where
the model thinks the ground is *lower* than it is, which is the direction an
implementation gets wrong when it assumes mountains are always under-resolved.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from api.domain.mountain_weather import (
    LAPSE_RATE_C_PER_M,
    MAX_TRUSTWORTHY_GAP_M,
    Consensus,
    CorrectedReading,
    ModelReading,
    advisory_for,
    combine,
    condition_from_wmo,
    correct_to_elevation,
)


def reading(model_elevation_m: int, temp: str, model: str = "icon") -> ModelReading:
    return ModelReading(
        model=model,
        model_elevation_m=model_elevation_m,
        temp_min_c=Decimal(temp),
        temp_max_c=Decimal(temp),
    )


def test_model_too_high_means_reading_too_cold() -> None:
    """Nabhidhang: model at 4,989 m, real ground 4,260 m, raw 5.2 C.

    The model placed the point 729 m too high, so it reported air that cold. The
    correction has to *warm* it. Getting this backwards makes the answer 5 degrees
    worse than doing nothing, which is why it is the first test in the file.
    """
    result = correct_to_elevation(reading(4989, "5.2"), 4260)

    assert result.temp_max_c > Decimal("5.2")
    assert result.temp_max_c == pytest.approx(Decimal("9.9"), abs=Decimal("0.2"))
    assert result.gap_m == 729
    assert result.is_trustworthy
    assert result.was_corrected


def test_model_too_low_means_reading_too_warm() -> None:
    """Jyolingkong: model at 3,895 m, real ground 4,570 m, raw 11.4 C.

    The opposite direction, and the reason a naive implementation that always adds
    warmth would be dangerous here. This point must get *colder*.
    """
    result = correct_to_elevation(reading(3895, "11.4"), 4570)

    assert result.temp_max_c < Decimal("11.4")
    assert result.temp_max_c == pytest.approx(Decimal("7.0"), abs=Decimal("0.2"))
    assert result.gap_m == -675


def test_gunji_case() -> None:
    result = correct_to_elevation(reading(3809, "10.4"), 3160)
    assert result.temp_max_c == pytest.approx(Decimal("14.6"), abs=Decimal("0.3"))


def test_uncorrected_error_would_be_several_degrees() -> None:
    """The whole justification for this module, asserted rather than asserted-in-prose."""
    for model_elevation, true_elevation, raw in [
        (4989, 4260, "5.2"),
        (3895, 4570, "11.4"),
        (3809, 3160, "10.4"),
    ]:
        result = correct_to_elevation(reading(model_elevation, raw), true_elevation)
        error_removed = abs(result.temp_max_c - Decimal(raw))
        assert error_removed > Decimal("3.5")


def test_a_negligible_gap_is_left_alone() -> None:
    """Correcting by 0.2 C invents precision the model does not have."""
    result = correct_to_elevation(reading(3180, "10.0"), 3160)
    assert not result.was_corrected
    assert result.temp_max_c == Decimal("10.0")
    assert result.is_trustworthy


def test_an_enormous_gap_is_returned_but_not_trusted() -> None:
    """A coordinate in the wrong valley must not silently become a temperature."""
    result = correct_to_elevation(reading(5600, "0.0"), 910)
    assert not result.is_trustworthy
    assert result.gap_m > MAX_TRUSTWORTHY_GAP_M
    # Still returned: withholding it entirely leaves operations with nothing to see.
    assert result.temp_max_c is not None


def test_lapse_rate_is_the_standard_one() -> None:
    assert LAPSE_RATE_C_PER_M == Decimal("0.0065")


def corrected(low: str, high: str, trustworthy: bool = True) -> CorrectedReading:
    return CorrectedReading(
        model="m",
        temp_min_c=Decimal(low),
        temp_max_c=Decimal(high),
        gap_m=0,
        is_trustworthy=trustworthy,
        was_corrected=False,
    )


def test_consensus_takes_the_outer_envelope_not_the_mean() -> None:
    """Somebody at 4,000 m at night carries the cost of an optimistic average."""
    result = combine([corrected("-2", "8"), corrected("1", "12"), corrected("0", "9")])

    assert result is not None
    assert result.temp_min_c == Decimal("-2")
    assert result.temp_max_c == Decimal("12")
    assert result.model_count == 3


def test_wide_disagreement_is_low_confidence() -> None:
    wide = combine([corrected("0", "4"), corrected("2", "14")])
    assert wide is not None
    assert wide.spread_c == Decimal("10.0")
    assert wide.is_low_confidence

    tight = combine([corrected("0", "9"), corrected("1", "10")])
    assert tight is not None
    assert not tight.is_low_confidence


def test_one_untrustworthy_model_taints_the_consensus() -> None:
    result = combine([corrected("0", "9"), corrected("1", "10", trustworthy=False)])
    assert result is not None
    assert not result.is_trustworthy
    assert result.is_low_confidence


def test_no_readings_is_none_not_zero_degrees() -> None:
    assert combine([]) is None


def test_unknown_wmo_code_is_unknown_not_clear() -> None:
    """The failure being avoided: an unseen code rendering as good weather."""
    assert condition_from_wmo(4242) == "unknown"
    assert condition_from_wmo(None) == "unknown"
    assert condition_from_wmo(0) == "clear"
    assert condition_from_wmo(75) == "heavy_snow"


def test_severe_conditions_advise_speaking_to_a_person() -> None:
    advisory = advisory_for("heavy_snow", None, 4260)
    assert advisory is not None
    assert "speaking to us" in advisory[0]
    # Hindi is not an afterthought here; doc 02 treats it as a first-class layout.
    assert advisory[1].strip()


def test_freezing_overnight_is_called_out_even_in_clear_weather() -> None:
    below = Consensus(
        temp_min_c=Decimal("-3"),
        temp_max_c=Decimal("11"),
        spread_c=Decimal("1"),
        model_count=2,
        is_trustworthy=True,
    )
    advisory = advisory_for("clear", below, 4260)
    assert advisory is not None
    assert "freezing" in advisory[0]


def test_nothing_useful_to_say_says_nothing() -> None:
    mild = Consensus(
        temp_min_c=Decimal("12"),
        temp_max_c=Decimal("20"),
        spread_c=Decimal("1"),
        model_count=2,
        is_trustworthy=True,
    )
    assert advisory_for("partly_cloudy", mild, 910) is None
