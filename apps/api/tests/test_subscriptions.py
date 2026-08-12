"""Alert materiality invariants.

`test_reverification_with_no_change_sends_nothing` is the one that matters. If it
flips, a coordinator re-verifying a segment every twelve hours produces sixty
messages a season saying the road is still open, everyone mutes us, and the one
message that says it closed arrives in a channel nobody reads. The failure mode of an
alert system is not silence; it is noise.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from api.domain.status import Access
from api.domain.subscriptions import (
    IST,
    Change,
    Urgency,
    in_quiet_hours,
    material_change,
    message_for,
    next_send_window,
    send_at,
    urgency_of,
    within_send_budget,
)


def change(previous: Access | None, new: Access, **kw) -> Change:
    return Change(
        segment_slug="gunji-nabhidhang",
        segment_name="Gunji to Nabhidhang",
        previous_access=previous,
        new_access=new,
        published_at=datetime(2027, 5, 20, 9, 0, tzinfo=IST),
        **kw,
    )


# ------------------------------------------------------------------ materiality


def test_reverification_with_no_change_sends_nothing():
    """The most common publish, and the least interesting. It updates the page,
    which is where somebody who wants to check goes."""
    c = change(Access.OPEN, Access.OPEN)
    assert not material_change(c)
    assert urgency_of(c) is Urgency.QUIET
    assert send_at(c, now=datetime(2027, 5, 20, 9, 0, tzinfo=IST)) is None


def test_closure_is_material_and_urgent():
    c = change(Access.OPEN, Access.CLOSED)
    assert material_change(c)
    assert c.became_blocking
    assert urgency_of(c) is Urgency.URGENT


def test_reopening_is_material():
    """Tempting to alert only on bad news. Somebody who cancelled on a closure notice
    deserves to hear it lifted, and from us."""
    c = change(Access.CLOSED, Access.OPEN)
    assert material_change(c)
    assert c.stopped_blocking
    assert urgency_of(c) is Urgency.NOTABLE


def test_first_ever_status_is_material():
    c = change(None, Access.OPEN)
    assert c.is_first_status
    assert material_change(c)


def test_open_to_limited_is_material_but_not_urgent():
    c = change(Access.OPEN, Access.LIMITED)
    assert material_change(c)
    assert urgency_of(c) is Urgency.NOTABLE


def test_suspended_to_closed_is_not_a_new_blockage():
    """Both are blocking. Somebody already told the road is shut does not need a
    second message telling them it is still shut, differently."""
    c = change(Access.SUSPENDED, Access.CLOSED)
    assert material_change(c)  # the state did change
    assert not c.became_blocking  # but they were already blocked
    assert urgency_of(c) is Urgency.NOTABLE


# ----------------------------------------------------------------- quiet hours


def test_urgent_ignores_quiet_hours():
    """A closure at eleven at night matters to somebody leaving at five."""
    midnight = datetime(2027, 5, 20, 23, 30, tzinfo=IST)
    assert in_quiet_hours(midnight)
    assert send_at(change(Access.OPEN, Access.CLOSED), now=midnight) == midnight


def test_notable_change_at_night_waits_for_morning():
    midnight = datetime(2027, 5, 20, 23, 30, tzinfo=IST)
    due = send_at(change(Access.OPEN, Access.LIMITED), now=midnight)
    assert due is not None
    assert due.astimezone(IST).hour == 7
    assert due.astimezone(IST).day == 21


def test_early_morning_waits_for_the_same_day():
    early = datetime(2027, 5, 20, 5, 0, tzinfo=IST)
    due = next_send_window(early)
    assert due.astimezone(IST).hour == 7
    assert due.astimezone(IST).day == 20


def test_daytime_sends_immediately():
    noon = datetime(2027, 5, 20, 12, 0, tzinfo=IST)
    assert not in_quiet_hours(noon)
    assert next_send_window(noon) == noon


@pytest.mark.parametrize("hour", [21, 22, 23, 0, 3, 6])
def test_quiet_window_covers_the_night(hour: int):
    assert in_quiet_hours(datetime(2027, 5, 20, hour, 30, tzinfo=IST))


@pytest.mark.parametrize("hour", [7, 9, 14, 20])
def test_daytime_is_not_quiet(hour: int):
    assert not in_quiet_hours(datetime(2027, 5, 20, hour, 0, tzinfo=IST))


def test_quiet_hours_are_evaluated_in_ist_not_utc():
    """A subscriber in Chennai is not thinking in UTC. 20:00 UTC is 01:30 IST, which
    is very much the middle of the night."""
    from datetime import timezone

    utc_evening = datetime(2027, 5, 20, 20, 0, tzinfo=timezone.utc)
    assert in_quiet_hours(utc_evening)


# ---------------------------------------------------------------- send budget


def test_send_budget_caps_a_flapping_segment():
    assert within_send_budget(0)
    assert within_send_budget(2)
    assert not within_send_budget(3)


# -------------------------------------------------------------------- wording


def test_closure_message_never_promises_and_says_do_not_set_out():
    _, body = message_for(change(Access.OPEN, Access.CLOSED))
    assert "not a forecast" in body
    assert "do not set out" in body.lower()


def test_reopening_message_refuses_to_guarantee_the_travel_date():
    _, body = message_for(change(Access.CLOSED, Access.OPEN))
    assert "without notice" in body
    assert "guarantee" in body


def test_summary_is_appended_when_present():
    _, body = message_for(
        change(Access.OPEN, Access.CLOSED, summary="Landslide near Gunji.")
    )
    assert "Landslide near Gunji." in body
