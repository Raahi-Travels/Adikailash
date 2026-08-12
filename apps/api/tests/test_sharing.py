"""What a family share link may never contain.

`test_family_view_carries_nothing_sensitive` is a structural test rather than a
behavioural one, and that is the point. The leak this feature risks is not a bug in a
code path — it is somebody adding `passport_number` to a traveller record eighteen
months from now and a filter, somewhere, quietly passing it through. A behavioural
test written today would not exercise a column that does not exist yet. A structural
one fails the moment the field appears.
"""

from __future__ import annotations

import dataclasses
from datetime import date, datetime, timezone

import pytest

from api.domain.sharing import (
    ALLOWED_EXCEPTIONS,
    FORBIDDEN_FIELDS,
    FamilyView,
    SharedCheckIn,
    SharedContact,
    SharedDay,
    check_view_is_safe,
)


def test_family_view_carries_nothing_sensitive():
    """Doc 05: exclude identity documents, payment details, private notes and
    sensitive traveller information."""
    assert check_view_is_safe() == []


# Defined at module level, not inside the tests. `check_view_is_safe` resolves
# annotations with `typing.get_type_hints`, which reads a class's *module* globals —
# a dataclass declared inside a function body is invisible to it and raises NameError
# on the forward reference. The real views are module-level, so this matches how the
# check is actually used.


@dataclasses.dataclass(frozen=True)
class _LeakyDay:
    day: int
    passport_number: str | None = None


@dataclasses.dataclass(frozen=True)
class _LeakyNestedView:
    days: tuple[_LeakyDay, ...] = ()


@dataclasses.dataclass(frozen=True)
class _LeakyTopLevelView:
    agreed_amount: int = 0


@dataclasses.dataclass(frozen=True)
class _DayWithHostPhone:
    day: int
    phone: str | None = None


def test_the_check_catches_a_leak_nested_one_level_down():
    """The realistic failure is somebody enriching `SharedDay` with the homestay's
    full address, not touching `FamilyView` at all."""
    assert check_view_is_safe(_LeakyNestedView) == [
        "_LeakyNestedView.days.passport_number"
    ]


def test_the_check_catches_a_leak_at_the_top_level():
    assert check_view_is_safe(_LeakyTopLevelView) == ["_LeakyTopLevelView.agreed_amount"]


def test_the_one_exception_is_named_rather_than_the_rule_weakened():
    """`SharedContact.phone` publishes a *company* number — the coordinator's work
    phone and the emergency line, which doc 05 requires. `phone` on any other type
    must still fail, so the exception is per-type rather than a hole in the set."""
    assert ("SharedContact", "phone") in ALLOWED_EXCEPTIONS
    assert "phone" in FORBIDDEN_FIELDS
    assert check_view_is_safe(_DayWithHostPhone) == ["_DayWithHostPhone.phone"]


def test_full_names_are_forbidden_first_names_are_not():
    """"Is Amma on this trip" is reassurance. A full name beside a date of birth and
    a phone number is a contact list."""
    assert "full_name" in FORBIDDEN_FIELDS
    assert "traveller_first_names" not in FORBIDDEN_FIELDS


def test_the_view_cannot_be_constructed_from_a_reservation():
    """There is deliberately no `FamilyView.from_reservation`. Every field is passed
    explicitly, so a new sensitive column cannot arrive by accident."""
    assert not hasattr(FamilyView, "from_reservation")
    assert not hasattr(FamilyView, "model_validate")


def test_a_view_with_no_check_in_says_so_rather_than_implying_silence():
    view = FamilyView(
        journey_name="Adi Kailash and Om Parvat",
        starts_on=date(2027, 5, 20),
        ends_on=date(2027, 5, 29),
        traveller_first_names=("Meera", "Raghav"),
        days=(SharedDay(day=1, on_date=date(2027, 5, 20), title="Kathgodam to Almora"),),
        contacts=(SharedContact(label="Operator", phone="+91 00000 00000"),),
        latest_check_in=None,
        route_notices=(),
    )
    assert not view.has_check_in


def test_a_check_in_carries_who_posted_it_and_when():
    """An automatic check-in derived from the itinerary would be a claim we cannot
    stand behind at exactly the moment a family is relying on it. So the view carries
    the author, and the page shows it."""
    check_in = SharedCheckIn(
        at=datetime(2027, 5, 23, 16, 30, tzinfo=timezone.utc),
        note="Reached Gunji, everyone well.",
        posted_by="coordinator@example.invalid",
    )
    assert check_in.posted_by
    assert check_in.at.tzinfo is not None


@pytest.mark.parametrize(
    "field", ["passport_number", "aadhaar", "agreed_amount", "internal_note"]
)
def test_the_forbidden_set_covers_the_four_doc_05_exclusions(field: str):
    assert field in FORBIDDEN_FIELDS
