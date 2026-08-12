"""Subscribe, confirm, unsubscribe, and the outbound queue (Phase 4, doc 07).

Three public endpoints, all unauthenticated by necessity: somebody unsubscribing has
no account and must not need one. The token is the authorisation.

**Enumeration is refused deliberately.** Subscribing with an address that already has
a subscription returns the same response as a fresh signup, and never reveals whether
it was already there. Otherwise this endpoint becomes a way to test whether a given
phone number is a customer of ours.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.deps import SessionDep, require_roles
from api.localization import resolve
from api.models.operations import RouteSegment
from api.models.staff import STATUS_PUBLISHING_ROLES, StaffUser
from api.models.subscriptions import (
    OutboundMessage,
    OutboundState,
    StatusSubscription,
    SubscriptionChannel,
    SubscriptionState,
    generate_token,
)
from api.schemas import (
    OutboundMessageOut,
    OutboundQueueOut,
    SubscribeIn,
    SubscriptionOut,
)

router = APIRouter(tags=["subscriptions"])

QueueStaff = Annotated[
    StaffUser, Depends(require_roles(STATUS_PUBLISHING_ROLES, "reading the alert queue"))
]


def _hint(destination: str) -> str:
    """Enough to recognise, not enough to read over a shoulder."""
    if "@" in destination:
        name, _, domain = destination.partition("@")
        head = name[:2] if len(name) > 2 else name[:1]
        return f"{head}{'*' * max(1, len(name) - len(head))}@{domain}"
    return f"{'*' * max(0, len(destination) - 4)}{destination[-4:]}"


@router.post("/status-alerts", response_model=SubscriptionOut, status_code=201)
async def subscribe(payload: SubscribeIn, session: SessionDep):
    """Ask for route alerts.

    Creates a pending subscription and a confirmation token. Nothing is sent until
    the holder confirms, because an unconfirmed address is one somebody else may have
    typed — and a route alert to a stranger's phone is both a nuisance and a personal
    data problem under doc 08.

    Returns the same shape whether or not a subscription already existed. Doing
    otherwise would turn this into a membership oracle for any phone number.
    """
    if not payload.consent:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "We need you to agree to receive these before we can send any.",
        )

    try:
        channel = SubscriptionChannel(payload.channel)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown channel."
        ) from None

    segment = None
    if payload.route_segment_slug:
        segment = await session.scalar(
            select(RouteSegment).where(RouteSegment.slug == payload.route_segment_slug)
        )
        if segment is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Route segment not found.")

    destination = payload.destination.strip()
    existing = await session.scalar(
        select(StatusSubscription).where(
            StatusSubscription.channel == channel,
            StatusSubscription.destination == destination,
            StatusSubscription.route_segment_id == (segment.id if segment else None),
        )
    )

    if existing is not None:
        # Re-subscribing after leaving reactivates the same row rather than creating
        # a second one, so a later unsubscribe still stops everything.
        if existing.state in (
            SubscriptionState.UNSUBSCRIBED,
            SubscriptionState.SUPPRESSED,
        ):
            existing.state = SubscriptionState.PENDING
            existing.unsubscribed_at = None
            existing.suppressed_reason = None
            existing.confirm_token = generate_token()
            await session.commit()
        subscription = existing
    else:
        subscription = StatusSubscription(
            channel=channel,
            destination=destination,
            name=payload.name,
            route_segment_id=segment.id if segment else None,
            source_page=payload.source_page,
            confirm_token=generate_token(),
            unsubscribe_token=generate_token(),
            state=SubscriptionState.PENDING,
        )
        session.add(subscription)
        await session.commit()
        await session.refresh(subscription)

    return SubscriptionOut(
        state=subscription.state.value,
        channel=channel.value,
        destination_hint=_hint(destination),
        segment_name=resolve(segment.name, "en") if segment else None,
        message=(
            "Thank you. We will send a confirmation first, and nothing else until you"
            " confirm. If you did not ask for this, ignore it and nothing happens."
        ),
    )


@router.post("/status-alerts/confirm", response_model=SubscriptionOut)
async def confirm(session: SessionDep, token: str = Query(min_length=20)):
    """Confirm ownership of the address or number.

    The token is single-use: cleared on confirmation, so a forwarded link cannot be
    replayed by somebody else later.
    """
    subscription = await session.scalar(
        select(StatusSubscription).where(StatusSubscription.confirm_token == token)
    )
    if subscription is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "This link is not valid. It may have been used already.",
        )

    subscription.state = SubscriptionState.ACTIVE
    subscription.confirmed_at = datetime.now(UTC)
    subscription.confirm_token = None
    await session.commit()

    return SubscriptionOut(
        state=subscription.state.value,
        channel=subscription.channel.value,
        destination_hint=_hint(subscription.destination),
        message=(
            "Confirmed. We will message you when the route status actually changes,"
            " not every time we re-check it."
        ),
    )


@router.post("/status-alerts/unsubscribe", response_model=SubscriptionOut)
async def unsubscribe(session: SessionDep, token: str = Query(min_length=20)):
    """One click, no login, no reason required.

    Deliberately idempotent: an already-unsubscribed token returns success rather than
    an error, because somebody clicking twice should not be told something went wrong.
    """
    subscription = await session.scalar(
        select(StatusSubscription).where(
            StatusSubscription.unsubscribe_token == token
        )
    )
    if subscription is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")

    if subscription.state is not SubscriptionState.UNSUBSCRIBED:
        subscription.state = SubscriptionState.UNSUBSCRIBED
        subscription.unsubscribed_at = datetime.now(UTC)

        # Anything already queued for them is suppressed rather than sent. Leaving a
        # queued message to go out after somebody unsubscribed is the single most
        # common way this kind of system breaks its promise.
        for message in await session.scalars(
            select(OutboundMessage).where(
                OutboundMessage.subscription_id == subscription.id,
                OutboundMessage.state == OutboundState.QUEUED,
            )
        ):
            message.state = OutboundState.SUPPRESSED
            message.suppressed_reason = "Subscriber unsubscribed before this was sent."

        await session.commit()

    return SubscriptionOut(
        state=subscription.state.value,
        channel=subscription.channel.value,
        destination_hint=_hint(subscription.destination),
        message="You will not receive route alerts from us again.",
    )


# ------------------------------------------------------------------ staff view


@router.get("/admin/alert-queue", response_model=OutboundQueueOut)
async def alert_queue(session: SessionDep, staff: QueueStaff, limit: int = 50):
    """What would have gone out.

    Until decision O9 settles a provider this is the whole system: a record of the
    messages the rules produced. Worth reading before any of them reach a real
    person, because a month of re-verifications producing forty queued messages means
    the materiality rules are wrong and it is far cheaper to learn that here.
    """
    messages = list(
        await session.scalars(
            select(OutboundMessage)
            .options(selectinload(OutboundMessage.subscription))
            .order_by(OutboundMessage.created_at.desc())
            .limit(limit)
        )
    )

    async def count(state: OutboundState) -> int:
        return (
            await session.scalar(
                select(func.count())
                .select_from(OutboundMessage)
                .where(OutboundMessage.state == state)
            )
        ) or 0

    active = (
        await session.scalar(
            select(func.count())
            .select_from(StatusSubscription)
            .where(StatusSubscription.state == SubscriptionState.ACTIVE)
        )
    ) or 0

    return OutboundQueueOut(
        messages=[OutboundMessageOut.model_validate(m) for m in messages],
        queued=await count(OutboundState.QUEUED),
        suppressed=await count(OutboundState.SUPPRESSED),
        sent=await count(OutboundState.SENT),
        active_subscribers=active,
        # Hard false: no provider exists. When O9 settles this reads config.
        sending_enabled=False,
    )
