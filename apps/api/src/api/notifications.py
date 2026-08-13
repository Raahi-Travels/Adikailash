"""Turning a published route status into queued messages.

Sits between the status endpoint and the outbound queue. The rules it applies live in
`api.domain.subscriptions` and are tested without a database; this module is the part
that reads what changed and writes rows.

**Nothing here sends.** Decision O9 has not settled a messaging provider. Rows are
queued and wait. That is a deliberate state and a visible one: the admin shows the
backlog, so nobody can believe alerts are going out when they are not.

Queuing before a provider exists is also the only way to check the materiality rules
against a real season before a single message reaches anybody. If a month of
re-verifications produces forty queued messages, the rules are wrong, and it is much
better to learn that from a table than from unsubscribes.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.domain.subscriptions import (
    Change,
    message_for,
    send_at,
    urgency_of,
    within_send_budget,
)
from api.domain.templates import channel_needs_template, template_for
from api.localization import resolve
from api.models.operations import RouteSegment, StatusUpdate
from api.models.subscriptions import (
    OutboundMessage,
    OutboundState,
    StatusSubscription,
    SubscriptionState,
)

logger = logging.getLogger(__name__)


async def _previous_access(
    session: AsyncSession, segment_id: int, before_id: int
) -> str | None:
    """The access value published immediately before this one, if any."""
    row = await session.scalar(
        select(StatusUpdate)
        .where(
            StatusUpdate.route_segment_id == segment_id,
            StatusUpdate.id != before_id,
        )
        .order_by(StatusUpdate.verified_at.desc())
        .limit(1)
    )
    return row.access if row else None


async def _sent_today(session: AsyncSession, subscription_id: int) -> int:
    """Messages to this subscriber in the last 24 hours.

    The window is computed in SQL rather than by passing a Python datetime.
    `TimestampMixin.created_at` is `timestamp without time zone`, so handing asyncpg
    an aware datetime raises "can't subtract offset-naive and offset-aware
    datetimes". Keeping it server-side sidesteps that, and is more correct anyway:
    "today" should be the database's clock, not whichever app server happened to
    handle the request.
    """
    return (
        await session.scalar(
            select(func.count())
            .select_from(OutboundMessage)
            .where(
                OutboundMessage.subscription_id == subscription_id,
                OutboundMessage.created_at >= func.now() - text("interval '1 day'"),
                OutboundMessage.state != OutboundState.SUPPRESSED,
            )
        )
    ) or 0


def _unsubscribe_url(token: str) -> str:
    """The absolute link that goes in every message.

    A bare `/unsubscribe?token=...` is a working link on the website and a dead one in
    an inbox, and this row may sit in the queue for weeks before a sender exists. When
    decision O7 has not settled a domain the placeholder stays visible in the body, so
    the gap shows up in the admin queue now rather than in somebody's mail later.
    """
    origin = get_settings().public_site_origin.rstrip("/")
    prefix = origin or "[SITE ORIGIN NOT CONFIGURED — see decision O7]"
    return f"{prefix}/unsubscribe?token={token}"


async def queue_status_alerts(
    session: AsyncSession, update: StatusUpdate, *, now: datetime | None = None
) -> int:
    """Fan a published status out to its subscribers. Returns rows queued.

    Called after the status is committed. Never raises: a failure here must not undo
    a verified publish, which is the thing that actually matters.
    """
    moment = now or datetime.now(UTC)

    try:
        segment = await session.get(RouteSegment, update.route_segment_id)
        if segment is None:
            return 0

        previous = await _previous_access(session, segment.id, update.id)

        change = Change(
            segment_slug=segment.slug,
            segment_name=resolve(segment.name, "en") or segment.slug,
            previous_access=previous,
            new_access=update.access,
            published_at=update.verified_at,
            summary=resolve(update.summary, "en"),
        )

        due = send_at(change, now=moment)
        if due is None:
            # A re-verification that changed nothing. The page is updated; nobody is
            # interrupted. This is the common case and it is the point.
            logger.debug("Status for %s not material; no alerts queued", segment.slug)
            return 0

        subject, body = message_for(change)
        urgency = urgency_of(change).value

        # Built once per publish rather than per subscriber: the template and its
        # parameters describe the *change*, not the recipient.
        templated = template_for(change)

        # Subscribers to this segment, plus those who asked about the whole route.
        subscribers = list(
            await session.scalars(
                select(StatusSubscription).where(
                    StatusSubscription.state == SubscriptionState.ACTIVE,
                    (StatusSubscription.route_segment_id == segment.id)
                    | (StatusSubscription.route_segment_id.is_(None)),
                )
            )
        )

        queued = 0
        for subscriber in subscribers:
            over_budget = not within_send_budget(
                await _sent_today(session, subscriber.id)
            )
            # WhatsApp and SMS can only carry words agreed in advance; email can
            # carry prose. Same change, same facts, two shapes — and the template
            # path keeps the caveats as fixed reviewed text rather than as a
            # convention somebody maintains.
            needs_template = channel_needs_template(subscriber.channel.value)
            if needs_template:
                # The opt-out is the template's own fixed footer ("Reply STOP…"),
                # which is why no link is appended here: a URL inside a template
                # parameter is both a rejection risk and a phishing pattern.
                rendered_body = templated.rendered
            else:
                # Doc 03 rules out dark patterns, and the unsubscribe link is the one
                # that matters most. In every email, never behind a login.
                rendered_body = (
                    f"{body}\n\nStop these alerts: "
                    f"{_unsubscribe_url(subscriber.unsubscribe_token)}"
                )

            message = OutboundMessage(
                subscription_id=subscriber.id,
                status_update_id=update.id,
                channel=subscriber.channel,
                destination=subscriber.destination,
                subject=subject,
                body=rendered_body,
                template_name=templated.name if needs_template else None,
                template_parameters=list(templated.parameters) if needs_template else None,
                urgency=urgency,
                send_after=due,
            )
            if over_budget:
                # Recorded rather than dropped, so "why did I not hear" has an answer.
                message.state = OutboundState.SUPPRESSED
                message.suppressed_reason = (
                    "Daily alert limit reached for this subscriber. The segment "
                    "changed more than three times in a day, which is an operational "
                    "problem rather than something to forward."
                )
            session.add(message)
            queued += 1

        try:
            await session.commit()
        except IntegrityError:
            # The unique constraint on (subscription, status_update). A retry of the
            # same publish must not double-send.
            await session.rollback()
            logger.info("Alerts for status %s already queued", update.id)
            return 0

        logger.info("Queued %d alert(s) for %s", queued, segment.slug)
        return queued

    except Exception as exc:  # noqa: BLE001 - never undo a verified publish
        logger.warning("Failed to queue status alerts: %s", exc)
        return 0
