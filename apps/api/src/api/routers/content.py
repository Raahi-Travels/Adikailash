"""The content hub: public reads and editorial writes (Phase 4, doc 07).

Public reads return only published articles. Freshness is derived at read time and
never stored, exactly as route status works — a cached freshness is a stale
freshness, and here that would mean telling somebody a guide to a mountain road was
reviewed recently when it was not.

Writes require `CONTENT_ROLES`. Publishing additionally requires a named author and
reviewer, enforced by a database CHECK as well as here, because doc 07's authority
argument rests entirely on real names being attached to real claims.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.deps import LocaleDep, SessionDep, require_roles
from api.domain.content import (
    derive_freshness,
    is_time_sensitive,
    label_for,
    next_review_due,
)
from api.localization import resolve
from api.models.catalogue import Journey
from api.models.content import Article, ArticleCluster, ArticleFaq, ArticleState
from api.models.staff import CONTENT_ROLES, StaffUser
from api.schemas import (
    ArticleDetailOut,
    ArticleFaqOut,
    ArticleIn,
    ArticleReviewIn,
    ArticleSummaryOut,
)
from api import indexnow

router = APIRouter(tags=["content"])

ContentStaff = Annotated[
    StaffUser, Depends(require_roles(CONTENT_ROLES, "editing guides"))
]


def _summary(article: Article, locale: str) -> ArticleSummaryOut:
    freshness = derive_freshness(
        article.last_reviewed_at, article.review_interval_days
    )
    return ArticleSummaryOut(
        slug=article.slug,
        cluster=article.cluster.value,
        title=resolve(article.title, locale) or "",
        answer=resolve(article.answer, locale) or "",
        is_pillar=article.is_pillar,
        author=article.author,
        reviewed_by=article.reviewed_by,
        last_reviewed_at=article.last_reviewed_at,
        next_review_due=next_review_due(
            article.last_reviewed_at, article.review_interval_days
        ),
        freshness=freshness.value,
        freshness_label=label_for(freshness),
        is_time_sensitive=is_time_sensitive(article.cluster.value),
        published_at=article.published_at,
    )


# ------------------------------------------------------------------ public reads


@router.get("/guides", response_model=list[ArticleSummaryOut])
async def list_guides(
    session: SessionDep, locale: LocaleDep, cluster: str | None = None
):
    """Published guides, pillars first.

    Pillars lead because doc 07 wants a small number of substantial pages rather than
    "hundreds of near-duplicate" ones, and the ordering should make that structure
    visible rather than burying a pillar under six field notes.
    """
    stmt = select(Article).where(Article.state == ArticleState.PUBLISHED)
    if cluster:
        stmt = stmt.where(Article.cluster == cluster)

    rows = list(
        await session.scalars(
            stmt.order_by(Article.is_pillar.desc(), Article.published_at.desc())
        )
    )
    return [_summary(a, locale) for a in rows]


@router.get("/guides/{slug}", response_model=ArticleDetailOut)
async def guide_detail(slug: str, session: SessionDep, locale: LocaleDep):
    article = await session.scalar(
        select(Article)
        .where(Article.slug == slug, Article.state == ArticleState.PUBLISHED)
        .options(selectinload(Article.faqs))
    )
    if article is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guide not found.")

    journey_slug = None
    if article.journey_id:
        journey = await session.get(Journey, article.journey_id)
        journey_slug = journey.slug if journey else None

    # Supporting pieces under a pillar, or siblings under the same parent, so a
    # reader can move through the cluster rather than back out to an index.
    related_stmt = select(Article).where(
        Article.state == ArticleState.PUBLISHED, Article.id != article.id
    )
    if article.is_pillar:
        related_stmt = related_stmt.where(Article.parent_id == article.id)
    elif article.parent_id:
        related_stmt = related_stmt.where(Article.parent_id == article.parent_id)
    else:
        related_stmt = related_stmt.where(Article.cluster == article.cluster)

    related = list(await session.scalars(related_stmt.limit(6)))

    base = _summary(article, locale)
    return ArticleDetailOut(
        **base.model_dump(),
        body=resolve(article.body, locale),
        journey_slug=journey_slug,
        faqs=[
            ArticleFaqOut(
                question=resolve(f.question, locale) or "",
                answer=resolve(f.answer, locale) or "",
            )
            for f in article.faqs
        ],
        related=[_summary(r, locale) for r in related],
    )


# -------------------------------------------------------------------- editorial


@router.post("/admin/guides", response_model=ArticleSummaryOut, status_code=201)
async def create_guide(
    payload: ArticleIn, session: SessionDep, staff: ContentStaff, locale: str = "en"
):
    try:
        cluster = ArticleCluster(payload.cluster)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown cluster."
        ) from None

    journey_id = None
    if payload.journey_slug:
        journey = await session.scalar(
            select(Journey).where(Journey.slug == payload.journey_slug)
        )
        if journey is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Journey not found.")
        journey_id = journey.id

    parent_id = None
    if payload.parent_slug:
        parent = await session.scalar(
            select(Article).where(Article.slug == payload.parent_slug)
        )
        if parent is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent guide not found.")
        parent_id = parent.id

    article = Article(
        slug=payload.slug,
        cluster=cluster,
        title=payload.title.to_jsonb(),
        answer=payload.answer.to_jsonb(),
        body=payload.body.to_jsonb() if payload.body else None,
        journey_id=journey_id,
        parent_id=parent_id,
        is_pillar=payload.is_pillar,
        review_interval_days=payload.review_interval_days,
        internal_note=payload.internal_note,
        state=ArticleState.DRAFT,
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return _summary(article, locale)


@router.post("/admin/guides/{slug}/review", response_model=ArticleSummaryOut)
async def review_guide(
    slug: str,
    payload: ArticleReviewIn,
    session: SessionDep,
    staff: ContentStaff,
    locale: str = "en",
):
    """Record a review, and optionally publish.

    `reviewed_by` is taken from the session. Doc 09 requires attribution on anything a
    customer relies on, and a reviewer name supplied in the request body is a name
    anybody could type.

    Publishing pings IndexNow: a new guide is worth telling Bing about for the same
    reason a status change is, since ChatGPT search and Copilot both read that index.
    """
    article = await session.scalar(select(Article).where(Article.slug == slug))
    if article is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guide not found.")

    if payload.author is not None:
        article.author = payload.author or None
    article.reviewed_by = staff.name
    article.last_reviewed_at = datetime.now(UTC)

    if payload.state is not None:
        try:
            new_state = ArticleState(payload.state)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown state."
            ) from None

        if new_state is ArticleState.PUBLISHED and not (article.author or "").strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "A published guide needs a named author. Doc 07's authority argument "
                "rests on real names against real claims, and an unsigned guide about "
                "permit paperwork is the commodity content already on page one.",
            )
        if new_state is ArticleState.PUBLISHED and article.published_at is None:
            article.published_at = datetime.now(UTC)
        article.state = new_state

    await session.commit()
    await session.refresh(article)

    if article.state is ArticleState.PUBLISHED:
        indexnow.submit(indexnow.article_urls(article.slug))

    return _summary(article, locale)


@router.get("/admin/guides", response_model=list[ArticleSummaryOut])
async def list_all_guides(
    session: SessionDep, staff: ContentStaff, locale: str = "en"
):
    """Every guide including drafts, stalest first.

    Ordered by what needs a person, same product rule as the other queues: an article
    past its re-check commitment is making a claim of currency nobody has kept.
    """
    rows = list(await session.scalars(select(Article).order_by(Article.slug)))
    items = [_summary(a, locale) for a in rows]
    order = {"stale": 0, "due_soon": 1, "current": 2}
    items.sort(key=lambda i: (order.get(i.freshness, 9), not i.is_time_sensitive))
    return items
