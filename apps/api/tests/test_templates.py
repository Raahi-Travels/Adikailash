"""Templates that Meta and TRAI will actually accept.

`test_every_template_is_submittable` is the one that earns its keep. A template
rejected at review costs hours to days and blocks the channel completely — and the
rules it breaks are invisible when you read the wording, which is how three of the
four templates here shipped with a body starting on a variable the first time. This
test caught that before submission rather than after.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from api.domain.status import Access
from api.domain.subscriptions import Change, message_for
from api.domain.templates import (
    ALL_TEMPLATES,
    MAX_PARAMETER,
    ROUTE_BLOCKED,
    ROUTE_CHANGED,
    ROUTE_FIRST_STATUS,
    ROUTE_REOPENED,
    Template,
    TemplateCategory,
    channel_needs_template,
    sanitise_parameter,
    submission_problems,
    template_for,
)


def change(previous: Access | None, new: Access, **kw) -> Change:
    return Change(
        segment_slug="gunji-nabhidhang",
        segment_name="Gunji to Nabhidhang",
        previous_access=previous,
        new_access=new,
        published_at=datetime(2027, 5, 20, 9, 0, tzinfo=timezone.utc),
        **kw,
    )


# ------------------------------------------------------------- submittability


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: t.name)
def test_every_template_is_submittable(template: Template):
    assert submission_problems(template) == []


def test_a_body_starting_with_a_variable_is_caught():
    """Meta reads it as a template with no content of its own — which is what a
    spammer submits to get an arbitrary-text channel approved."""
    bad = Template(name="x", category=TemplateCategory.UTILITY, body="{{1}} is closed.")
    assert "Body begins with a variable." in submission_problems(bad)


def test_a_body_ending_with_a_variable_is_caught():
    bad = Template(name="x", category=TemplateCategory.UTILITY, body="Status: {{1}}")
    assert "Body ends with a variable." in submission_problems(bad)


def test_adjacent_variables_are_caught():
    bad = Template(
        name="x", category=TemplateCategory.UTILITY, body="Route {{1}} {{2}} today."
    )
    assert any("adjacent" in p for p in submission_problems(bad))


def test_a_gap_in_the_numbering_is_caught():
    """Parameters are positional. A gap means the array we send stops lining up with
    the template that was approved, and the message goes out with the wrong values in
    the wrong slots."""
    bad = Template(
        name="x", category=TemplateCategory.UTILITY, body="Route {{1}} then {{3}} ends."
    )
    assert any("1..n" in p for p in submission_problems(bad))


def test_promotional_language_in_a_utility_template_is_flagged():
    """Not a platform rule — ours. Meta re-categorises templates that read as
    marketing, which changes the billing and can put the number under review."""
    bad = Template(
        name="x",
        category=TemplateCategory.UTILITY,
        body="Route open. Book now for a discount on the next departure.",
    )
    assert any("promotional" in p for p in submission_problems(bad))


def test_every_template_carries_the_opt_out_in_its_fixed_footer():
    """Doc 03 rules out dark patterns. On WhatsApp the equivalent of the unsubscribe
    link is a reply keyword, and putting it in the footer means it cannot be dropped
    from an individual message."""
    for template in ALL_TEMPLATES:
        assert template.footer and "STOP" in template.footer


def test_the_caveats_are_fixed_text_not_variables():
    """The point of moving to templates. Once approved, nobody can send a closure
    alert without "not a forecast" and "do not set out ... before speaking to us"
    attached — in prose they were a convention somebody maintained."""
    assert "not a forecast" in ROUTE_BLOCKED.body
    assert "do not set out" in ROUTE_BLOCKED.body.lower()
    assert "{{" not in "not a forecast"
    assert "without notice" in ROUTE_REOPENED.body
    assert "guarantee" in ROUTE_REOPENED.body


# --------------------------------------------------------------- parameters


def test_newlines_are_stripped_from_parameters():
    """A coordinator types a note on a phone, so it will contain newlines. Meta
    rejects the parameter, and the failure arrives at send time long after review
    passed — the worst place to find it."""
    out = sanitise_parameter("Landslide near Gunji.\n\nBoth lanes.", fallback="x")
    assert "\n" not in out
    assert out == "Landslide near Gunji. Both lanes."


def test_tabs_and_long_space_runs_are_stripped():
    assert "\t" not in sanitise_parameter("a\tb", fallback="x")
    assert sanitise_parameter("a     b", fallback="x") == "a b"


def test_an_empty_parameter_becomes_the_fallback():
    """Meta rejects an empty parameter outright, so "" is never a valid answer —
    which is why `fallback` is required rather than defaulted."""
    assert sanitise_parameter("", fallback="nothing further") == "nothing further"
    assert sanitise_parameter("   ", fallback="nothing further") == "nothing further"
    assert sanitise_parameter(None, fallback="nothing further") == "nothing further"


def test_a_long_parameter_is_cut_at_a_word_boundary():
    """A message ending mid-word reads as a bug to the person receiving it, which
    undermines the one thing these messages exist to do."""
    out = sanitise_parameter("word " * 100, fallback="x")
    assert len(out) <= MAX_PARAMETER + 1
    assert out.endswith("…")
    assert "wor…" not in out


# ------------------------------------------------------------------ mapping


def test_closure_maps_to_the_blocked_template():
    m = template_for(change(Access.OPEN, Access.CLOSED, summary="Landslide near Gunji."))
    assert m.name == ROUTE_BLOCKED.name
    assert m.parameters == ("Gunji to Nabhidhang", "closed", "Landslide near Gunji.")
    assert "Landslide near Gunji." in m.rendered
    assert "{{" not in m.rendered


def test_reopening_maps_to_the_reopened_template():
    m = template_for(change(Access.CLOSED, Access.OPEN))
    assert m.name == ROUTE_REOPENED.name


def test_first_status_maps_to_its_own_template():
    m = template_for(change(None, Access.OPEN))
    assert m.name == ROUTE_FIRST_STATUS.name


def test_an_ordinary_change_carries_both_the_old_and_new_state():
    m = template_for(change(Access.OPEN, Access.LIMITED))
    assert m.name == ROUTE_CHANGED.name
    assert m.parameters[1] == "open"
    assert m.parameters[2] == "limited"


def test_a_status_with_no_note_still_fills_the_slot():
    """The slot must contain something — Meta rejects an empty parameter. "There is
    nothing more to tell you" is information; a blank is a failed send."""
    m = template_for(change(Access.OPEN, Access.CLOSED, summary=None))
    assert all(p.strip() for p in m.parameters)
    assert "no further detail" in m.rendered


@pytest.mark.parametrize(
    ("previous", "new", "phrase"),
    [
        # The phrase that identifies which branch the message came from. Checking the
        # branch rather than the access word, because a reopening deliberately says
        # "no longer recorded as closed" and never a bare "open" — see below.
        (Access.OPEN, Access.CLOSED, "not a forecast"),
        (Access.CLOSED, Access.OPEN, "no longer recorded as closed"),
        (None, Access.OPEN, "first verified status"),
        (Access.OPEN, Access.LIMITED, "limited"),
    ],
)
def test_both_channels_describe_the_same_change(previous, new, phrase):
    """Same change, two channels, one set of facts.

    A traveller subscribed to both must not be told two different things, and the
    branch is what decides the meaning — so the branches have to stay in step. The
    parametrisation deliberately keys on branch-identifying wording rather than on
    the access value, because of the next test.
    """
    c = change(previous, new)
    _, email_body = message_for(c)
    rendered = template_for(c).rendered
    if phrase == "first verified status":
        # The two phrase it differently; what matters is that both say it is a first.
        assert "first" in email_body.lower() and "first" in rendered.lower()
    else:
        assert phrase in email_body.lower() or phrase in email_body
        assert phrase in rendered.lower() or phrase in rendered


def test_neither_channel_says_a_bare_open_on_a_reopening():
    """`message_for` says it "deliberately never says 'open' without qualification",
    and the template must hold the same line. "The road is open" is a claim about the
    present that nobody can make about this route; "no longer recorded as closed" is
    a claim about our own record, which is the only thing we can stand behind."""
    c = change(Access.CLOSED, Access.OPEN)
    _, email_body = message_for(c)
    rendered = template_for(c).rendered
    for text in (email_body, rendered):
        assert "no longer recorded as closed" in text
        assert "is open" not in text
        assert "now open" not in text


def test_no_rendered_message_leaves_a_placeholder_behind():
    for previous, new in [
        (Access.OPEN, Access.CLOSED),
        (Access.CLOSED, Access.OPEN),
        (None, Access.OPEN),
        (Access.SUSPENDED, Access.LIMITED),
    ]:
        assert "{{" not in template_for(change(previous, new)).rendered


# ------------------------------------------------------------------ channels


def test_whatsapp_and_sms_need_a_template_email_does_not():
    """WhatsApp for Meta's rules, SMS for TRAI's DLT regime. Email has neither, so it
    keeps the prose path and its unsubscribe link."""
    assert channel_needs_template("whatsapp")
    assert channel_needs_template("sms")
    assert not channel_needs_template("email")
