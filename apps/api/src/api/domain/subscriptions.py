"""Route-status alerts: deciding what is worth interrupting somebody for.

Doc 07 lists route-status subscriptions under Phase 4 nurture. The plumbing is
ordinary; the judgement is not, and it is the whole value of this module.

**The failure this exists to prevent is not missing an alert. It is sending too
many.** A coordinator re-verifies a segment every twelve hours. If every
re-verification became a message, a subscriber would get sixty messages a season
saying the road is still open, and would mute us long before the one that said it
had closed. An alert channel people ignore is worse than no alert channel, because
we would believe we had told them.

So a status publish is a *candidate*, and `material_change` decides. The rule is that
we message when **what a traveller can do changed**, not when we last looked.

Two subtleties worth stating, because both are easy to get backwards:

- **Going stale is not an event.** A status passing its re-check window is a change
  in our confidence, not in the road. The page shows it honestly and nobody gets
  woken up for it. If we messaged on staleness we would be messaging about our own
  administration.
- **Reopening is material.** It is tempting to alert only on bad news, but somebody
  who cancelled plans on a closure notice deserves to hear that it lifted, and from
  us rather than from a competitor's brochure.

Pure. No ORM, no session, no clock except what is passed in.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone

from api.domain.status import Access, BLOCKING_ACCESS

#: Everything customer-facing here is in IST. A subscriber in Chennai is not thinking
#: in UTC, and quiet hours in the wrong timezone is exactly the bug that sends a
#: message at three in the morning.
IST = timezone(timedelta(hours=5, minutes=30))


class Urgency(enum.StrEnum):
    """How much a change is allowed to intrude."""

    #: The road just closed or was suspended. Send now, including at night: somebody
    #: may be leaving at five in the morning.
    URGENT = "urgent"
    #: Access changed in a way that alters planning, but nobody is in danger of
    #: driving into a closure tonight.
    NOTABLE = "notable"
    #: Worth knowing, not worth a notification on its own.
    QUIET = "quiet"


@dataclass(frozen=True, slots=True)
class Change:
    """What one status publish actually changed."""

    segment_slug: str
    segment_name: str
    previous_access: Access | None
    new_access: Access
    published_at: datetime
    summary: str | None = None

    @property
    def is_first_status(self) -> bool:
        return self.previous_access is None

    @property
    def became_blocking(self) -> bool:
        return (
            self.new_access in BLOCKING_ACCESS
            and (self.previous_access not in BLOCKING_ACCESS)
        )

    @property
    def stopped_blocking(self) -> bool:
        return (
            self.previous_access in BLOCKING_ACCESS
            and self.new_access not in BLOCKING_ACCESS
        )


def material_change(change: Change) -> bool:
    """Whether this publish is worth a message at all.

    Re-verifying that the road is still open is the most common publish and the least
    interesting one. It updates the page, which is where somebody who wants to check
    goes. It does not earn a notification.
    """
    if change.is_first_status:
        # The first published status for a segment is genuinely new information: the
        # subscriber has been told nothing until now.
        return True
    return change.new_access is not change.previous_access


def urgency_of(change: Change) -> Urgency:
    if change.became_blocking:
        return Urgency.URGENT
    if change.stopped_blocking:
        # Good news, and it changes plans, but nobody is endangered by hearing it at
        # eight in the morning instead of at midnight.
        return Urgency.NOTABLE
    if not material_change(change):
        return Urgency.QUIET
    return Urgency.NOTABLE


#: Nothing but URGENT goes out in these hours, IST.
QUIET_START = time(21, 0)
QUIET_END = time(7, 0)


def in_quiet_hours(moment: datetime) -> bool:
    local = moment.astimezone(IST).time()
    # The window crosses midnight, so it is two comparisons rather than a range.
    return local >= QUIET_START or local < QUIET_END


def next_send_window(moment: datetime) -> datetime:
    """The first moment after `moment` when a non-urgent message may go out."""
    local = moment.astimezone(IST)
    if not in_quiet_hours(moment):
        return moment
    # Before 07:00 today, or after 21:00 and therefore 07:00 tomorrow.
    target = local.replace(hour=QUIET_END.hour, minute=0, second=0, microsecond=0)
    if local.time() >= QUIET_START:
        target = target + timedelta(days=1)
    return target


def send_at(change: Change, *, now: datetime) -> datetime | None:
    """When this change should reach a subscriber, or None if it should not.

    Returning a time rather than a boolean keeps the decision in one place: the caller
    queues for that moment and does not re-derive quiet hours or materiality.
    """
    if not material_change(change):
        return None
    if urgency_of(change) is Urgency.URGENT:
        return now
    return next_send_window(now)


#: Doc 07 wants nurture, not noise. Even material changes are capped: a segment
#: flapping between limited and open all afternoon is an operational problem, and the
#: subscriber should not experience it as six messages.
MAX_PER_SUBSCRIBER_PER_DAY = 3


def within_send_budget(sent_today: int) -> bool:
    return sent_today < MAX_PER_SUBSCRIBER_PER_DAY


def message_for(change: Change) -> tuple[str, str]:
    """Subject and body, in plain language.

    Deliberately never says "open" without qualification, and never implies we
    control the road. Every message points at the page rather than trying to be the
    whole truth, because the page carries the timestamp and the verifier's name.
    """
    name = change.segment_name

    if change.became_blocking:
        subject = f"{name}: route closed"
        body = (
            f"{name} is now recorded as {change.new_access.value.replace('_', ' ')}. "
            "This is what our coordinator last verified, not a forecast. "
            "Please do not set out on this segment before speaking to us."
        )
    elif change.stopped_blocking:
        subject = f"{name}: route reopened"
        body = (
            f"{name} is no longer recorded as closed. Conditions on this road change "
            "without notice, so treat this as the last thing we verified rather than "
            "a guarantee for your travel date."
        )
    elif change.is_first_status:
        subject = f"{name}: first verified status"
        body = (
            f"We have published our first verified status for {name}: "
            f"{change.new_access.value.replace('_', ' ')}."
        )
    else:
        previous = (
            change.previous_access.value.replace("_", " ")
            if change.previous_access
            else "unknown"
        )
        subject = f"{name}: status changed"
        body = (
            f"{name} has changed from {previous} to "
            f"{change.new_access.value.replace('_', ' ')}."
        )

    if change.summary:
        body = f"{body}\n\n{change.summary}"

    return subject, body
