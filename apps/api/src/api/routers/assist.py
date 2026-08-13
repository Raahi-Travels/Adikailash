"""The assistant, for staff first (doc 08's AI layer, Phase 5).

Staff-facing deliberately, and doc 04 is the reason: it rates "AI summaries and
suggested replies" P1 and qualifies it "human-reviewed and grounded". Three people
run this company and one of them reads every draft before a traveller sees it, which
is a far stronger guarantee than any prompt. The same retrieval and grounding will
serve a public widget when there is enough published content to make one worth
having; nothing here would need rewriting for that, only a different route and a
tighter rate limit.

**Retrieval-only is a supported mode, not a degraded one.** With no model configured —
or with the provider down — the endpoint returns the matching approved passages and
their sources, which is most of the value. A coordinator who is handed the right guide
and the right line from it can write the reply themselves in twenty seconds.

Refusals are decided in `api.domain.assist` before any of this runs.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select

from api.deps import SessionDep, require_roles
from api.domain.assist import (
    CONTRACT_VERSION,
    SYSTEM_CONTRACT,
    Refusal,
    build_prompt,
    ground,
    refusal_answer,
)
from api.llm import complete, configured_model, is_configured
from api.models.content import AssistQuery
from api.models.staff import SALES_ROLES, StaffUser
from api.retrieval import latest_status, retrieve
from api.schemas import AssistIn, AssistOut, AssistPassageOut, AssistUsedIn

router = APIRouter(prefix="/admin", tags=["assist"])

AssistStaff = Annotated[
    StaffUser, Depends(require_roles(SALES_ROLES, "using the assistant"))
]


@router.post("/assist", response_model=AssistOut)
async def assist(payload: AssistIn, session: SessionDep, staff: AssistStaff):
    """Draft a grounded reply to a traveller's question.

    The order is the design: refuse, then retrieve, then generate. A question about
    somebody's heart condition never reaches the model, and never reaches the
    network — `ground()` settles it deterministically first.
    """
    now = datetime.now(UTC)
    question = payload.question.strip()

    passages = await retrieve(session, question, payload.locale)
    status = await latest_status(session, question, payload.locale)
    grounding = ground(question, passages, status=status, now=now)

    if grounding.refusal is not None:
        answer = refusal_answer(grounding.refusal)
        await _log(session, question, payload.locale, staff, grounding, answer)
        return _out(answer, grounding)

    text = None
    if is_configured():
        text = await complete(SYSTEM_CONTRACT, build_prompt(grounding, now=now))

    from api.domain.assist import Answer

    answer = Answer(
        text=text or "",
        citations=grounding.citations,
        model=configured_model() if text else None,
        contract_version=CONTRACT_VERSION,
        # A draft that could not be generated still needs a person, but the passages
        # below it are the useful half and they are returned either way.
        needs_human=text is None,
        staff_guidance=(
            None
            if text
            else (
                "No draft was generated — the assistant is either not configured or"
                " the provider did not answer. The passages below are what it would"
                " have written from; they are approved text and can be quoted"
                " directly."
            )
        ),
    )
    await _log(session, question, payload.locale, staff, grounding, answer)
    return _out(answer, grounding)


@router.post("/assist/{query_id}/used", response_model=AssistOut | None)
async def mark_used(
    query_id: int, payload: AssistUsedIn, session: SessionDep, staff: AssistStaff
):
    """Record whether a coordinator actually sent the draft.

    The only quality measure that means anything. A draft that reviews well and never
    gets sent is a bad draft, and without this the evaluation is somebody's
    impression of how it felt.
    """
    row = await session.get(AssistQuery, query_id)
    if row is not None:
        row.was_used = payload.was_used
        await session.commit()
    return None


async def _log(session, question, locale, staff, grounding, answer) -> None:
    """Doc 08 requires logging and evaluation. Never blocks the answer."""
    try:
        session.add(
            AssistQuery(
                question=question,
                asked_by=staff.name or staff.email or staff.id,
                locale=locale,
                refusal=answer.refusal.value if answer.refusal else None,
                citations=list(answer.citations) or None,
                passage_count=len(grounding.passages),
                quoted_status=grounding.status is not None,
                answer=answer.text or None,
                model=answer.model,
                contract_version=answer.contract_version,
            )
        )
        await session.commit()
    except Exception:  # noqa: BLE001 — a failed log must not lose the answer
        await session.rollback()


def _out(answer, grounding) -> AssistOut:
    return AssistOut(
        answer=answer.text,
        citations=answer.citations,
        refusal=answer.refusal.value if answer.refusal else None,
        staff_guidance=answer.staff_guidance,
        needs_human=answer.needs_human,
        model=answer.model,
        contract_version=answer.contract_version,
        quoted_status=(
            grounding.status.as_sentence(now=datetime.now(UTC))
            if grounding.status
            else None
        ),
        passages=[
            AssistPassageOut(
                kind=p.kind,
                title=p.title,
                text=p.text,
                source_ref=p.source_ref,
                url_path=p.url_path,
                score=round(p.score, 4),
            )
            for p in grounding.passages
        ],
    )


@router.get("/assist/gaps", response_model=list[dict])
async def content_gaps(session: SessionDep, staff: AssistStaff, limit: int = 30):
    """Questions we had nothing published to answer.

    The most useful by-product of the whole feature. Doc 07 wants a content plan
    driven by real questions rather than keyword tools, and every row here is a real
    question a traveller asked that this company has not written about yet.
    """
    rows = await session.scalars(
        select(AssistQuery)
        .where(AssistQuery.refusal == Refusal.NO_GROUNDING.value)
        .order_by(AssistQuery.created_at.desc())
        .limit(limit)
    )
    return [
        {"question": r.question, "asked_at": r.created_at.isoformat(), "locale": r.locale}
        for r in rows
    ]
