"""Pre-approved message templates, for channels that require them.

Two channels we will use refuse free-form business-initiated messages:

  - **WhatsApp.** Outside a 24-hour window opened by the customer's own reply, a
    business may only send a template Meta has reviewed and approved. Approval takes
    hours to days, and a rejected template blocks the channel entirely.
  - **SMS in India.** TRAI's DLT regime requires the same thing: content templates
    registered against a registered header before an operator will deliver them.

So this module is not WhatsApp-specific. It is "channels where the words are agreed
in advance", which is why the columns on `OutboundMessage` are `template_name` and
`template_parameters` rather than anything Meta-branded.

**What this changes about honesty.** `domain.subscriptions.message_for` writes prose:
"this is what our coordinator last verified, not a forecast", "please do not set out
before speaking to us". In a template that text is *fixed* and reviewed — it cannot be
edited away per message, and a variable cannot be smuggled into the middle of a
caveat. The qualifications become structural rather than a habit somebody maintains.

Email keeps the prose path unchanged. It has no such gatekeeping, so it should not
inherit the constraint.
"""

from __future__ import annotations

import enum
import re
from dataclasses import dataclass

from api.domain.status import Access
from api.domain.subscriptions import Change

#: Meta's limits. Exceeding any of them is a rejection at submission, not at send.
MAX_BODY = 1024
MAX_FOOTER = 60
MAX_HEADER = 60
#: Not a platform limit — ours. A 600-character coordinator note inside one variable
#: makes a message nobody reads on a phone, and risks pushing the rendered body past
#: MAX_BODY at send time, which fails per-message rather than at review.
MAX_PARAMETER = 180

_PLACEHOLDER = re.compile(r"\{\{(\d+)\}\}")
#: Meta rejects a parameter value containing a newline, a tab, or four or more
#: consecutive spaces. The failure arrives as a 132000-series error at send time —
#: long after review passed — so it has to be handled when the value is built.
_FORBIDDEN_IN_PARAMETER = re.compile(r"[\r\n\t]+|\s{4,}")


class TemplateCategory(enum.StrEnum):
    """Meta's category, which decides both pricing and the rules that apply.

    Route alerts are UTILITY: they follow from a request the person made, about a
    specific thing they asked to be told about. Categorising them MARKETING would be
    both more expensive and untrue, and Meta re-categorises templates it thinks are
    mislabelled — a promotional-looking "utility" template is a good way to have the
    whole channel reviewed.
    """

    UTILITY = "utility"
    MARKETING = "marketing"
    AUTHENTICATION = "authentication"


@dataclass(frozen=True, slots=True)
class Template:
    """One template, exactly as it must be submitted for approval.

    `body` is the text with `{{1}}`-style placeholders. It is the literal string a
    reviewer reads, so it lives here rather than being assembled at runtime — the
    thing we submit and the thing we send have to be the same thing.
    """

    name: str
    category: TemplateCategory
    body: str
    footer: str | None = None
    #: A URL button pointing at the status page would be the single most useful
    #: addition here: one tap from the alert to the page carrying the timestamp and
    #: the verifier's name. It needs a settled domain (decision O7) — a button URL is
    #: part of the submitted template and cannot be changed without re-approval, so
    #: submitting one against a provisional Vercel host would mean resubmitting
    #: everything the day the domain lands.
    url_button: str | None = None

    @property
    def parameter_count(self) -> int:
        found = {int(n) for n in _PLACEHOLDER.findall(self.body)}
        return max(found) if found else 0

    def render(self, parameters: tuple[str, ...]) -> str:
        """Substitute parameters, for previews and for the admin queue.

        This is what a staff member reads before anything is sent, and what
        `OutboundMessage.body` stores — so the queue keeps showing a real message
        rather than a row of placeholders.
        """
        return _PLACEHOLDER.sub(
            lambda m: parameters[int(m.group(1)) - 1]
            if int(m.group(1)) <= len(parameters)
            else m.group(0),
            self.body,
        )


def submission_problems(template: Template) -> list[str]:
    """Why Meta would reject this template. Empty means submittable.

    Run as a test rather than at runtime. Every rule below is one that fails *at
    review*, which costs hours or days and blocks the channel — so it is worth
    catching the moment somebody edits the wording, not when they submit it.
    """
    problems: list[str] = []
    body = template.body

    if len(body) > MAX_BODY:
        problems.append(f"Body is {len(body)} characters; the limit is {MAX_BODY}.")
    if template.footer and len(template.footer) > MAX_FOOTER:
        problems.append(f"Footer exceeds {MAX_FOOTER} characters.")

    # A body may not begin or end with a variable: Meta reads that as a template with
    # no content of its own, which is exactly what spammers submit.
    stripped = body.strip()
    if _PLACEHOLDER.match(stripped):
        problems.append("Body begins with a variable.")
    if re.search(r"\{\{\d+\}\}$", stripped):
        problems.append("Body ends with a variable.")

    # Two adjacent variables are rejected for the same reason.
    if re.search(r"\{\{\d+\}\}\s*\{\{\d+\}\}", body):
        problems.append("Two variables are adjacent with no text between them.")

    # Placeholders must be 1..n with nothing skipped, or the positional parameter
    # array will not line up with what was approved.
    numbers = sorted(int(n) for n in set(_PLACEHOLDER.findall(body)))
    if numbers and numbers != list(range(1, len(numbers) + 1)):
        problems.append(f"Placeholders are {numbers}; they must run 1..n with no gaps.")

    if template.category is TemplateCategory.UTILITY:
        # Not a platform rule — a house rule with a real consequence. Meta
        # re-categorises templates that read as promotional, and a re-categorised
        # template is billed differently and can put the whole number under review.
        for word in ("offer", "discount", "book now", "limited time", "deal"):
            if word in body.lower():
                problems.append(
                    f"Utility template contains promotional language ({word!r}); "
                    "Meta may re-categorise it as marketing."
                )

    return problems


def sanitise_parameter(value: str | None, *, fallback: str) -> str:
    """Make a runtime value safe to pass as a template variable.

    Meta rejects a parameter containing a newline, a tab, or four or more consecutive
    spaces — and rejects an empty one. A coordinator's note is free text typed on a
    phone, so it will eventually contain all of those. Failing that check produces a
    per-message send error long after the template passed review, which is the worst
    place to discover it.

    `fallback` is required rather than defaulted: every caller has to decide what an
    absent value should actually say to a traveller, because "" is never the answer.
    """
    if value is None:
        return fallback
    cleaned = _FORBIDDEN_IN_PARAMETER.sub(" ", value).strip()
    if not cleaned:
        return fallback
    if len(cleaned) > MAX_PARAMETER:
        # Cut at a word boundary. A truncated message ending mid-word reads as a bug
        # to the person receiving it, which undermines the one thing these messages
        # are for.
        cleaned = cleaned[:MAX_PARAMETER].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return cleaned


# --------------------------------------------------------------- the registry


#: Every message carries its own way out, in the fixed footer where it cannot be
#: dropped. Doc 03 rules out dark patterns; for WhatsApp the equivalent of the email
#: unsubscribe link is a reply keyword, and it belongs on every message.
_FOOTER = "Reply STOP to stop these alerts."


def _readable(access: Access | str) -> str:
    value = access.value if isinstance(access, Access) else str(access)
    return value.replace("_", " ")


ROUTE_BLOCKED = Template(
    name="route_blocked_alert",
    category=TemplateCategory.UTILITY,
    # The caveats are fixed text. Once approved, nobody can send this message without
    # "not a forecast" and "do not set out ... before speaking to us" attached — which
    # is a stronger guarantee than the prose version, where they are a convention.
    # "Route update:" is not decoration. Meta rejects a body that opens with a
    # variable — it reads as a template with no content of its own, which is what
    # spammers submit to get an arbitrary-text channel approved. The prefix also
    # gives the message a recognisable first line in a crowded WhatsApp list.
    body=(
        "Route update: {{1}} is now recorded as {{2}}. This is what our coordinator "
        "last verified, not a forecast. {{3}} Please do not set out on this segment "
        "before speaking to us."
    ),
    footer=_FOOTER,
)

ROUTE_REOPENED = Template(
    name="route_reopened_alert",
    category=TemplateCategory.UTILITY,
    body=(
        "Route update: {{1}} is no longer recorded as closed. {{2}} Conditions on "
        "this road change without notice, so please treat this as the last thing we "
        "verified rather than a guarantee for your travel date."
    ),
    footer=_FOOTER,
)

ROUTE_CHANGED = Template(
    name="route_status_changed",
    category=TemplateCategory.UTILITY,
    body=(
        "Route update: {{1}} has changed from {{2}} to {{3}}. {{4}} This is what our "
        "coordinator last verified, not a forecast."
    ),
    footer=_FOOTER,
)

ROUTE_FIRST_STATUS = Template(
    name="route_first_status",
    category=TemplateCategory.UTILITY,
    body=(
        "We have published our first verified status for {{1}}: it is recorded as "
        "{{2}}. {{3}} You are receiving this because you asked us to tell you when "
        "this route changes."
    ),
    footer=_FOOTER,
)

ALL_TEMPLATES: tuple[Template, ...] = (
    ROUTE_BLOCKED,
    ROUTE_REOPENED,
    ROUTE_CHANGED,
    ROUTE_FIRST_STATUS,
)


@dataclass(frozen=True, slots=True)
class TemplateMessage:
    """A template plus the values to fill it, ready for a provider call.

    `rendered` travels with it so the admin queue and any future audit read the
    message a person would have received, not a row of placeholders.
    """

    template: Template
    parameters: tuple[str, ...]
    rendered: str

    @property
    def name(self) -> str:
        return self.template.name


#: What the summary parameter says when a coordinator published a status with no
#: note. Chosen over silence: on a template the slot must be filled with something,
#: and "there is nothing more to tell you" is information, where an empty string
#: would be a rejected send.
_NO_SUMMARY = "We have no further detail beyond the status itself."


def template_for(change: Change) -> TemplateMessage:
    """Map a route change onto an approved template and its parameters.

    Mirrors `domain.subscriptions.message_for` branch for branch on purpose: the same
    change must not be described one way over email and another over WhatsApp. A test
    holds the two in step.
    """
    name = sanitise_parameter(change.segment_name, fallback=change.segment_slug)
    summary = sanitise_parameter(change.summary, fallback=_NO_SUMMARY)

    if change.became_blocking:
        template = ROUTE_BLOCKED
        parameters = (name, _readable(change.new_access), summary)
    elif change.stopped_blocking:
        template = ROUTE_REOPENED
        parameters = (name, summary)
    elif change.is_first_status:
        template = ROUTE_FIRST_STATUS
        parameters = (name, _readable(change.new_access), summary)
    else:
        template = ROUTE_CHANGED
        previous = _readable(change.previous_access) if change.previous_access else "unknown"
        parameters = (name, previous, _readable(change.new_access), summary)

    return TemplateMessage(
        template=template,
        parameters=parameters,
        rendered=template.render(parameters),
    )


#: Channels whose provider will refuse anything that is not pre-approved.
TEMPLATED_CHANNELS = frozenset({"whatsapp", "sms"})


def channel_needs_template(channel: str) -> bool:
    return channel in TEMPLATED_CHANNELS
