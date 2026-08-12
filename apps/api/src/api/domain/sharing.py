"""What a family member at home is allowed to see (doc 05, P1).

Doc 05: "A family member who is not travelling may need reassurance without seeing
sensitive data." It then lists six things to show and four to exclude — identity
documents, payment details, private notes, sensitive traveller information.

**The whole design decision is that this is a construction, not a filter.**

The obvious implementation is to load the reservation and strip the sensitive
fields on the way out. That is a deny-list, and deny-lists fail silently in exactly
one direction: somebody adds `passport_number` to `ReservationTraveller` six months
from now, nobody updates the stripper, and a mother in Pithoragarh is looking at her
son's passport number on a link she forwarded to four relatives. Nothing breaks. No
test fails. The leak is invisible until it is a report.

So `FamilyView` below is built field by field from explicit arguments. There is no
constructor that takes a `Reservation`. A new sensitive column added anywhere in the
schema cannot reach this object without somebody writing a line of code to put it
there — and that line is the review moment.

The same reasoning applies to travellers: the view carries *first names and nothing
else*, because "who is on this trip" is reassurance and "here is their date of birth
and phone number" is a data leak wearing the same clothes.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True, slots=True)
class SharedContact:
    """A phone number we are deliberately publishing to this viewer.

    Doc 05 wants the coordinator and an emergency number visible: a family member
    with no way to reach anybody is not reassured, they are frightened. These are
    company numbers, never a traveller's own.
    """

    label: str
    phone: str
    note: str | None = None


@dataclass(frozen=True, slots=True)
class SharedDay:
    """One line of the broad itinerary. Broad is the operative word."""

    day: int
    on_date: date | None
    title: str
    #: Where they sleep, at settlement granularity ("Gunji"), never an address.
    #: A family member wants to know their father is in Gunji tonight. A street
    #: address for a homestay is the host family's data, not ours to publish.
    staying_at: str | None = None


@dataclass(frozen=True, slots=True)
class SharedCheckIn:
    """A coordinator's note that the group is fine.

    Doc 05 calls this "daily movement or check-in summary when offered" — the
    "when offered" matters. Silence must read as "no check-in today", never as
    something worse, so the view carries the timestamp and the page says so.
    """

    at: datetime
    note: str
    posted_by: str


@dataclass(frozen=True, slots=True)
class FamilyView:
    """Everything a share link may ever show.

    Every field here was chosen. Adding one is a deliberate act with a reviewer.
    """

    # --- Who and when (doc 05: "Journey and date") ---
    journey_name: str
    starts_on: date | None
    ends_on: date | None
    #: First names only. Enough for "is Amma on this trip", not enough to be a
    #: contact list.
    traveller_first_names: tuple[str, ...]

    # --- Broad itinerary ---
    days: tuple[SharedDay, ...]

    # --- Reachability ---
    contacts: tuple[SharedContact, ...]

    # --- Live-ish reassurance ---
    latest_check_in: SharedCheckIn | None
    #: Doc 05: "Important route notice". Plain sentences, already public on the
    #: status page — nothing here is privileged information about this group.
    route_notices: tuple[str, ...]

    #: Who set this up and what they called the viewer ("Amma"), so the page can
    #: say who shared it. Consent is legible rather than assumed.
    shared_by: str | None = None
    shared_with_label: str | None = None

    @property
    def has_check_in(self) -> bool:
        return self.latest_check_in is not None


#: Field names that must never appear on `FamilyView`, asserted by a test.
#:
#: This is belt and braces — the dataclass already cannot hold them — but it turns
#: "we were careful" into something that fails a build. If somebody adds
#: `passport_number` to the view in a hurry, the test names the rule they broke and
#: quotes the doc, which is more useful than a review comment they may not get.
FORBIDDEN_FIELDS = frozenset(
    {
        "passport_number",
        "passport",
        "aadhaar",
        "aadhaar_number",
        "date_of_birth",
        "dob",
        "phone",
        "email",
        "address",
        "amount",
        "agreed_amount",
        "balance",
        "payments",
        "payment_records",
        "internal_note",
        "private_note",
        "health",
        "health_information",
        "has_disclosed_health_information",
        "dietary_note",
        "documents",
        "document_submissions",
        "full_name",
        "last_name",
        "surname",
    }
)


#: The one deliberate exception, named rather than excused by weakening the rule
#: above. `SharedContact.phone` exists to publish a number — but only ever a
#: *company* number: the coordinator's work phone and the emergency line. Doc 05
#: requires them, and a family member with no way to reach anybody is not reassured.
#:
#: Written as (type name, field name) so `phone` appearing on any other type in this
#: module still fails. If somebody adds a phone to `SharedDay` to show the homestay's
#: landline, that is a host family's personal number and the check should catch it.
ALLOWED_EXCEPTIONS = frozenset({("SharedContact", "phone")})


def check_view_is_safe(view_type: type = FamilyView) -> list[str]:
    """Return the names of any forbidden field present. Empty means safe.

    Walks the nested dataclasses too, because the leak we are actually worried
    about is somebody enriching `SharedDay` with the homestay's full address rather
    than touching `FamilyView` at all.
    """
    import dataclasses
    import typing

    problems: list[str] = []
    seen: set[type] = set()

    def walk(cls: type, path: str) -> None:
        if cls in seen or not dataclasses.is_dataclass(cls):
            return
        seen.add(cls)
        # `get_type_hints` rather than `field.type`. This module uses
        # `from __future__ import annotations`, so every `field.type` is the *string*
        # "tuple[SharedDay, ...]" — and `is_dataclass("tuple[SharedDay, ...]")` is
        # False, so a naive walk silently never recurses and reports every nested
        # type as clean. Resolving the hints is what makes this check real.
        hints = typing.get_type_hints(cls)
        for f in dataclasses.fields(cls):
            if (
                f.name.lower() in FORBIDDEN_FIELDS
                and (cls.__name__, f.name) not in ALLOWED_EXCEPTIONS
            ):
                problems.append(f"{path}.{f.name}")
            for inner in _dataclasses_within(hints.get(f.name)):
                walk(inner, f"{path}.{f.name}")

    walk(view_type, view_type.__name__)
    return problems


def _dataclasses_within(annotation: object) -> list[type]:
    """Every dataclass reachable from an annotation, unwrapping containers.

    `tuple[SharedDay, ...]` and `SharedCheckIn | None` both hide a dataclass one
    level down, and those are exactly the fields worth checking — the leak we expect
    is somebody enriching `SharedDay`, not `FamilyView`.
    """
    import dataclasses
    import typing

    if annotation is None:
        return []
    if dataclasses.is_dataclass(annotation):
        return [annotation]  # type: ignore[list-item]
    found: list[type] = []
    for arg in typing.get_args(annotation):
        found.extend(_dataclasses_within(arg))
    return found
